import {
  toTimestampPayloadMessage,
  toTimestampPullRequestMessage
} from "../../infra/messaging/postMessageBridge";
import {
  createApplyTimestampsRequest,
  createCaptureConversationRequest,
  isApplyTimestampsFailure,
  isApplyTimestampsRequest,
  isApplyTimestampsSuccess,
  isCaptureConversationFailure,
  isCaptureConversationRequest,
  isCaptureConversationSuccess
} from "../../infra/messaging/runtimeBridge";
import {
  toRuntimeConversationSource,
  toRuntimeTimestampMappings
} from "../../infra/messaging/runtimeMapper";
import {
  TIMESTAMP_MESSAGE_SCHEMA,
  TIMESTAMP_PULL_REQUEST_SIGNATURE,
  TIMESTAMP_PULL_REQUEST_TYPE
} from "../../infra/messaging/timestampPayload";
import {
  collectChatgptSourceData
} from "../../infra/providers/chatgpt/domParser";
import { readCurrentChatgptConversation } from "../../infra/providers/chatgpt/currentConversation";
import { resolveChatgptCaptureScope } from "../../infra/providers/chatgpt/threadScope";
import { resolveProviderIdByHostname } from "../../infra/providers/index";
import type { ConversationSource } from "../../../../../packages/core/src/application/ports/ConversationSourcePort";
import {
  type SourceSyncState,
  type TrackedMessageId,
  syncConversationIdState,
  resetConversationSyncState,
  isTrackedMessageId,
  createRuntimeRequestId
} from "../../application/sourceSync/state";
import {
  resolveMessageIdByTurnIndex,
  replacePreviousMessageIdByTurnIndex,
  resolveChangedTurnIndexes,
  resolveDeltaMessageIdsByChangedTurns,
  selectSourceByMessageIds
} from "../../application/sourceSync/resolveChangedTurnIndexes";
import {
  TRANSITION_STABILIZATION_RETRY_MS,
  hasLastCommittedScopeOverlap
} from "../../application/sourceSync/transitionPolicy";
import {
  type TimestampPayload,
  TIMESTAMP_REQUEST_TTL_MS,
  toNextUnresolvedState,
  createTimestampRequestId,
  pruneExpiredTimestampRequests,
  resolveTimestampRequestCandidates,
  markPayloadSuccessState,
  markPayloadFailureState
} from "../../application/sourceSync/timestampCorrelation";
import { isPersistableSource } from "../../application/sourceSync/sourceValidityPolicy";

export { bootstrapSourceSyncState } from "../../application/sourceSync/state";
export type { SourceSyncState } from "../../application/sourceSync/state";

export type RuntimeSendMessage = (message: unknown) => unknown | Promise<unknown>;
type PostMainMessage = (message: unknown, targetOrigin: string) => void;
export type CaptureResult =
  | "provider-unsupported"
  | "source-unavailable"
  | "transition-pending"
  | "payload-invalid"
  | "capture-failed"
  | "snapshot-required"
  | "sent";
type ApplyResult = "accepted" | "ignored" | "failed";
type ChatgptSourceData = NonNullable<ReturnType<typeof collectChatgptSourceData>>;

function resolveSourceData(
  hostname: string,
  root: Document,
  state: SourceSyncState
): ChatgptSourceData | "provider-unsupported" | "source-unavailable" | "transition-pending" {
  if (resolveProviderIdByHostname(hostname) !== "chatgpt") {
    return "provider-unsupported";
  }

  const conversation = readCurrentChatgptConversation();
  if (conversation === null) {
    return "source-unavailable";
  }

  syncConversationIdState(conversation.id, state);

  const captureScope = resolveChatgptCaptureScope(root, root.defaultView!);
  if (!captureScope) {
    state.transitionRetryAt = Date.now() + TRANSITION_STABILIZATION_RETRY_MS;
    return "transition-pending";
  }

  const collected = collectChatgptSourceData({
    root,
    conversation,
    captureScope,
    previousLastAssistantContent: state.lastAssistantContentForStabilization
  });
  if (!collected) {
    return "source-unavailable";
  }
  state.lastAssistantContentForStabilization = collected.latestAssistantContent;
  return collected;
}

async function captureConversationSource(
  source: ConversationSource,
  captureMode: "snapshot" | "delta",
  assistantGenerating: boolean,
  sendRuntimeMessage: RuntimeSendMessage
): Promise<"payload-invalid" | "capture-failed" | "snapshot-required" | "sent"> {
  const requestId = createRuntimeRequestId("capture");
  const request = createCaptureConversationRequest(
    requestId,
    toRuntimeConversationSource(source),
    captureMode,
    assistantGenerating
  );
  if (!isCaptureConversationRequest(request)) {
    return "payload-invalid";
  }

  let response: unknown;
  try {
    response = await sendRuntimeMessage(request);
  } catch {
    return "capture-failed";
  }
  if (typeof response === "undefined") {
    return "capture-failed";
  }
  if (isCaptureConversationSuccess(response) && response.requestId === requestId) {
    return "sent";
  }
  if (isCaptureConversationFailure(response) && response.requestId === requestId) {
    return response.error === "snapshot-required" ? "snapshot-required" : "capture-failed";
  }
  return "payload-invalid";
}

function requestTimestampsFromMain(
  source: ChatgptSourceData,
  state: SourceSyncState,
  postMainMessage: PostMainMessage,
  targetOrigin: string,
  priorityMessageIds: readonly TrackedMessageId[] = source.messageRefs.map((messageRef) => messageRef.id)
): void {
  if (state.activeConversationId !== source.conversation.id) {
    syncConversationIdState(source.conversation.id, state);
  }

  const now = Date.now();
  const liveIds = new Set<TrackedMessageId>(source.messageRefs.map((messageRef) => messageRef.id as TrackedMessageId));
  const messageIds = resolveTimestampRequestCandidates(liveIds, priorityMessageIds, state, now);

  if (messageIds.length === 0) {
    return;
  }

  const tsRequestId = createTimestampRequestId();
  const tsRequest = {
    type: TIMESTAMP_PULL_REQUEST_TYPE,
    signature: TIMESTAMP_PULL_REQUEST_SIGNATURE,
    schema: TIMESTAMP_MESSAGE_SCHEMA,
    requestId: tsRequestId,
    conversationId: source.conversation.id,
    messageIds
  };
  if (toTimestampPullRequestMessage(tsRequest) === null) {
    return;
  }

  postMainMessage(tsRequest, targetOrigin);
  state.pendingTimestampRequests.set(tsRequestId, {
    conversationId: source.conversation.id,
    messageIds: new Set(messageIds),
    expiresAt: now + TIMESTAMP_REQUEST_TTL_MS
  });
  for (const messageId of messageIds) {
    const previous = state.requestStateByMessageId.get(messageId);
    state.requestStateByMessageId.set(messageId, toNextUnresolvedState(now, previous));
  }
}

export async function syncResolvedConversationSource(input: {
  hostname: string;
  root: Document;
  sendRuntimeMessage: RuntimeSendMessage;
  postMainMessage: PostMainMessage;
  targetOrigin: string;
  state: SourceSyncState;
}): Promise<CaptureResult> {
  pruneExpiredTimestampRequests(input.state, Date.now());

  const sourceOrResult = resolveSourceData(
    input.hostname,
    input.root,
    input.state
  );
  if (sourceOrResult === "transition-pending") {
    return "transition-pending";
  }

  if (typeof sourceOrResult === "string") {
    input.state.transitionRetryAt = null;
    return sourceOrResult;
  }

  if (!isPersistableSource(sourceOrResult)) {
    return "source-unavailable";
  }

  if (
    !input.state.hasInitialSnapshotCaptured &&
    hasLastCommittedScopeOverlap(sourceOrResult, input.state)
  ) {
    input.state.transitionRetryAt = Date.now() + TRANSITION_STABILIZATION_RETRY_MS;
    return "transition-pending";
  }

  input.state.transitionRetryAt = null;

  const nextMessageIdByTurnIndex = resolveMessageIdByTurnIndex(sourceOrResult);
  const changedTurnIndexes = resolveChangedTurnIndexes(input.state, nextMessageIdByTurnIndex);
  const deltaMessageIds = resolveDeltaMessageIdsByChangedTurns(
    nextMessageIdByTurnIndex,
    changedTurnIndexes
  );

  const shouldCaptureSnapshot = !input.state.hasInitialSnapshotCaptured;
  const shouldCaptureDelta =
    input.state.hasInitialSnapshotCaptured && changedTurnIndexes.length > 0;
  let captureResult: Awaited<ReturnType<typeof captureConversationSource>> | undefined;

  if (shouldCaptureSnapshot || shouldCaptureDelta) {
    const captureSource = shouldCaptureSnapshot
      ? sourceOrResult
      : selectSourceByMessageIds(sourceOrResult, new Set<TrackedMessageId>(deltaMessageIds));
    const captureMode = shouldCaptureSnapshot ? "snapshot" : "delta";
    captureResult = await captureConversationSource(
      captureSource,
      captureMode,
      sourceOrResult.assistantGenerating,
      input.sendRuntimeMessage
    );

    if (captureResult === "snapshot-required") {
      resetConversationSyncState(input.state);

      const replayResult = await captureConversationSource(
        sourceOrResult,
        "snapshot",
        sourceOrResult.assistantGenerating,
        input.sendRuntimeMessage
      );
      if (replayResult !== "sent") {
        return replayResult;
      }
    } else if (captureResult !== "sent") {
      return captureResult;
    }
  }

  input.state.hasInitialSnapshotCaptured = true;
  input.state.lastCommittedConversationId = sourceOrResult.conversation.id;
  input.state.lastCommittedScopeIds = new Set(sourceOrResult.collectionMeta.scopeIds);
  replacePreviousMessageIdByTurnIndex(input.state, nextMessageIdByTurnIndex);
  if (shouldCaptureSnapshot || captureResult === "snapshot-required") {
    requestTimestampsFromMain(
      sourceOrResult,
      input.state,
      input.postMainMessage,
      input.targetOrigin
    );
  } else {
    requestTimestampsFromMain(
      sourceOrResult,
      input.state,
      input.postMainMessage,
      input.targetOrigin,
      deltaMessageIds
    );
  }
  return "sent";
}

export async function relayMainTimestampPayload(input: {
  event: { source: unknown; origin: string; data: unknown };
  currentWindow: unknown;
  currentOrigin: string;
  sendRuntimeMessage: RuntimeSendMessage;
  state: SourceSyncState;
  now?: () => number;
}): Promise<ApplyResult> {
  if (input.event.source !== input.currentWindow || input.event.origin !== input.currentOrigin) {
    return "ignored";
  }

  const now = typeof input.now === "function" ? input.now() : Date.now();
  pruneExpiredTimestampRequests(input.state, now);

  const timestampPayload = toTimestampPayloadMessage(input.event.data);
  if (timestampPayload === null) {
    return "ignored";
  }

  const pending = input.state.pendingTimestampRequests.get(timestampPayload.requestId);
  if (!pending) {
    return "ignored";
  }

  if (pending.expiresAt <= now) {
    input.state.pendingTimestampRequests.delete(timestampPayload.requestId);
    return "ignored";
  }

  if (timestampPayload.conversationId !== pending.conversationId) {
    input.state.pendingTimestampRequests.delete(timestampPayload.requestId);
    return "ignored";
  }

  if (timestampPayload.payload.length !== pending.messageIds.size) {
    input.state.pendingTimestampRequests.delete(timestampPayload.requestId);
    return "ignored";
  }

  const seenIds = new Set<TrackedMessageId>();
  for (const item of timestampPayload.payload) {
    if (!isTrackedMessageId(item.id) || !pending.messageIds.has(item.id) || seenIds.has(item.id)) {
      input.state.pendingTimestampRequests.delete(timestampPayload.requestId);
      return "ignored";
    }
    seenIds.add(item.id);
  }

  input.state.pendingTimestampRequests.delete(timestampPayload.requestId);

  const requestId = createRuntimeRequestId("apply");
  const request = createApplyTimestampsRequest(
    requestId,
    timestampPayload.conversationId,
    timestampPayload.source,
    toRuntimeTimestampMappings(timestampPayload.payload)
  );
  if (!isApplyTimestampsRequest(request)) {
    return "ignored";
  }

  const tsPayload: TimestampPayload = {
    conversationId: timestampPayload.conversationId,
    payload: timestampPayload.payload
  };

  let response: unknown;
  try {
    response = await input.sendRuntimeMessage(request);
  } catch {
    markPayloadFailureState(tsPayload, input.state, now);
    return "failed";
  }
  if (isApplyTimestampsSuccess(response) && response.requestId === requestId) {
    markPayloadSuccessState(tsPayload, input.state, now);
    return "accepted";
  }
  if (isApplyTimestampsFailure(response) && response.requestId === requestId) {
    markPayloadFailureState(tsPayload, input.state, now);
    return "failed";
  }
  markPayloadFailureState(tsPayload, input.state, now);
  return "failed";
}

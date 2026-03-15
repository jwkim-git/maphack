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
  collectChatgptSourceData,
  resolveChatgptConversationOriginalId
} from "../../infra/providers/chatgpt/domParser";
import { resolveChatgptCaptureScope } from "../../infra/providers/chatgpt/threadScope";
import { resolveProviderIdByHostname } from "../../infra/providers/index";

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
type TrackedMessageId = ChatgptSourceData["messageRefs"][number]["id"];
type RequestState = { status: "unresolved" | "resolved"; retryAt: number; retryAttempt: number };
type PendingTimestampRequest = {
  conversationId: string;
  messageIds: Set<TrackedMessageId>;
  expiresAt: number;
};
type SourceSyncState = {
  activeConversationId: string | null;
  requestStateByMessageId: Map<TrackedMessageId, RequestState>;
  previousMessageIdByTurnIndex: Map<number, TrackedMessageId>;
  hasInitialSnapshotCaptured: boolean;
  lastCommittedConversationId: string | null;
  lastCommittedScopeIds: Set<string>;
  transitionRetryAt: number | null;
  pendingTimestampRequests: Map<string, PendingTimestampRequest>;
};

const TIMESTAMP_RETRY_BACKOFF_MS = [1_000, 2_000, 3_000] as const;
const TRANSITION_STABILIZATION_RETRY_MS = 120;
const TIMESTAMP_REQUEST_TTL_MS = 5_000;
const MAPHACK_MESSAGE_ID_PREFIX = "mh-msg-";

function createRuntimeRequestId(scope: "capture" | "apply"): string {
  return `mh-req:${scope}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

export function bootstrapSourceSyncState(): SourceSyncState {
  return {
    activeConversationId: null,
    requestStateByMessageId: new Map<TrackedMessageId, RequestState>(),
    previousMessageIdByTurnIndex: new Map<number, TrackedMessageId>(),
    hasInitialSnapshotCaptured: false,
    lastCommittedConversationId: null,
    lastCommittedScopeIds: new Set<string>(),
    transitionRetryAt: null,
    pendingTimestampRequests: new Map<string, PendingTimestampRequest>()
  };
}

function resetConversationSyncState(state: SourceSyncState): void {
  state.requestStateByMessageId.clear();
  state.previousMessageIdByTurnIndex.clear();
  state.hasInitialSnapshotCaptured = false;
  state.transitionRetryAt = null;
  state.pendingTimestampRequests.clear();
}

function syncConversationIdState(nextConversationId: string, state: SourceSyncState): void {
  if (state.activeConversationId === nextConversationId) {
    return;
  }

  state.activeConversationId = nextConversationId;
  resetConversationSyncState(state);
}

function resolveSourceData(
  hostname: string,
  root: Document,
  conversationUrl: string,
  state: SourceSyncState
): ChatgptSourceData | "provider-unsupported" | "source-unavailable" | "transition-pending" {
  if (resolveProviderIdByHostname(hostname) !== "chatgpt") {
    return "provider-unsupported";
  }

  const conversationOriginalId = resolveChatgptConversationOriginalId({ root, conversationUrl });
  if (!conversationOriginalId) {
    return "source-unavailable";
  }

  const conversationId = `mh-conv-${conversationOriginalId}` as ChatgptSourceData["conversation"]["id"];
  syncConversationIdState(conversationId, state);

  const captureScope = resolveChatgptCaptureScope(root);
  if (!captureScope) {
    state.transitionRetryAt = Date.now() + TRANSITION_STABILIZATION_RETRY_MS;
    return "transition-pending";
  }

  return collectChatgptSourceData({ root, conversationUrl, captureScope }) ?? "source-unavailable";
}

function resolveMessageIdByTurnIndex(source: ChatgptSourceData): Map<number, TrackedMessageId> {
  const next = new Map<number, TrackedMessageId>();
  for (const messageRef of source.messageRefs) {
    next.set(messageRef.metadata.turnIndex, messageRef.id);
  }
  return next;
}

function replacePreviousMessageIdByTurnIndex(
  state: SourceSyncState,
  nextMessageIdByTurnIndex: Map<number, TrackedMessageId>
): void {
  state.previousMessageIdByTurnIndex.clear();
  for (const [turnIndex, messageId] of nextMessageIdByTurnIndex.entries()) {
    state.previousMessageIdByTurnIndex.set(turnIndex, messageId);
  }
}

function resolveChangedTurnIndexes(
  state: SourceSyncState,
  nextMessageIdByTurnIndex: Map<number, TrackedMessageId>
): number[] {
  if (!state.hasInitialSnapshotCaptured) {
    return Array.from(nextMessageIdByTurnIndex.keys());
  }

  const changedTurnIndexes: number[] = [];
  for (const [turnIndex, messageId] of nextMessageIdByTurnIndex.entries()) {
    if (state.previousMessageIdByTurnIndex.get(turnIndex) === messageId) {
      continue;
    }
    changedTurnIndexes.push(turnIndex);
  }
  return changedTurnIndexes;
}

function resolveDeltaMessageIdsByChangedTurns(
  nextMessageIdByTurnIndex: Map<number, TrackedMessageId>,
  changedTurnIndexes: readonly number[]
): TrackedMessageId[] {
  const deltaMessageIds: TrackedMessageId[] = [];
  for (const turnIndex of changedTurnIndexes) {
    const messageId = nextMessageIdByTurnIndex.get(turnIndex);
    if (!messageId) {
      continue;
    }
    deltaMessageIds.push(messageId);
  }
  return deltaMessageIds;
}

function selectSourceByMessageIds(
  source: ChatgptSourceData,
  messageIds: Set<TrackedMessageId>
): ChatgptSourceData {
  const messageRefs = source.messageRefs.filter((messageRef) => messageIds.has(messageRef.id));
  return {
    conversation: source.conversation,
    messageRefs,
    collectionMeta: {
      scopeIds: messageRefs.map((messageRef) => messageRef.metadata.originalId)
    }
  };
}

async function captureConversationSource(
  source: ChatgptSourceData,
  captureMode: "snapshot" | "delta",
  sendRuntimeMessage: RuntimeSendMessage
): Promise<"payload-invalid" | "capture-failed" | "snapshot-required" | "sent"> {
  const requestId = createRuntimeRequestId("capture");
  const request = createCaptureConversationRequest(
    requestId,
    toRuntimeConversationSource(source),
    captureMode
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

function resolveNextRetryDelayMs(previous: RequestState | undefined): number {
  const nextAttempt = previous
    ? Math.min(previous.retryAttempt + 1, TIMESTAMP_RETRY_BACKOFF_MS.length - 1)
    : 0;
  return TIMESTAMP_RETRY_BACKOFF_MS[nextAttempt];
}

function toNextUnresolvedState(now: number, previous: RequestState | undefined): RequestState {
  const nextAttempt = previous
    ? Math.min(previous.retryAttempt + 1, TIMESTAMP_RETRY_BACKOFF_MS.length - 1)
    : 0;
  return {
    status: "unresolved",
    retryAttempt: nextAttempt,
    retryAt: now + resolveNextRetryDelayMs(previous)
  };
}

function toResolvedState(): RequestState {
  return {
    status: "resolved",
    retryAt: Number.POSITIVE_INFINITY,
    retryAttempt: 0
  };
}

function isTrackedMessageId(value: string): value is TrackedMessageId {
  return value.startsWith(MAPHACK_MESSAGE_ID_PREFIX);
}

function createTimestampRequestId(): string {
  return `mh-ts:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function pruneExpiredTimestampRequests(state: SourceSyncState, now: number): void {
  for (const [requestId, request] of state.pendingTimestampRequests.entries()) {
    if (request.expiresAt <= now) {
      state.pendingTimestampRequests.delete(requestId);
    }
  }
}

function collectPendingMessageIds(state: SourceSyncState, now: number): Set<TrackedMessageId> {
  const pendingIds = new Set<TrackedMessageId>();

  for (const request of state.pendingTimestampRequests.values()) {
    if (request.expiresAt <= now) {
      continue;
    }

    for (const messageId of request.messageIds) {
      pendingIds.add(messageId);
    }
  }

  return pendingIds;
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

  const liveIds = new Set(source.messageRefs.map((messageRef) => messageRef.id));
  for (const trackedId of state.requestStateByMessageId.keys()) {
    if (!liveIds.has(trackedId)) {
      state.requestStateByMessageId.delete(trackedId);
    }
  }

  const now = Date.now();
  const pendingMessageIds = collectPendingMessageIds(state, now);
  const dueUnresolvedIds = Array.from(state.requestStateByMessageId.entries())
    .filter(
      ([id, requestState]) =>
        liveIds.has(id) &&
        requestState.status === "unresolved" &&
        requestState.retryAt <= now
    )
    .map(([id]) => id);

  const messageIds: TrackedMessageId[] = [];
  const appended = new Set<TrackedMessageId>();
  for (const id of [...priorityMessageIds, ...dueUnresolvedIds]) {
    if (!liveIds.has(id) || appended.has(id) || pendingMessageIds.has(id)) {
      continue;
    }

    const current = state.requestStateByMessageId.get(id);
    if (current && (current.status !== "unresolved" || current.retryAt > now)) {
      continue;
    }

    messageIds.push(id);
    appended.add(id);
  }

  if (messageIds.length === 0) {
    return;
  }

  const requestId = createTimestampRequestId();
  const request = {
    type: TIMESTAMP_PULL_REQUEST_TYPE,
    signature: TIMESTAMP_PULL_REQUEST_SIGNATURE,
    schema: TIMESTAMP_MESSAGE_SCHEMA,
    requestId,
    conversationId: source.conversation.id,
    messageIds
  };
  if (toTimestampPullRequestMessage(request) === null) {
    return;
  }

  postMainMessage(request, targetOrigin);
  state.pendingTimestampRequests.set(requestId, {
    conversationId: source.conversation.id,
    messageIds: new Set(messageIds),
    expiresAt: now + TIMESTAMP_REQUEST_TTL_MS
  });
  for (const messageId of messageIds) {
    const previous = state.requestStateByMessageId.get(messageId);
    state.requestStateByMessageId.set(messageId, toNextUnresolvedState(now, previous));
  }
}

function markPayloadSuccessState(
  payload: NonNullable<ReturnType<typeof toTimestampPayloadMessage>>,
  state: SourceSyncState,
  now: number
): void {
  if (state.activeConversationId !== payload.conversationId) {
    return;
  }

  for (const item of payload.payload) {
    if (!isTrackedMessageId(item.id)) {
      continue;
    }

    const previous = state.requestStateByMessageId.get(item.id);
    state.requestStateByMessageId.set(
      item.id,
      item.createTime === null ? toNextUnresolvedState(now, previous) : toResolvedState()
    );
  }
}

function markPayloadFailureState(
  payload: NonNullable<ReturnType<typeof toTimestampPayloadMessage>>,
  state: SourceSyncState,
  now: number
): void {
  if (state.activeConversationId !== payload.conversationId) {
    return;
  }

  for (const item of payload.payload) {
    if (!isTrackedMessageId(item.id)) {
      continue;
    }

    const previous = state.requestStateByMessageId.get(item.id);
    state.requestStateByMessageId.set(item.id, toNextUnresolvedState(now, previous));
  }
}

function hasLastCommittedScopeOverlap(source: ChatgptSourceData, state: SourceSyncState): boolean {
  if (state.lastCommittedConversationId === source.conversation.id) {
    return false;
  }

  return source.collectionMeta.scopeIds.some((originalId) => state.lastCommittedScopeIds.has(originalId));
}

export async function syncResolvedConversationSource(input: {
  hostname: string;
  conversationUrl: string;
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
    input.conversationUrl,
    input.state
  );
  if (sourceOrResult === "transition-pending") {
    return "transition-pending";
  }

  if (typeof sourceOrResult === "string") {
    input.state.transitionRetryAt = null;
    return sourceOrResult;
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
  let priorityMessageIds: readonly TrackedMessageId[] = deltaMessageIds;

  if (shouldCaptureSnapshot || shouldCaptureDelta) {
    const captureSource = shouldCaptureSnapshot
      ? sourceOrResult
      : selectSourceByMessageIds(sourceOrResult, new Set<TrackedMessageId>(deltaMessageIds));
    const captureMode = shouldCaptureSnapshot ? "snapshot" : "delta";
    const captureResult = await captureConversationSource(
      captureSource,
      captureMode,
      input.sendRuntimeMessage
    );

    if (captureResult === "snapshot-required") {
      input.state.requestStateByMessageId.clear();
      input.state.previousMessageIdByTurnIndex.clear();
      input.state.hasInitialSnapshotCaptured = false;
      input.state.pendingTimestampRequests.clear();

      const replayResult = await captureConversationSource(
        sourceOrResult,
        "snapshot",
        input.sendRuntimeMessage
      );
      if (replayResult !== "sent") {
        return replayResult;
      }

      priorityMessageIds = sourceOrResult.messageRefs.map((messageRef) => messageRef.id);
    } else if (captureResult !== "sent") {
      return captureResult;
    }
  }

  input.state.hasInitialSnapshotCaptured = true;
  input.state.lastCommittedConversationId = sourceOrResult.conversation.id;
  input.state.lastCommittedScopeIds = new Set(sourceOrResult.collectionMeta.scopeIds);
  replacePreviousMessageIdByTurnIndex(input.state, nextMessageIdByTurnIndex);
  requestTimestampsFromMain(
    sourceOrResult,
    input.state,
    input.postMainMessage,
    input.targetOrigin,
    priorityMessageIds
  );
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

  let response: unknown;
  try {
    response = await input.sendRuntimeMessage(request);
  } catch {
    markPayloadFailureState(timestampPayload, input.state, now);
    return "failed";
  }
  if (isApplyTimestampsSuccess(response) && response.requestId === requestId) {
    markPayloadSuccessState(timestampPayload, input.state, now);
    return "accepted";
  }
  if (isApplyTimestampsFailure(response) && response.requestId === requestId) {
    markPayloadFailureState(timestampPayload, input.state, now);
    return "failed";
  }
  markPayloadFailureState(timestampPayload, input.state, now);
  return "failed";
}

import type { SourceSyncState, TrackedMessageId, RequestState } from "./state";
import { isTrackedMessageId } from "./state";

export interface TimestampPayload {
  conversationId: string;
  payload: ReadonlyArray<{ id: string; createTime: number | null }>;
}

export const TIMESTAMP_RETRY_BACKOFF_MS = [1_000, 2_000, 3_000] as const;
export const TIMESTAMP_REQUEST_TTL_MS = 5_000;

function resolveNextRetryDelayMs(previous: RequestState | undefined): number {
  const nextAttempt = previous
    ? Math.min(previous.retryAttempt + 1, TIMESTAMP_RETRY_BACKOFF_MS.length - 1)
    : 0;
  return TIMESTAMP_RETRY_BACKOFF_MS[nextAttempt];
}

export function toNextUnresolvedState(now: number, previous: RequestState | undefined): RequestState {
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

export function createTimestampRequestId(): string {
  return `mh-ts:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

export function pruneExpiredTimestampRequests(state: SourceSyncState, now: number): void {
  for (const [requestId, request] of state.pendingTimestampRequests.entries()) {
    if (request.expiresAt <= now) {
      state.pendingTimestampRequests.delete(requestId);
    }
  }
}

export function collectPendingMessageIds(state: SourceSyncState, now: number): Set<TrackedMessageId> {
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

export function markPayloadSuccessState(
  payload: TimestampPayload,
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

export function markPayloadFailureState(
  payload: TimestampPayload,
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

export function resolveTimestampRequestCandidates(
  liveMessageIds: Set<TrackedMessageId>,
  priorityMessageIds: readonly TrackedMessageId[],
  state: SourceSyncState,
  now: number
): TrackedMessageId[] {
  for (const trackedId of state.requestStateByMessageId.keys()) {
    if (!liveMessageIds.has(trackedId)) {
      state.requestStateByMessageId.delete(trackedId);
    }
  }

  const pendingMessageIds = collectPendingMessageIds(state, now);
  const dueUnresolvedIds = Array.from(state.requestStateByMessageId.entries())
    .filter(
      ([id, requestState]) =>
        liveMessageIds.has(id) &&
        requestState.status === "unresolved" &&
        requestState.retryAt <= now
    )
    .map(([id]) => id);

  const messageIds: TrackedMessageId[] = [];
  const appended = new Set<TrackedMessageId>();
  for (const id of [...priorityMessageIds, ...dueUnresolvedIds]) {
    if (!liveMessageIds.has(id) || appended.has(id) || pendingMessageIds.has(id)) {
      continue;
    }

    const current = state.requestStateByMessageId.get(id);
    if (current && (current.status !== "unresolved" || current.retryAt > now)) {
      continue;
    }

    messageIds.push(id);
    appended.add(id);
  }

  return messageIds;
}

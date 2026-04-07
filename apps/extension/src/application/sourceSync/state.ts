import { isMapHackMessageId } from "../../../../../packages/core/src/domain/value/MapHackMessageId";

export type TrackedMessageId = string;
type RequestState = { status: "unresolved" | "resolved"; retryAt: number; retryAttempt: number };
type PendingTimestampRequest = {
  conversationId: string;
  messageIds: Set<TrackedMessageId>;
  expiresAt: number;
};

export type SourceSyncState = {
  activeConversationId: string | null;
  requestStateByMessageId: Map<TrackedMessageId, RequestState>;
  previousMessageIdByTurnIndex: Map<number, TrackedMessageId>;
  hasInitialSnapshotCaptured: boolean;
  lastCommittedConversationId: string | null;
  lastCommittedScopeIds: Set<string>;
  transitionRetryAt: number | null;
  pendingTimestampRequests: Map<string, PendingTimestampRequest>;
  lastAssistantContentForStabilization: string | null;
};

export { type RequestState, type PendingTimestampRequest };

export function bootstrapSourceSyncState(): SourceSyncState {
  return {
    activeConversationId: null,
    requestStateByMessageId: new Map<TrackedMessageId, RequestState>(),
    previousMessageIdByTurnIndex: new Map<number, TrackedMessageId>(),
    hasInitialSnapshotCaptured: false,
    lastCommittedConversationId: null,
    lastCommittedScopeIds: new Set<string>(),
    transitionRetryAt: null,
    pendingTimestampRequests: new Map<string, PendingTimestampRequest>(),
    lastAssistantContentForStabilization: null
  };
}

export function resetConversationSyncState(state: SourceSyncState): void {
  state.requestStateByMessageId.clear();
  state.previousMessageIdByTurnIndex.clear();
  state.hasInitialSnapshotCaptured = false;
  state.transitionRetryAt = null;
  state.pendingTimestampRequests.clear();
  state.lastAssistantContentForStabilization = null;
}

export function syncConversationIdState(nextConversationId: string, state: SourceSyncState): void {
  if (state.activeConversationId === nextConversationId) {
    return;
  }

  state.activeConversationId = nextConversationId;
  resetConversationSyncState(state);
}

export function isTrackedMessageId(value: string): boolean {
  return isMapHackMessageId(value);
}

export function createRuntimeRequestId(scope: "capture" | "apply"): string {
  return `mh-req:${scope}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

import type { SourceSyncState } from "./state";
import type { SourceWithCollectionMeta } from "./resolveChangedTurnIndexes";

export const TRANSITION_STABILIZATION_RETRY_MS = 120;

export function hasLastCommittedScopeOverlap(source: SourceWithCollectionMeta, state: SourceSyncState): boolean {
  if (state.lastCommittedConversationId === source.conversation.id) {
    return false;
  }

  return source.collectionMeta.scopeIds.some((originalId) => state.lastCommittedScopeIds.has(originalId));
}

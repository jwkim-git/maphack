import type { TrackedMessageId, SourceSyncState } from "./state";

export interface SourceWithCollectionMeta {
  conversation: { id: string };
  messageRefs: ReadonlyArray<{
    id: string;
    metadata: { originalId: string; turnIndex: number; turnIndexSource: "primary" | "fallback" };
  }>;
  collectionMeta: { scopeIds: readonly string[] };
}

export function resolveMessageIdByTurnIndex(source: SourceWithCollectionMeta): Map<number, TrackedMessageId> {
  const next = new Map<number, TrackedMessageId>();
  for (const messageRef of source.messageRefs) {
    if (messageRef.metadata.turnIndexSource === "fallback") {
      continue;
    }
    next.set(messageRef.metadata.turnIndex, messageRef.id);
  }
  return next;
}

export function replacePreviousMessageIdByTurnIndex(
  state: SourceSyncState,
  nextMessageIdByTurnIndex: Map<number, TrackedMessageId>
): void {
  state.previousMessageIdByTurnIndex.clear();
  for (const [turnIndex, messageId] of nextMessageIdByTurnIndex.entries()) {
    state.previousMessageIdByTurnIndex.set(turnIndex, messageId);
  }
}

export function resolveChangedTurnIndexes(
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

export function resolveDeltaMessageIdsByChangedTurns(
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

export function selectSourceByMessageIds<T extends SourceWithCollectionMeta>(
  source: T,
  messageIds: Set<TrackedMessageId>
): T {
  const messageRefs = source.messageRefs.filter((messageRef) => messageIds.has(messageRef.id));
  return {
    ...source,
    messageRefs,
    collectionMeta: {
      scopeIds: messageRefs.map((messageRef) => messageRef.metadata.originalId)
    }
  };
}

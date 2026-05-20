import type {
  TrackedMessageId,
  TrackedMessageProjection,
  SourceSyncState
} from "./state";

export interface SourceWithCollectionMeta {
  conversation: { id: string };
  messageRefs: ReadonlyArray<{
    id: string;
    preview: string;
    metadata: { originalId: string; turnIndex: number; turnIndexSource: "primary" | "fallback" };
  }>;
  collectionMeta: { scopeIds: readonly string[] };
}

export function resolveMessageProjectionByTurnIndex(
  source: SourceWithCollectionMeta
): Map<number, TrackedMessageProjection> {
  const next = new Map<number, TrackedMessageProjection>();
  for (const messageRef of source.messageRefs) {
    if (messageRef.metadata.turnIndexSource === "fallback") {
      continue;
    }
    next.set(messageRef.metadata.turnIndex, {
      messageId: messageRef.id,
      preview: messageRef.preview
    });
  }
  return next;
}

export function replacePreviousMessageProjectionByTurnIndex(
  state: SourceSyncState,
  nextMessageProjectionByTurnIndex: Map<number, TrackedMessageProjection>
): void {
  state.previousMessageProjectionByTurnIndex.clear();
  for (const [turnIndex, projection] of nextMessageProjectionByTurnIndex.entries()) {
    state.previousMessageProjectionByTurnIndex.set(turnIndex, projection);
  }
}

export function resolveChangedTurnIndexes(
  state: SourceSyncState,
  nextMessageProjectionByTurnIndex: Map<number, TrackedMessageProjection>
): number[] {
  if (!state.hasInitialSnapshotCaptured) {
    return Array.from(nextMessageProjectionByTurnIndex.keys());
  }

  const allTurnIndexes = new Set<number>([
    ...state.previousMessageProjectionByTurnIndex.keys(),
    ...nextMessageProjectionByTurnIndex.keys()
  ]);

  const changedTurnIndexes: number[] = [];
  for (const turnIndex of allTurnIndexes) {
    const previous = state.previousMessageProjectionByTurnIndex.get(turnIndex);
    const next = nextMessageProjectionByTurnIndex.get(turnIndex);
    if (sameProjection(previous, next)) {
      continue;
    }
    changedTurnIndexes.push(turnIndex);
  }
  return changedTurnIndexes;
}

export function resolveDeltaMessageIdsByChangedTurns(
  nextMessageProjectionByTurnIndex: Map<number, TrackedMessageProjection>,
  changedTurnIndexes: readonly number[]
): TrackedMessageId[] {
  const deltaMessageIds: TrackedMessageId[] = [];
  for (const turnIndex of changedTurnIndexes) {
    const projection = nextMessageProjectionByTurnIndex.get(turnIndex);
    if (!projection) {
      continue;
    }
    deltaMessageIds.push(projection.messageId);
  }
  return deltaMessageIds;
}

function sameProjection(
  left: TrackedMessageProjection | undefined,
  right: TrackedMessageProjection | undefined
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  return left.messageId === right.messageId && left.preview === right.preview;
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

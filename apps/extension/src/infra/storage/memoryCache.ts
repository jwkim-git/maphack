import type {
  CaptureMode,
  ConversationSource,
  ConversationSourcePort
} from "../../../../../packages/core/src/application/ports/ConversationSourcePort";
import type {
  TimestampMapping,
  TimestampPort,
  TimestampSource
} from "../../../../../packages/core/src/application/ports/TimestampPort";
import type { MessageRef } from "../../../../../packages/core/src/domain/entities/MessageRef";
import type { MapHackConversationId } from "../../../../../packages/core/src/domain/value/MapHackConversationId";

type StoredSource = {
  source: ConversationSource;
  timestampSourceByMessageId: Map<MessageRef["id"], TimestampSource>;
};

function cloneMessageRef(messageRef: MessageRef): MessageRef {
  return {
    ...messageRef,
    metadata: {
      ...messageRef.metadata
    }
  };
}

function cloneSource(source: ConversationSource): ConversationSource {
  return {
    conversation: {
      ...source.conversation,
      metadata: {
        ...source.conversation.metadata
      }
    },
    messageRefs: source.messageRefs.map(cloneMessageRef)
  };
}

function recalculateConversationTimestampBounds(source: ConversationSource): void {
  const timestamps = source.messageRefs
    .map((messageRef) => messageRef.timestamp)
    .filter((timestamp): timestamp is number => timestamp !== null);

  if (timestamps.length === 0) {
    source.conversation.createdAt = null;
    source.conversation.updatedAt = null;
    return;
  }

  source.conversation.createdAt = Math.min(...timestamps);
  source.conversation.updatedAt = Math.max(...timestamps);
}

export class MemoryConversationSourceCache implements ConversationSourcePort, TimestampPort {
  private readonly sourceByConversationId = new Map<MapHackConversationId, StoredSource>();

  private persistSource(
    conversationId: MapHackConversationId,
    source: ConversationSource,
    timestampSourceByMessageId: Map<MessageRef["id"], TimestampSource>
  ): void {
    recalculateConversationTimestampBounds(source);
    this.sourceByConversationId.set(conversationId, {
      source,
      timestampSourceByMessageId
    });
  }

  async upsert(source: ConversationSource, captureMode: CaptureMode): Promise<void> {
    if (captureMode === "snapshot") {
      await this.applySnapshotUpsert(source);
      return;
    }

    await this.applyDeltaUpsert(source);
  }

  async hasConversationSource(conversationId: MapHackConversationId): Promise<boolean> {
    return this.sourceByConversationId.has(conversationId);
  }

  private async applySnapshotUpsert(source: ConversationSource): Promise<void> {
    const nextSource = cloneSource(source);
    const stored = this.sourceByConversationId.get(source.conversation.id);
    const previousByMessageId = new Map<MessageRef["id"], MessageRef>();
    if (stored) {
      for (const messageRef of stored.source.messageRefs) {
        previousByMessageId.set(messageRef.id, messageRef);
      }
    }

    for (const messageRef of nextSource.messageRefs) {
      const previous = previousByMessageId.get(messageRef.id);
      if (previous && messageRef.timestamp === null && previous.timestamp !== null) {
        messageRef.timestamp = previous.timestamp;
      }
    }

    nextSource.messageRefs.sort((left, right) => left.metadata.turnIndex - right.metadata.turnIndex);

    const nextTimestampSourceByMessageId = new Map<MessageRef["id"], TimestampSource>();
    if (stored) {
      for (const messageRef of nextSource.messageRefs) {
        const previousSource = stored.timestampSourceByMessageId.get(messageRef.id);
        if (previousSource !== undefined) {
          nextTimestampSourceByMessageId.set(messageRef.id, previousSource);
        }
      }
    }

    this.persistSource(source.conversation.id, nextSource, nextTimestampSourceByMessageId);
  }

  private async applyDeltaUpsert(source: ConversationSource): Promise<void> {
    const stored = this.sourceByConversationId.get(source.conversation.id);
    if (!stored) {
      throw new Error("snapshot-required");
    }

    const deltaSource = cloneSource(source);
    const nextSource = cloneSource(stored.source);
    nextSource.conversation = {
      ...nextSource.conversation,
      ...deltaSource.conversation,
      metadata: {
        ...nextSource.conversation.metadata,
        ...deltaSource.conversation.metadata
      }
    };

    const previousByMessageId = new Map<MessageRef["id"], MessageRef>();
    for (const messageRef of stored.source.messageRefs) {
      previousByMessageId.set(messageRef.id, messageRef);
    }

    const mergedMessageRefByTurnIndex = new Map<number, MessageRef>();
    for (const messageRef of nextSource.messageRefs) {
      mergedMessageRefByTurnIndex.set(messageRef.metadata.turnIndex, messageRef);
    }

    for (const messageRef of deltaSource.messageRefs) {
      const previous = previousByMessageId.get(messageRef.id);
      if (previous && messageRef.timestamp === null && previous.timestamp !== null) {
        messageRef.timestamp = previous.timestamp;
      }
    }

    for (const messageRef of deltaSource.messageRefs) {
      mergedMessageRefByTurnIndex.set(messageRef.metadata.turnIndex, messageRef);
    }

    nextSource.messageRefs = Array.from(mergedMessageRefByTurnIndex.values());
    nextSource.messageRefs.sort((left, right) => left.metadata.turnIndex - right.metadata.turnIndex);

    const nextTimestampSourceByMessageId = new Map<MessageRef["id"], TimestampSource>();
    for (const messageRef of nextSource.messageRefs) {
      const previousSource = stored.timestampSourceByMessageId.get(messageRef.id);
      if (previousSource !== undefined) {
        nextTimestampSourceByMessageId.set(messageRef.id, previousSource);
      }
    }

    this.persistSource(source.conversation.id, nextSource, nextTimestampSourceByMessageId);
  }

  async listByConversationId(conversationId: MapHackConversationId): Promise<MessageRef[]> {
    const stored = this.sourceByConversationId.get(conversationId);
    if (!stored) {
      return [];
    }

    return stored.source.messageRefs.map(cloneMessageRef);
  }

  async countUnresolvedByConversationId(conversationId: MapHackConversationId): Promise<number> {
    const stored = this.sourceByConversationId.get(conversationId);
    if (!stored) {
      return 0;
    }

    let unresolvedCount = 0;
    for (const messageRef of stored.source.messageRefs) {
      if (messageRef.timestamp === null) {
        unresolvedCount += 1;
      }
    }

    return unresolvedCount;
  }

  async apply(
    conversationId: MapHackConversationId,
    source: TimestampSource,
    mappings: TimestampMapping[]
  ): Promise<void> {
    const stored = this.sourceByConversationId.get(conversationId);
    if (!stored) {
      return;
    }

    const nextSource = cloneSource(stored.source);
    const nextTimestampSourceByMessageId = new Map<MessageRef["id"], TimestampSource>(
      stored.timestampSourceByMessageId
    );
    const messageRefById = new Map<MessageRef["id"], MessageRef>();
    for (const messageRef of nextSource.messageRefs) {
      messageRefById.set(messageRef.id, messageRef);
    }

    let hasAppliedUpdate = false;

    for (const mapping of mappings) {
      if (mapping.timestamp === null) {
        continue;
      }

      const messageRef = messageRefById.get(mapping.messageId as MessageRef["id"]);
      if (!messageRef) {
        continue;
      }

      const currentSource = nextTimestampSourceByMessageId.get(messageRef.id);

      if (messageRef.timestamp === mapping.timestamp && currentSource === source) {
        continue;
      }

      messageRef.timestamp = mapping.timestamp;
      nextTimestampSourceByMessageId.set(messageRef.id, source);
      hasAppliedUpdate = true;
    }

    if (!hasAppliedUpdate) {
      return;
    }

    this.persistSource(conversationId, nextSource, nextTimestampSourceByMessageId);
  }
}

import type {
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

function getTimestampSourceRank(source: TimestampSource | undefined): number {
  if (source === "fiber") {
    return 2;
  }
  if (source === "json" || source === "stream") {
    return 1;
  }
  return 0;
}

function shouldApplyTimestamp(
  currentSource: TimestampSource | undefined,
  incomingSource: TimestampSource
): boolean {
  return getTimestampSourceRank(incomingSource) >= getTimestampSourceRank(currentSource);
}

export class MemoryConversationSourceCache implements ConversationSourcePort, TimestampPort {
  private readonly sourceByConversationId = new Map<MapHackConversationId, StoredSource>();

  async upsert(source: ConversationSource): Promise<void> {
    const nextSource = cloneSource(source);
    const stored = this.sourceByConversationId.get(source.conversation.id);
    const nextTimestampSourceByMessageId = new Map<MessageRef["id"], TimestampSource>();

    if (stored) {
      const previousByMessageId = new Map<MessageRef["id"], MessageRef>();
      for (const messageRef of stored.source.messageRefs) {
        previousByMessageId.set(messageRef.id, messageRef);
      }

      for (const messageRef of nextSource.messageRefs) {
        const previous = previousByMessageId.get(messageRef.id);
        if (previous && messageRef.timestamp === null && previous.timestamp !== null) {
          messageRef.timestamp = previous.timestamp;
        }

        const previousSource = stored.timestampSourceByMessageId.get(messageRef.id);
        if (previousSource !== undefined) {
          nextTimestampSourceByMessageId.set(messageRef.id, previousSource);
        }
      }
    }

    recalculateConversationTimestampBounds(nextSource);
    this.sourceByConversationId.set(source.conversation.id, {
      source: nextSource,
      timestampSourceByMessageId: nextTimestampSourceByMessageId
    });
  }

  async listByConversationId(conversationId: MapHackConversationId): Promise<MessageRef[]> {
    const stored = this.sourceByConversationId.get(conversationId);
    if (!stored) {
      return [];
    }

    return stored.source.messageRefs.map(cloneMessageRef);
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
      if (!shouldApplyTimestamp(currentSource, source)) {
        continue;
      }

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

    recalculateConversationTimestampBounds(nextSource);
    this.sourceByConversationId.set(conversationId, {
      source: nextSource,
      timestampSourceByMessageId: nextTimestampSourceByMessageId
    });
  }
}

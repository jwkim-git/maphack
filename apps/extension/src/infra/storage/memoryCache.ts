import type {
  ConversationSource,
  ConversationSourcePort
} from "../../../../../packages/core/src/application/ports/ConversationSourcePort";
import type {
  TimestampApplyResult,
  TimestampMapping,
  TimestampPort,
  TimestampSource
} from "../../../../../packages/core/src/application/ports/TimestampPort";
import { applyTimestampMappings } from "../../../../../packages/core/src/application/policies/applyTimestampMappings";
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

export class MemoryConversationSourceCache implements ConversationSourcePort, TimestampPort {
  private readonly sourceByConversationId = new Map<MapHackConversationId, StoredSource>();

  async get(conversationId: MapHackConversationId): Promise<ConversationSource | null> {
    const stored = this.sourceByConversationId.get(conversationId);
    if (!stored) {
      return null;
    }
    return cloneSource(stored.source);
  }

  async save(conversationId: MapHackConversationId, source: ConversationSource): Promise<void> {
    const nextSource = cloneSource(source);
    const stored = this.sourceByConversationId.get(conversationId);

    const nextTimestampSourceByMessageId = new Map<MessageRef["id"], TimestampSource>();
    if (stored) {
      for (const messageRef of nextSource.messageRefs) {
        const previousSource = stored.timestampSourceByMessageId.get(messageRef.id);
        if (previousSource !== undefined) {
          nextTimestampSourceByMessageId.set(messageRef.id, previousSource);
        }
      }
    }

    this.sourceByConversationId.set(conversationId, {
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
  ): Promise<TimestampApplyResult> {
    const stored = this.sourceByConversationId.get(conversationId);
    if (!stored) {
      return { kind: "source-missing" };
    }

    const effectiveMappings: TimestampMapping[] = [];
    for (const mapping of mappings) {
      if (mapping.timestamp === null) {
        continue;
      }

      const currentSource = stored.timestampSourceByMessageId.get(
        mapping.messageId as MessageRef["id"]
      );
      const currentRef = stored.source.messageRefs.find(
        (ref) => ref.id === (mapping.messageId as MessageRef["id"])
      );

      if (currentRef && currentRef.timestamp === mapping.timestamp && currentSource === source) {
        continue;
      }

      effectiveMappings.push(mapping);
    }

    if (effectiveMappings.length === 0) {
      return { kind: "unchanged" };
    }

    const nextSource = cloneSource(stored.source);
    const result = applyTimestampMappings(nextSource, effectiveMappings);
    if (result === null) {
      return { kind: "unchanged" };
    }

    const nextTimestampSourceByMessageId = new Map<MessageRef["id"], TimestampSource>(
      stored.timestampSourceByMessageId
    );
    for (const messageId of result.appliedMessageIds) {
      nextTimestampSourceByMessageId.set(messageId as MessageRef["id"], source);
    }

    this.sourceByConversationId.set(conversationId, {
      source: result.updated,
      timestampSourceByMessageId: nextTimestampSourceByMessageId
    });

    return { kind: "updated" };
  }
}

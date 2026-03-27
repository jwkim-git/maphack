import type { CaptureMode, ConversationSource } from "../ports/ConversationSourcePort";
import type { MessageRef } from "../../domain/entities/MessageRef";

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

function preserveTimestamps(
  targetRefs: MessageRef[],
  storedRefsByMessageId: Map<MessageRef["id"], MessageRef>
): void {
  for (const messageRef of targetRefs) {
    const previous = storedRefsByMessageId.get(messageRef.id);
    if (previous && messageRef.timestamp === null && previous.timestamp !== null) {
      messageRef.timestamp = previous.timestamp;
    }
  }
}

function mergeSnapshot(
  stored: ConversationSource | null,
  incoming: ConversationSource
): ConversationSource {
  const storedRefsByMessageId = new Map<MessageRef["id"], MessageRef>();
  if (stored) {
    for (const messageRef of stored.messageRefs) {
      storedRefsByMessageId.set(messageRef.id, messageRef);
    }
  }

  preserveTimestamps(incoming.messageRefs, storedRefsByMessageId);
  incoming.messageRefs.sort((left, right) => left.metadata.turnIndex - right.metadata.turnIndex);
  recalculateConversationTimestampBounds(incoming);

  return incoming;
}

function mergeDelta(
  stored: ConversationSource,
  incoming: ConversationSource
): ConversationSource {
  const storedRefsByMessageId = new Map<MessageRef["id"], MessageRef>();
  for (const messageRef of stored.messageRefs) {
    storedRefsByMessageId.set(messageRef.id, messageRef);
  }

  preserveTimestamps(incoming.messageRefs, storedRefsByMessageId);

  const mergedByTurnIndex = new Map<number, MessageRef>();
  for (const messageRef of stored.messageRefs) {
    mergedByTurnIndex.set(messageRef.metadata.turnIndex, messageRef);
  }
  for (const messageRef of incoming.messageRefs) {
    if (messageRef.metadata.turnIndexSource === "fallback") {
      continue;
    }
    mergedByTurnIndex.set(messageRef.metadata.turnIndex, messageRef);
  }

  const result: ConversationSource = {
    conversation: {
      ...stored.conversation,
      ...incoming.conversation,
      metadata: {
        ...stored.conversation.metadata,
        ...incoming.conversation.metadata
      }
    },
    messageRefs: Array.from(mergedByTurnIndex.values())
  };

  result.messageRefs.sort((left, right) => left.metadata.turnIndex - right.metadata.turnIndex);
  recalculateConversationTimestampBounds(result);

  return result;
}

export function mergeConversationSource(
  stored: ConversationSource | null,
  incoming: ConversationSource,
  mode: CaptureMode
): ConversationSource {
  if (mode === "delta") {
    if (stored === null) {
      throw new Error("snapshot-required");
    }
    return mergeDelta(stored, incoming);
  }

  return mergeSnapshot(stored, incoming);
}

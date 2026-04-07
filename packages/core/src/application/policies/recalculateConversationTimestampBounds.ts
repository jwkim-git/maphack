import type { ConversationSource } from "../ports/ConversationSourcePort";

export function recalculateConversationTimestampBounds(source: ConversationSource): void {
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

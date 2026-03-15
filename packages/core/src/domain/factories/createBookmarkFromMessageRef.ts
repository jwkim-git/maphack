import type { Bookmark } from "../entities/Bookmark";
import type { MessageRef } from "../entities/MessageRef";
import type { MapHackBookmarkId } from "../value/MapHackBookmarkId";

export function createBookmarkFromMessageRef(
  messageRef: MessageRef,
  createdAtSeconds: number
): Bookmark {
  const messageId = messageRef.id;

  return {
    id: `bm-${messageRef.conversationId}-${messageId}` as MapHackBookmarkId,
    conversationId: messageRef.conversationId,
    messageId,
    timestamp: messageRef.timestamp,
    turnIndex: messageRef.metadata.turnIndex,
    messagePreview: messageRef.preview,
    messageRole: messageRef.role,
    conversationUrl: messageRef.conversationUrl,
    platform: messageRef.platform,
    createdAt: createdAtSeconds,
    edited: false
  };
}

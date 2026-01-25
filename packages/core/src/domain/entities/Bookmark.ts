import type { MapHackBookmarkId } from "../value/MapHackBookmarkId";
import type { MapHackConversationId } from "../value/MapHackConversationId";
import type { MapHackMessageId } from "../value/MapHackMessageId";
import type { MessageRole } from "./Message";

export interface Bookmark {
  id: MapHackBookmarkId;
  conversationId: MapHackConversationId;
  messageId: MapHackMessageId;
  timestamp: number;
  turnIndex: number;
  messagePreview: string;
  messageRole: MessageRole;
  conversationUrl: string;
  platform: string;
  createdAt: number;
}

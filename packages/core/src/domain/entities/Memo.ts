import type { MapHackConversationId } from "../value/MapHackConversationId";
import type { MapHackMemoId } from "../value/MapHackMemoId";
import type { MapHackMessageId } from "../value/MapHackMessageId";
import type { MessageRole } from "./Message";

export interface Memo {
  id: MapHackMemoId;
  conversationId: MapHackConversationId;
  messageId: MapHackMessageId;
  content: string;
  timestamp: number;
  turnIndex: number;
  messagePreview: string;
  messageRole: MessageRole;
  conversationUrl: string;
  platform: string;
  createdAt: number;
  updatedAt: number;
}

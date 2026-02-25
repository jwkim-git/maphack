import type { MapHackTagId } from "../value/MapHackTagId";
import type { MapHackConversationId } from "../value/MapHackConversationId";
import type { MapHackMessageId } from "../value/MapHackMessageId";
import type { MessageRole } from "./MessageRole";

export interface Tag {
  id: MapHackTagId;
  conversationId: MapHackConversationId;
  messageId: MapHackMessageId;
  tagName: string;
  timestamp: number | null;
  turnIndex: number;
  messagePreview: string;
  messageRole: MessageRole;
  conversationUrl: string;
  platform: string;
  createdAt: number;
}

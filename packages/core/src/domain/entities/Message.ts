import type { MapHackConversationId } from "../value/MapHackConversationId";
import type { MapHackMessageId } from "../value/MapHackMessageId";

export type MessageRole = "user" | "assistant";

export interface Message {
  id: MapHackMessageId;
  conversationId: MapHackConversationId;
  role: MessageRole;
  content: string;
  timestamp: string;
  platform: string;
  conversationUrl: string;
  metadata: {
    originalId: string;
    turnIndex: number;
  };
}

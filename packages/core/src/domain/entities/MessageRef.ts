import type { MapHackConversationId } from "../value/MapHackConversationId";
import type { MapHackMessageRefId } from "../value/MapHackMessageRefId";
import type { MessageRole } from "./MessageRole";

export interface MessageRef {
  id: MapHackMessageRefId;
  conversationId: MapHackConversationId;
  role: MessageRole;
  preview: string;
  timestamp: number | null;
  platform: string;
  conversationUrl: string;
  metadata: {
    originalId: string;
    turnIndex: number;
  };
}

import type { MapHackConversationId } from "../value/MapHackConversationId";
import type { MapHackMessageId } from "../value/MapHackMessageId";
import type { MessageRole } from "./MessageRole";

// Reserved for future full-text/search phase.
// Message is not part of the current Phase 1 SourceData transport/storage path.

export interface Message {
  id: MapHackMessageId;
  conversationId: MapHackConversationId;
  role: MessageRole;
  content: string;
  timestamp: number | null;
  platform: string;
  conversationUrl: string;
  metadata: {
    originalId: string;
    turnIndex: number;
  };
}

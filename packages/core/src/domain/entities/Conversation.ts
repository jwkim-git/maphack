import type { MapHackConversationId } from "../value/MapHackConversationId";
import type { Message } from "./Message";

export interface Conversation {
  id: MapHackConversationId;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  platform: string;
  metadata: {
    originalId: string;
    url: string;
  };
}

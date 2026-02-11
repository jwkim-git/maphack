import type { MapHackConversationId } from "../value/MapHackConversationId";
import type { Message } from "./Message";

export interface Conversation {
  id: MapHackConversationId;
  messages: Message[];
  createdAt: number | null;
  updatedAt: number | null;
  platform: string;
  metadata: {
    originalId: string;
    url: string;
  };
}

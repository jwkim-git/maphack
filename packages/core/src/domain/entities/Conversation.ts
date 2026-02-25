import type { MapHackConversationId } from "../value/MapHackConversationId";

export interface Conversation {
  id: MapHackConversationId;
  createdAt: number | null;
  updatedAt: number | null;
  platform: string;
  metadata: {
    originalId: string;
    url: string;
  };
}

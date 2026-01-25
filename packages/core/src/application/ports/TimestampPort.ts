import type { MapHackConversationId } from "../../domain/value/MapHackConversationId";
import type { MapHackMessageId } from "../../domain/value/MapHackMessageId";

export interface TimestampMapping {
  messageId: MapHackMessageId;
  timestamp: string;
}

export interface TimestampPort {
  apply(
    conversationId: MapHackConversationId,
    mappings: TimestampMapping[]
  ): Promise<void>;
}

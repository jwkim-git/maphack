import type { MapHackConversationId } from "../../domain/value/MapHackConversationId";
import type { MapHackMessageId } from "../../domain/value/MapHackMessageId";

export type TimestampSource = "fiber";

export interface TimestampMapping {
  messageId: MapHackMessageId;
  timestamp: number | null;
}

export interface TimestampPort {
  apply(
    conversationId: MapHackConversationId,
    source: TimestampSource,
    mappings: TimestampMapping[]
  ): Promise<void>;
}

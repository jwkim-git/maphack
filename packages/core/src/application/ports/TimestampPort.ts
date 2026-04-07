import type { MapHackConversationId } from "../../domain/value/MapHackConversationId";
import type { MapHackMessageId } from "../../domain/value/MapHackMessageId";

export type TimestampSource = string;

export interface TimestampMapping {
  messageId: MapHackMessageId;
  timestamp: number | null;
}

export type TimestampApplyResult =
  | { kind: "updated" }
  | { kind: "unchanged" }
  | { kind: "source-missing" };

export interface TimestampPort {
  apply(
    conversationId: MapHackConversationId,
    source: TimestampSource,
    mappings: TimestampMapping[]
  ): Promise<TimestampApplyResult>;
}

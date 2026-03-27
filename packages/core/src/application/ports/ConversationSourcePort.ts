import type { Conversation } from "../../domain/entities/Conversation";
import type { MessageRef } from "../../domain/entities/MessageRef";
import type { MapHackConversationId } from "../../domain/value/MapHackConversationId";

// Phase 1 contract: SourceData is conversation metadata + MessageRef list.
// Full message content, if needed later, should be introduced via a separate port/event.
export interface ConversationSource {
  conversation: Conversation;
  messageRefs: MessageRef[];
}

export type CaptureMode = "snapshot" | "delta";

export interface ConversationSourcePort {
  get(conversationId: MapHackConversationId): Promise<ConversationSource | null>;
  save(conversationId: MapHackConversationId, source: ConversationSource): Promise<void>;
  listByConversationId(conversationId: MapHackConversationId): Promise<MessageRef[]>;
}

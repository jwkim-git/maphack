import type { Conversation } from "../../domain/entities/Conversation";
import type { MessageRef } from "../../domain/entities/MessageRef";

export interface ConversationSource {
  conversation: Conversation;
  messageRefs: MessageRef[];
}

export interface ConversationSourcePort {
  upsert(source: ConversationSource): Promise<void>;
}

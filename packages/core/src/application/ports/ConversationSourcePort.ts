import type { Conversation } from "../../domain/entities/Conversation";
import type { Message } from "../../domain/entities/Message";
import type { MessageRef } from "../../domain/entities/MessageRef";

export interface ConversationSource {
  conversation: Conversation;
  messages: Message[];
  messageRefs: MessageRef[];
}

export interface ConversationSourcePort {
  upsert(source: ConversationSource): Promise<void>;
}

import type { MessageRef } from "../../domain/entities/MessageRef";
import type { MapHackConversationId } from "../../domain/value/MapHackConversationId";
import type { ConversationSourcePort } from "../ports/ConversationSourcePort";

export interface ListBaseMessagesCommand {
  conversationId: MapHackConversationId;
}

export interface ListBaseMessagesResult {
  messageRefs: MessageRef[];
}

export class ListBaseMessages {
  constructor(private readonly sourcePort: ConversationSourcePort) {}

  async execute(command: ListBaseMessagesCommand): Promise<ListBaseMessagesResult> {
    const messageRefs = await this.sourcePort.listByConversationId(command.conversationId);
    return { messageRefs };
  }
}

import type { MessageRef } from "../../domain/entities/MessageRef";
import type { MapHackConversationId } from "../../domain/value/MapHackConversationId";
import type { ConversationSourcePort } from "../ports/ConversationSourcePort";

export interface ListBaseMessagesCommand {
  conversationId: MapHackConversationId;
}

export type ListBaseMessagesResult =
  | {
      status: "available";
      messageRefs: MessageRef[];
    }
  | {
      status: "source-missing";
    };

export class ListBaseMessages {
  constructor(private readonly sourcePort: ConversationSourcePort) {}

  async execute(command: ListBaseMessagesCommand): Promise<ListBaseMessagesResult> {
    const hasSource = await this.sourcePort.hasConversationSource(command.conversationId);
    if (!hasSource) {
      return { status: "source-missing" };
    }

    const messageRefs = await this.sourcePort.listByConversationId(command.conversationId);
    return {
      status: "available",
      messageRefs
    };
  }
}

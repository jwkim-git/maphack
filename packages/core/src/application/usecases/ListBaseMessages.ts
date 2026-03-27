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
    const source = await this.sourcePort.get(command.conversationId);
    if (source === null) {
      return { status: "source-missing" };
    }

    return {
      status: "available",
      messageRefs: source.messageRefs
    };
  }
}

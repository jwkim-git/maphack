import type { ConversationSource } from "../ports/ConversationSourcePort";
import type { ConversationSourcePort } from "../ports/ConversationSourcePort";
import type { MessagingPort } from "../ports/MessagingPort";

export interface CaptureConversationCommand {
  source: ConversationSource;
}

export class CaptureConversation {
  constructor(
    private readonly sourcePort: ConversationSourcePort,
    private readonly messagingPort: MessagingPort
  ) {}

  async execute(command: CaptureConversationCommand): Promise<void> {
    await this.sourcePort.upsert(command.source);
    await this.messagingPort.publish({
      type: "source-upserted",
      source: command.source
    });
  }
}

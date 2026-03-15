import type { ConversationSource } from "../ports/ConversationSourcePort";
import type { CaptureMode } from "../ports/ConversationSourcePort";
import type { ConversationSourcePort } from "../ports/ConversationSourcePort";

export interface CaptureConversationCommand {
  source: ConversationSource;
  captureMode: CaptureMode;
}

export class CaptureConversation {
  constructor(private readonly sourcePort: ConversationSourcePort) {}

  async execute(command: CaptureConversationCommand): Promise<void> {
    await this.sourcePort.upsert(command.source, command.captureMode);
  }
}

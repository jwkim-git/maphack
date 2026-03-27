import type { ConversationSource } from "../ports/ConversationSourcePort";
import type { CaptureMode } from "../ports/ConversationSourcePort";
import type { ConversationSourcePort } from "../ports/ConversationSourcePort";
import { mergeConversationSource } from "../policies/mergeConversationSource";

export interface CaptureConversationCommand {
  source: ConversationSource;
  captureMode: CaptureMode;
}

export class CaptureConversation {
  constructor(private readonly sourcePort: ConversationSourcePort) {}

  async execute(command: CaptureConversationCommand): Promise<void> {
    const stored = await this.sourcePort.get(command.source.conversation.id);
    const merged = mergeConversationSource(stored, command.source, command.captureMode);
    await this.sourcePort.save(command.source.conversation.id, merged);
  }
}

import type { MessageRef } from "../../domain/entities/MessageRef";
import type { Bookmark } from "../../domain/entities/Bookmark";
import { createBookmarkFromMessageRef } from "../../domain/factories/createBookmarkFromMessageRef";
import type { ConversationSourcePort } from "../ports/ConversationSourcePort";
import type { UserDataBookmarkPort } from "../ports/UserDataBookmarkPort";

export interface AddBookmarkCommand {
  messageRef: MessageRef;
}

export class AddBookmark {
  constructor(
    private readonly bookmarkPort: UserDataBookmarkPort,
    private readonly sourcePort: Pick<ConversationSourcePort, "listByConversationId">
  ) {}

  async execute(command: AddBookmarkCommand): Promise<Bookmark> {
    const resolvedRef = await this.resolveMessageRef(command.messageRef);
    const createdAtSeconds = Math.floor(Date.now() / 1000);
    const bookmark = createBookmarkFromMessageRef(resolvedRef, createdAtSeconds);

    await this.bookmarkPort.upsert(bookmark);
    return bookmark;
  }

  private async resolveMessageRef(requestRef: MessageRef): Promise<MessageRef> {
    try {
      const cachedRefs = await this.sourcePort.listByConversationId(requestRef.conversationId);
      const match = cachedRefs.find((ref) => ref.id === requestRef.id);
      return match ?? requestRef;
    } catch {
      return requestRef;
    }
  }
}

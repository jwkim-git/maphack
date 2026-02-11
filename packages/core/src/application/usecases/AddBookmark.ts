import type { MessageRef } from "../../domain/entities/MessageRef";
import { createBookmarkFromMessageRef } from "../../domain/factories/createBookmarkFromMessageRef";
import type { MessagingPort } from "../ports/MessagingPort";
import type { UserDataBookmarkPort } from "../ports/UserDataBookmarkPort";

export interface AddBookmarkCommand {
  messageRef: MessageRef;
}

export class AddBookmark {
  constructor(
    private readonly bookmarkPort: UserDataBookmarkPort,
    private readonly messagingPort: MessagingPort
  ) {}

  async execute(command: AddBookmarkCommand): Promise<void> {
    const createdAtSeconds = Math.floor(Date.now() / 1000);
    const bookmark = createBookmarkFromMessageRef(command.messageRef, createdAtSeconds);

    await this.bookmarkPort.upsert(bookmark);
    await this.messagingPort.publish({
      type: "bookmark-added",
      bookmark
    });
  }
}

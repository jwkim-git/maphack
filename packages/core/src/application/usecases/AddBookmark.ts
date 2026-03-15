import type { MessageRef } from "../../domain/entities/MessageRef";
import type { Bookmark } from "../../domain/entities/Bookmark";
import { createBookmarkFromMessageRef } from "../../domain/factories/createBookmarkFromMessageRef";
import type { UserDataBookmarkPort } from "../ports/UserDataBookmarkPort";

export interface AddBookmarkCommand {
  messageRef: MessageRef;
}

export class AddBookmark {
  constructor(private readonly bookmarkPort: UserDataBookmarkPort) {}

  async execute(command: AddBookmarkCommand): Promise<Bookmark> {
    const createdAtSeconds = Math.floor(Date.now() / 1000);
    const bookmark = createBookmarkFromMessageRef(command.messageRef, createdAtSeconds);

    await this.bookmarkPort.upsert(bookmark);
    return bookmark;
  }
}

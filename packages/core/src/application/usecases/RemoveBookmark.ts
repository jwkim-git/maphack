import type { MapHackBookmarkId } from "../../domain/value/MapHackBookmarkId";
import type { MessagingPort } from "../ports/MessagingPort";
import type { UserDataBookmarkPort } from "../ports/UserDataBookmarkPort";

export interface RemoveBookmarkCommand {
  bookmarkId: MapHackBookmarkId;
}

export class RemoveBookmark {
  constructor(
    private readonly bookmarkPort: UserDataBookmarkPort,
    private readonly messagingPort: MessagingPort
  ) {}

  async execute(command: RemoveBookmarkCommand): Promise<void> {
    await this.bookmarkPort.remove(command.bookmarkId);
    await this.messagingPort.publish({
      type: "bookmark-removed",
      bookmarkId: command.bookmarkId
    });
  }
}

import type { MapHackBookmarkId } from "../../domain/value/MapHackBookmarkId";
import type { UserDataBookmarkPort } from "../ports/UserDataBookmarkPort";

export interface RemoveBookmarkCommand {
  bookmarkId: MapHackBookmarkId;
}

export class RemoveBookmark {
  constructor(private readonly bookmarkPort: UserDataBookmarkPort) {}

  async execute(command: RemoveBookmarkCommand): Promise<void> {
    await this.bookmarkPort.remove(command.bookmarkId);
  }
}

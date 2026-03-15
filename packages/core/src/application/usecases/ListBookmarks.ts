import type { Bookmark } from "../../domain/entities/Bookmark";
import type { UserDataBookmarkPort } from "../ports/UserDataBookmarkPort";

export interface ListBookmarksResult {
  bookmarks: Bookmark[];
}

export class ListBookmarks {
  constructor(private readonly bookmarkPort: UserDataBookmarkPort) {}

  async execute(): Promise<ListBookmarksResult> {
    const bookmarks = await this.bookmarkPort.list();
    return { bookmarks };
  }
}

import type { Bookmark } from "../../domain/entities/Bookmark";
import type { MapHackBookmarkId } from "../../domain/value/MapHackBookmarkId";

export interface UserDataBookmarkPort {
  upsert(bookmark: Bookmark): Promise<void>;
  remove(bookmarkId: MapHackBookmarkId): Promise<void>;
  list(): Promise<Bookmark[]>;
  listByConversationId(conversationId: Bookmark["conversationId"]): Promise<Bookmark[]>;
  updateEdited(bookmarkId: MapHackBookmarkId, edited: boolean): Promise<void>;
}

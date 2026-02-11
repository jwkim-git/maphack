import type { Bookmark } from "../../domain/entities/Bookmark";
import type { Memo } from "../../domain/entities/Memo";
import type { Tag } from "../../domain/entities/Tag";
import type { MapHackBookmarkId } from "../../domain/value/MapHackBookmarkId";
import type { MapHackMemoId } from "../../domain/value/MapHackMemoId";
import type { MapHackTagId } from "../../domain/value/MapHackTagId";
import type { ConversationSource } from "./ConversationSourcePort";

export type MessagingEvent =
  | { type: "source-upserted"; source: ConversationSource }
  | { type: "bookmark-added"; bookmark: Bookmark }
  | { type: "bookmark-removed"; bookmarkId: MapHackBookmarkId }
  | { type: "tag-added"; tag: Tag }
  | { type: "tag-removed"; tagId: MapHackTagId }
  | { type: "memo-added"; memo: Memo }
  | { type: "memo-updated"; memo: Memo }
  | { type: "memo-deleted"; memoId: MapHackMemoId };

export interface MessagingPort {
  publish(event: MessagingEvent): Promise<void>;
}

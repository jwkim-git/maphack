import type { Bookmark } from "../../domain/entities/Bookmark";
import type { MessageRef } from "../../domain/entities/MessageRef";
import type { MapHackBookmarkId } from "../../domain/value/MapHackBookmarkId";

export function resolveBookmarkTimestampBackfillPatches(
  messageRefs: MessageRef[],
  bookmarks: Bookmark[]
): Array<{ bookmarkId: MapHackBookmarkId; nextTimestamp: number }> {
  const timestampByMessageId = new Map<string, number>();
  for (const ref of messageRefs) {
    if (typeof ref.timestamp === "number") {
      timestampByMessageId.set(ref.id, ref.timestamp);
    }
  }

  const patches: Array<{ bookmarkId: MapHackBookmarkId; nextTimestamp: number }> = [];

  for (const bookmark of bookmarks) {
    if (bookmark.timestamp !== null) {
      continue;
    }

    const ts = timestampByMessageId.get(bookmark.messageId);
    if (ts === undefined) {
      continue;
    }

    patches.push({ bookmarkId: bookmark.id, nextTimestamp: ts });
  }

  return patches;
}

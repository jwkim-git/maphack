import type { Bookmark } from "../../domain/entities/Bookmark";
import type { MessageRef } from "../../domain/entities/MessageRef";
import type { MapHackBookmarkId } from "../../domain/value/MapHackBookmarkId";

export function resolveBookmarkEditedPatches(
  messageRefs: MessageRef[],
  bookmarks: Bookmark[]
): Array<{ bookmarkId: MapHackBookmarkId; nextEdited: boolean }> {
  const liveMessageIds = new Set<string>();
  for (const messageRef of messageRefs) {
    liveMessageIds.add(messageRef.id);
  }

  const patches: Array<{ bookmarkId: MapHackBookmarkId; nextEdited: boolean }> = [];

  for (const bookmark of bookmarks) {
    const nextEdited = !liveMessageIds.has(bookmark.messageId);
    if (bookmark.edited === nextEdited) {
      continue;
    }

    patches.push({ bookmarkId: bookmark.id, nextEdited });
  }

  return patches;
}

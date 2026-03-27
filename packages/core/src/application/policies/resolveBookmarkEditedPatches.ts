import type { Bookmark } from "../../domain/entities/Bookmark";
import type { MessageRef } from "../../domain/entities/MessageRef";
import type { MapHackBookmarkId } from "../../domain/value/MapHackBookmarkId";

export function resolveBookmarkEditedPatches(
  messageRefs: MessageRef[],
  bookmarks: Bookmark[]
): Array<{ bookmarkId: MapHackBookmarkId; nextEdited: boolean }> {
  const latestMessageIdByTurnIndex = new Map<number, string>();
  for (const messageRef of messageRefs) {
    if (messageRef.metadata.turnIndexSource === "fallback") {
      continue;
    }
    latestMessageIdByTurnIndex.set(messageRef.metadata.turnIndex, messageRef.id);
  }

  const patches: Array<{ bookmarkId: MapHackBookmarkId; nextEdited: boolean }> = [];

  for (const bookmark of bookmarks) {
    const latestMessageId = latestMessageIdByTurnIndex.get(bookmark.turnIndex);
    if (latestMessageId === undefined) {
      continue;
    }

    const nextEdited = latestMessageId !== bookmark.messageId;
    if (bookmark.edited === nextEdited) {
      continue;
    }

    patches.push({ bookmarkId: bookmark.id, nextEdited });
  }

  return patches;
}

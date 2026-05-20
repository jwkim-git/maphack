import type { Bookmark } from "../../domain/entities/Bookmark";
import type { MessageRef } from "../../domain/entities/MessageRef";
import type { MapHackBookmarkId } from "../../domain/value/MapHackBookmarkId";

export function resolveBookmarkPreviewPatches(
  messageRefs: MessageRef[],
  bookmarks: Bookmark[]
): Array<{ bookmarkId: MapHackBookmarkId; nextMessagePreview: string }> {
  const previewByMessageId = new Map<string, string>();
  for (const messageRef of messageRefs) {
    previewByMessageId.set(messageRef.id, messageRef.preview);
  }

  const patches: Array<{ bookmarkId: MapHackBookmarkId; nextMessagePreview: string }> = [];

  for (const bookmark of bookmarks) {
    const nextMessagePreview = previewByMessageId.get(bookmark.messageId);
    if (nextMessagePreview === undefined || bookmark.messagePreview === nextMessagePreview) {
      continue;
    }

    patches.push({ bookmarkId: bookmark.id, nextMessagePreview });
  }

  return patches;
}

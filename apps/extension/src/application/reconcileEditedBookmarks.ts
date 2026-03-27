import type { ConversationSourcePort } from "../../../../packages/core/src/application/ports/ConversationSourcePort";
import type { UserDataBookmarkPort } from "../../../../packages/core/src/application/ports/UserDataBookmarkPort";
import { resolveBookmarkEditedPatches } from "../../../../packages/core/src/application/policies/resolveBookmarkEditedPatches";
import type { MapHackConversationId } from "../../../../packages/core/src/domain/value/MapHackConversationId";

export async function reconcileEditedBookmarks(
  conversationId: string,
  sourceStore: Pick<ConversationSourcePort, "listByConversationId">,
  bookmarkStore: Pick<UserDataBookmarkPort, "listByConversationId" | "updateEdited">
): Promise<void> {
  const [messageRefs, bookmarks] = await Promise.all([
    sourceStore.listByConversationId(conversationId as MapHackConversationId),
    bookmarkStore.listByConversationId(conversationId as MapHackConversationId)
  ]);

  const patches = resolveBookmarkEditedPatches(messageRefs, bookmarks);
  for (const patch of patches) {
    await bookmarkStore.updateEdited(patch.bookmarkId, patch.nextEdited);
  }
}

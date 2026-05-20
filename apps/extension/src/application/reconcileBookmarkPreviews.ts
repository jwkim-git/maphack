import type { ConversationSourcePort } from "../../../../packages/core/src/application/ports/ConversationSourcePort";
import type { UserDataBookmarkPort } from "../../../../packages/core/src/application/ports/UserDataBookmarkPort";
import { resolveBookmarkPreviewPatches } from "../../../../packages/core/src/application/policies/resolveBookmarkPreviewPatches";
import type { MapHackConversationId } from "../../../../packages/core/src/domain/value/MapHackConversationId";

export async function reconcileBookmarkPreviews(
  conversationId: MapHackConversationId,
  sourceStore: Pick<ConversationSourcePort, "listByConversationId">,
  bookmarkStore: Pick<UserDataBookmarkPort, "listByConversationId" | "updateMessagePreview">
): Promise<{ updatedCount: number }> {
  const [messageRefs, bookmarks] = await Promise.all([
    sourceStore.listByConversationId(conversationId),
    bookmarkStore.listByConversationId(conversationId)
  ]);

  const patches = resolveBookmarkPreviewPatches(messageRefs, bookmarks);
  for (const patch of patches) {
    await bookmarkStore.updateMessagePreview(patch.bookmarkId, patch.nextMessagePreview);
  }

  return { updatedCount: patches.length };
}

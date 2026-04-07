import type { ConversationSourcePort } from "../../../../packages/core/src/application/ports/ConversationSourcePort";
import type { UserDataBookmarkPort } from "../../../../packages/core/src/application/ports/UserDataBookmarkPort";
import { resolveBookmarkTimestampBackfillPatches } from "../../../../packages/core/src/application/policies/resolveBookmarkTimestampBackfillPatches";
import type { MapHackConversationId } from "../../../../packages/core/src/domain/value/MapHackConversationId";

export async function reconcileBookmarkTimestamps(
  conversationId: MapHackConversationId,
  sourceStore: Pick<ConversationSourcePort, "listByConversationId">,
  bookmarkStore: Pick<UserDataBookmarkPort, "listByConversationId" | "updateTimestamp">
): Promise<{ updatedCount: number }> {
  const [messageRefs, bookmarks] = await Promise.all([
    sourceStore.listByConversationId(conversationId),
    bookmarkStore.listByConversationId(conversationId)
  ]);

  const patches = resolveBookmarkTimestampBackfillPatches(messageRefs, bookmarks);
  for (const patch of patches) {
    await bookmarkStore.updateTimestamp(patch.bookmarkId, patch.nextTimestamp);
  }

  return { updatedCount: patches.length };
}

import type { MapHackConversationId } from "./MapHackConversationId";
import type { MapHackMessageId } from "./MapHackMessageId";

export type MapHackBookmarkId = `bm-${MapHackConversationId}-${MapHackMessageId}`;

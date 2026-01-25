import type { MapHackConversationId } from "./MapHackConversationId";
import type { MapHackMessageId } from "./MapHackMessageId";

export type MapHackMemoId = `memo-${MapHackConversationId}-${MapHackMessageId}`;

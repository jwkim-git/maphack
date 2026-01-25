import type { MapHackConversationId } from "./MapHackConversationId";
import type { MapHackMessageId } from "./MapHackMessageId";

export type MapHackTagId = `tag-${MapHackConversationId}-${MapHackMessageId}-${string}`;

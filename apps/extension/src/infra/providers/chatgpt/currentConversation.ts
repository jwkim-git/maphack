import type { MapHackConversationId } from "../../../../../../packages/core/src/domain/value/MapHackConversationId";
import { toMapHackConversationId } from "../../../../../../packages/core/src/domain/value/MapHackConversationId";
import { resolveChatgptConversationOriginalId } from "../../../application/chatgpt/resolveChatgptConversationOriginalId";

export interface CurrentChatgptConversation {
  id: MapHackConversationId;
  originalId: string;
  url: string;
}

export function readCurrentChatgptConversation(): CurrentChatgptConversation | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const canonicalElement = document.querySelector('link[rel="canonical"]');
  const canonicalHref =
    canonicalElement instanceof HTMLLinkElement ? canonicalElement.href : null;

  const url = window.location.href;
  const pathname = window.location.pathname;
  const originalId = resolveChatgptConversationOriginalId({
    conversationUrl: url,
    pathname,
    canonicalHref
  });

  if (originalId === null) {
    return null;
  }

  return {
    id: toMapHackConversationId(originalId),
    originalId,
    url
  };
}

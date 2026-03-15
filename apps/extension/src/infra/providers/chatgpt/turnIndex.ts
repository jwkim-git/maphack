import {
  CHATGPT_MESSAGE_CONTAINER_FALLBACKS,
  CHATGPT_MESSAGE_CONTAINER_PRIMARY
} from "./selectors";

export const CHATGPT_TURN_INDEX_ARTICLE_SELECTOR = "article";
export const CHATGPT_TURN_INDEX_ARTICLE_TEST_ID_ATTRIBUTE = "data-testid";
export const CHATGPT_TURN_INDEX_DESCENDANT_SELECTOR = '[data-testid^="conversation-turn-"]';
export const CHATGPT_TURN_INDEX_DESCENDANT_TEST_ID_ATTRIBUTE = "data-testid";
export const CHATGPT_TURN_INDEX_TEST_ID_PATTERN = /conversation-turn-(\d+)/;
const MAPHACK_MESSAGE_ID_PREFIX = "mh-msg-";

function normalizeAttribute(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function toOriginalMessageId(messageId: string): string | null {
  if (!messageId.startsWith(MAPHACK_MESSAGE_ID_PREFIX)) {
    return messageId.length > 0 ? messageId : null;
  }

  const originalId = messageId.slice(MAPHACK_MESSAGE_ID_PREFIX.length);
  return originalId.length > 0 ? originalId : null;
}

export function parseChatgptTurnIndexFromElement(
  element: Element,
  fallbackIndex: number
): number {
  const fromArticle = normalizeAttribute(
    element.closest(CHATGPT_TURN_INDEX_ARTICLE_SELECTOR)?.getAttribute(
      CHATGPT_TURN_INDEX_ARTICLE_TEST_ID_ATTRIBUTE
    )
  );
  const articleMatch = fromArticle.match(CHATGPT_TURN_INDEX_TEST_ID_PATTERN);
  if (articleMatch) {
    return Number.parseInt(articleMatch[1], 10);
  }

  const descendant = element.querySelector(CHATGPT_TURN_INDEX_DESCENDANT_SELECTOR);
  const fromDescendant = normalizeAttribute(
    descendant?.getAttribute(CHATGPT_TURN_INDEX_DESCENDANT_TEST_ID_ATTRIBUTE)
  );
  const descendantMatch = fromDescendant.match(CHATGPT_TURN_INDEX_TEST_ID_PATTERN);
  if (descendantMatch) {
    return Number.parseInt(descendantMatch[1], 10);
  }

  return fallbackIndex;
}

export function findChatgptTurnElementByTurnIndex(
  root: ParentNode,
  turnIndex: number
): Element | null {
  const selectors = [
    CHATGPT_MESSAGE_CONTAINER_PRIMARY,
    ...CHATGPT_MESSAGE_CONTAINER_FALLBACKS
  ];
  const seen = new Set<Element>();

  for (const selector of selectors) {
    const candidates = Array.from(root.querySelectorAll(selector));
    for (const candidate of candidates) {
      if (seen.has(candidate)) {
        continue;
      }

      seen.add(candidate);
      if (parseChatgptTurnIndexFromElement(candidate, -1) !== turnIndex) {
        continue;
      }

      return candidate.closest(CHATGPT_TURN_INDEX_ARTICLE_SELECTOR) ?? candidate;
    }
  }

  return null;
}

export function findChatgptTurnElementByMessageId(
  root: ParentNode,
  messageId: string
): Element | null {
  const originalMessageId = toOriginalMessageId(messageId);
  if (!originalMessageId) {
    return null;
  }

  const exactMessageElement =
    root.querySelector(`[data-message-id="${originalMessageId}"]`) ??
    root.querySelector(`[data-turn-id="${originalMessageId}"]`);

  if (!exactMessageElement) {
    return null;
  }

  return exactMessageElement.closest(CHATGPT_TURN_INDEX_ARTICLE_SELECTOR) ?? exactMessageElement;
}

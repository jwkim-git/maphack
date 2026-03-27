import {
  isMapHackMessageId,
  toOriginalMessageId
} from "../../../../../../packages/core/src/domain/value/MapHackMessageId";
import {
  CHATGPT_MESSAGE_CONTAINER_FALLBACKS,
  CHATGPT_MESSAGE_CONTAINER_PRIMARY
} from "./selectors";

export const CHATGPT_TURN_CONTAINER_SELECTOR = '[data-testid^="conversation-turn-"]';
export const CHATGPT_TURN_CONTAINER_TEST_ID_ATTRIBUTE = "data-testid";
export const CHATGPT_TURN_INDEX_DESCENDANT_SELECTOR = '[data-testid^="conversation-turn-"]';
export const CHATGPT_TURN_INDEX_DESCENDANT_TEST_ID_ATTRIBUTE = "data-testid";
export const CHATGPT_TURN_INDEX_TEST_ID_PATTERN = /conversation-turn-(\d+)/;

function normalizeAttribute(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function toOriginalId(messageId: string): string | null {
  if (!isMapHackMessageId(messageId)) {
    return messageId.length > 0 ? messageId : null;
  }

  const originalId = toOriginalMessageId(messageId);
  return originalId.length > 0 ? originalId : null;
}

export type ParsedTurnIndex =
  | { value: number; source: "primary" }
  | { value: number; source: "fallback" };

const RADIX_DECIMAL = 10;

function parsePrimaryTurnIndex(element: Element): number | null {
  const fromContainer = normalizeAttribute(
    element.closest(CHATGPT_TURN_CONTAINER_SELECTOR)?.getAttribute(
      CHATGPT_TURN_CONTAINER_TEST_ID_ATTRIBUTE
    )
  );
  const containerMatch = fromContainer.match(CHATGPT_TURN_INDEX_TEST_ID_PATTERN);
  if (containerMatch) {
    return Number.parseInt(containerMatch[1], RADIX_DECIMAL);
  }

  const descendant = element.querySelector(CHATGPT_TURN_INDEX_DESCENDANT_SELECTOR);
  const fromDescendant = normalizeAttribute(
    descendant?.getAttribute(CHATGPT_TURN_INDEX_DESCENDANT_TEST_ID_ATTRIBUTE)
  );
  const descendantMatch = fromDescendant.match(CHATGPT_TURN_INDEX_TEST_ID_PATTERN);
  if (descendantMatch) {
    return Number.parseInt(descendantMatch[1], RADIX_DECIMAL);
  }

  return null;
}

export function parseChatgptTurnIndexFromElement(
  element: Element,
  fallbackIndex: number
): ParsedTurnIndex {
  const primary = parsePrimaryTurnIndex(element);
  if (primary !== null) {
    return { value: primary, source: "primary" };
  }

  return { value: fallbackIndex, source: "fallback" };
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
      if (parsePrimaryTurnIndex(candidate) !== turnIndex) {
        continue;
      }

      return candidate.closest(CHATGPT_TURN_CONTAINER_SELECTOR) ?? candidate;
    }
  }

  return null;
}

export function findChatgptTurnElementByMessageId(
  root: ParentNode,
  messageId: string
): Element | null {
  const originalMessageId = toOriginalId(messageId);
  if (!originalMessageId) {
    return null;
  }

  const exactMessageElement =
    root.querySelector(`[data-message-id="${originalMessageId}"]`);

  if (!exactMessageElement) {
    return null;
  }

  return exactMessageElement.closest(CHATGPT_TURN_CONTAINER_SELECTOR) ?? exactMessageElement;
}

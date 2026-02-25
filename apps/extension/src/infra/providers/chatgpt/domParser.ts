import type { ConversationSource } from "../../../../../../packages/core/src/application/ports/ConversationSourcePort";
import {
  CHATGPT_MESSAGE_CONTAINER_FALLBACKS,
  CHATGPT_MESSAGE_CONTAINER_PRIMARY
} from "./selectors";

export const CHATGPT_MESSAGE_REF_TIMESTAMP_DEFAULT = null;

type ChatgptMessageRole = ConversationSource["messageRefs"][number]["role"];

type ChatgptSourceDataCollectionStrategyContract = {
  messageContainer: {
    primary: string;
    fallbacks: readonly string[];
  };
  fields: {
    conversationId: {
      primarySource: "conversation-url";
      fallbackSources: readonly ("location-pathname" | "canonical-href")[];
      canonicalSelector: 'link[rel="canonical"]';
      uuidPathPattern: RegExp;
    };
    messageId: {
      primaryAttribute: "data-message-id";
      descendantSelector: "[data-message-id]";
      descendantAttribute: "data-message-id";
      fallbackAttribute: "data-turn-id";
    };
    turnIndex: {
      articleSelector: "article";
      articleTestIdAttribute: "data-testid";
      testIdPattern: RegExp;
      descendantSelector: '[data-testid^="conversation-turn-"]';
      descendantTestIdAttribute: "data-testid";
      fallbackPolicy: "node-list-index";
    };
    role: {
      articleSelector: "article";
      articleTestIdAttribute: "data-testid";
      articleContainsByRole: {
        user: "user";
        assistant: "assistant";
      };
      fallbackAttributes: readonly ("data-message-author-role" | "data-turn")[];
    };
    content: {
      user: {
        primary: string;
        fallbacks: readonly string[];
      };
      assistant: {
        primary: string;
        fallbacks: readonly string[];
      };
    };
  };
  derived: {
    previewMaxLength: number;
  };
  defaults: {
    messageRefTimestamp: null;
  };
};

export const CHATGPT_SOURCE_DATA_COLLECTION_STRATEGY = {
  messageContainer: {
    primary: CHATGPT_MESSAGE_CONTAINER_PRIMARY,
    fallbacks: CHATGPT_MESSAGE_CONTAINER_FALLBACKS
  },
  fields: {
    conversationId: {
      primarySource: "conversation-url",
      fallbackSources: ["location-pathname", "canonical-href"],
      canonicalSelector: 'link[rel="canonical"]',
      uuidPathPattern:
        /\/c\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:[/?#]|$)/
    },
    messageId: {
      primaryAttribute: "data-message-id",
      descendantSelector: "[data-message-id]",
      descendantAttribute: "data-message-id",
      fallbackAttribute: "data-turn-id"
    },
    turnIndex: {
      articleSelector: "article",
      articleTestIdAttribute: "data-testid",
      testIdPattern: /conversation-turn-(\d+)/,
      descendantSelector: '[data-testid^="conversation-turn-"]',
      descendantTestIdAttribute: "data-testid",
      fallbackPolicy: "node-list-index"
    },
    role: {
      articleSelector: "article",
      articleTestIdAttribute: "data-testid",
      articleContainsByRole: {
        user: "user",
        assistant: "assistant"
      },
      fallbackAttributes: ["data-message-author-role", "data-turn"]
    },
    content: {
      user: {
        primary: "div.whitespace-pre-wrap",
        fallbacks: [".whitespace-pre-wrap", 'article[data-turn="user"]']
      },
      assistant: {
        primary: "div.markdown",
        fallbacks: [".markdown", 'article[data-turn="assistant"]']
      }
    }
  },
  derived: {
    previewMaxLength: 200
  },
  defaults: {
    messageRefTimestamp: CHATGPT_MESSAGE_REF_TIMESTAMP_DEFAULT
  }
} as const satisfies ChatgptSourceDataCollectionStrategyContract;

type ChatgptSourceDataCollectionStrategy = typeof CHATGPT_SOURCE_DATA_COLLECTION_STRATEGY;

export interface CollectChatgptSourceDataInput {
  root: Document;
  conversationUrl: string;
}

function toArray<T>(list: ArrayLike<T>): T[] {
  return Array.from(list);
}

function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value.trim();
}

function extractConversationOriginalId(value: string, pattern: RegExp): string | null {
  const normalized = normalizeText(value);
  if (normalized.length === 0) {
    return null;
  }

  const match = normalized.match(pattern);
  if (!match) {
    return null;
  }

  return normalizeText(match[1]).toLowerCase();
}

function resolveConversationOriginalId(
  root: Document,
  conversationUrl: string,
  strategy: ChatgptSourceDataCollectionStrategy["fields"]["conversationId"]
): string | null {
  if (strategy.primarySource === "conversation-url") {
    const fromUrl = extractConversationOriginalId(conversationUrl, strategy.uuidPathPattern);
    if (fromUrl !== null) {
      return fromUrl;
    }
  }

  for (const source of strategy.fallbackSources) {
    if (source === "location-pathname") {
      const pathname = normalizeText(root.location?.pathname ?? "");
      const fromPath = extractConversationOriginalId(pathname, strategy.uuidPathPattern);
      if (fromPath !== null) {
        return fromPath;
      }
      continue;
    }

    if (source === "canonical-href") {
      const canonicalHref = normalizeText(
        (root.querySelector(strategy.canonicalSelector) as HTMLLinkElement | null)?.href
      );
      const fromCanonical = extractConversationOriginalId(canonicalHref, strategy.uuidPathPattern);
      if (fromCanonical !== null) {
        return fromCanonical;
      }
    }
  }

  return null;
}

function resolveConversationUrl(
  root: Document,
  conversationUrl: string,
  strategy: ChatgptSourceDataCollectionStrategy["fields"]["conversationId"]
): string {
  const fromInput = normalizeText(conversationUrl);
  if (fromInput.length > 0) {
    return fromInput;
  }

  const fromLocationHref = normalizeText(root.location?.href ?? "");
  if (fromLocationHref.length > 0) {
    return fromLocationHref;
  }

  return normalizeText((root.querySelector(strategy.canonicalSelector) as HTMLLinkElement | null)?.href);
}

function parseRoleFromElement(
  element: Element,
  strategy: ChatgptSourceDataCollectionStrategy["fields"]["role"]
): ChatgptMessageRole | null {
  const article = element.closest(strategy.articleSelector);
  const articleTestId = normalizeText(article?.getAttribute(strategy.articleTestIdAttribute));

  if (articleTestId.includes(strategy.articleContainsByRole.assistant)) {
    return "assistant";
  }

  if (articleTestId.includes(strategy.articleContainsByRole.user)) {
    return "user";
  }

  for (const attribute of strategy.fallbackAttributes) {
    const selfValue = normalizeText(element.getAttribute(attribute));
    if (selfValue === strategy.articleContainsByRole.assistant) {
      return "assistant";
    }
    if (selfValue === strategy.articleContainsByRole.user) {
      return "user";
    }
  }

  return null;
}

function parseTurnIndexFromElement(
  element: Element,
  fallbackIndex: number,
  strategy: ChatgptSourceDataCollectionStrategy["fields"]["turnIndex"]
): number {
  const fromArticle = normalizeText(
    element.closest(strategy.articleSelector)?.getAttribute(strategy.articleTestIdAttribute)
  );
  const articleMatch = fromArticle.match(strategy.testIdPattern);
  if (articleMatch) {
    return Number.parseInt(articleMatch[1], 10);
  }

  const descendant = element.querySelector(strategy.descendantSelector);
  const fromDescendant = normalizeText(descendant?.getAttribute(strategy.descendantTestIdAttribute));
  const descendantMatch = fromDescendant.match(strategy.testIdPattern);
  if (descendantMatch) {
    return Number.parseInt(descendantMatch[1], 10);
  }

  if (strategy.fallbackPolicy === "node-list-index") {
    return fallbackIndex;
  }

  return fallbackIndex;
}


function parseMessageOriginalId(
  element: Element,
  strategy: ChatgptSourceDataCollectionStrategy["fields"]["messageId"]
): string | null {
  const primary = normalizeText(element.getAttribute(strategy.primaryAttribute));
  if (primary.length > 0) {
    return primary;
  }

  const descendant = element.querySelector(strategy.descendantSelector);
  const descendantId = normalizeText(descendant?.getAttribute(strategy.descendantAttribute));
  if (descendantId.length > 0) {
    return descendantId;
  }

  const fallback = normalizeText(element.getAttribute(strategy.fallbackAttribute));
  if (fallback.length > 0) {
    return fallback;
  }

  return null;
}

function parseContent(
  element: Element,
  role: ChatgptMessageRole,
  strategy: ChatgptSourceDataCollectionStrategy["fields"]["content"]
): string {
  const selectors = role === "user" ? strategy.user : strategy.assistant;

  for (const selector of [selectors.primary, ...selectors.fallbacks]) {
    const target = (element.matches(selector) ? element : null) ?? element.querySelector(selector);
    const text = normalizeText(target?.textContent);
    if (text.length > 0) {
      return text;
    }
  }

  return normalizeText(element.textContent);
}

export function resolveChatgptMessageContainers(root: Document): Element[] {
  const fromPrimary = toArray(root.querySelectorAll(CHATGPT_SOURCE_DATA_COLLECTION_STRATEGY.messageContainer.primary));
  if (fromPrimary.length > 0) {
    return fromPrimary;
  }

  for (const selector of CHATGPT_SOURCE_DATA_COLLECTION_STRATEGY.messageContainer.fallbacks) {
    const fromFallback = toArray(root.querySelectorAll(selector));
    if (fromFallback.length > 0) {
      return fromFallback;
    }
  }

  return [];
}

// Contract: returns ConversationSource only when conversationId(UUID) is resolvable.
// Unresolved state must be retried by caller (ISOLATED collection loop).
export function collectChatgptSourceData(
  input: CollectChatgptSourceDataInput
): ConversationSource | null {
  const strategy: ChatgptSourceDataCollectionStrategy = CHATGPT_SOURCE_DATA_COLLECTION_STRATEGY;
  const messageElements = resolveChatgptMessageContainers(input.root);
  const conversationOriginalId = resolveConversationOriginalId(
    input.root,
    input.conversationUrl,
    strategy.fields.conversationId
  );

  if (!conversationOriginalId) {
    return null;
  }

  const conversationId = `mh-conv-${conversationOriginalId}` as ConversationSource["conversation"]["id"];
  const resolvedConversationUrl = resolveConversationUrl(
    input.root,
    input.conversationUrl,
    strategy.fields.conversationId
  );

  const messageRefs: ConversationSource["messageRefs"] = [];

  for (let index = 0; index < messageElements.length; index += 1) {
    const element = messageElements[index];
    const originalId = parseMessageOriginalId(element, strategy.fields.messageId);
    if (!originalId) {
      continue;
    }

    const role = parseRoleFromElement(element, strategy.fields.role);
    if (!role) {
      continue;
    }

    const content = parseContent(element, role, strategy.fields.content);
    const preview = content.slice(0, strategy.derived.previewMaxLength);
    const turnIndex = parseTurnIndexFromElement(element, index, strategy.fields.turnIndex);

    messageRefs.push({
      id: `mh-msg-${originalId}` as ConversationSource["messageRefs"][number]["id"],
      conversationId,
      role,
      preview,
      timestamp: strategy.defaults.messageRefTimestamp,
      platform: "chatgpt",
      conversationUrl: resolvedConversationUrl,
      metadata: {
        originalId,
        turnIndex
      }
    });
  }

  return {
    conversation: {
      id: conversationId,
      createdAt: null,
      updatedAt: null,
      platform: "chatgpt",
      metadata: {
        originalId: conversationOriginalId,
        url: resolvedConversationUrl
      }
    },
    messageRefs
  };
}


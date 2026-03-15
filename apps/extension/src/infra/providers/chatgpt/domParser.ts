import type { ConversationSource } from "../../../../../../packages/core/src/application/ports/ConversationSourcePort";
import type { ChatgptCaptureScope } from "./threadScope";
import { parseChatgptTurnIndexFromElement } from "./turnIndex";

export const CHATGPT_MESSAGE_REF_TIMESTAMP_DEFAULT = null;

type ChatgptMessageRole = ConversationSource["messageRefs"][number]["role"];

type ChatgptSourceDataCollectionStrategyContract = {
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
    assistantGeneration: {
      stopButtonSelector: 'button[data-testid="stop-button"]';
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
    },
    assistantGeneration: {
      stopButtonSelector: 'button[data-testid="stop-button"]'
    }
  },
  derived: {
    previewMaxLength: 200
  },
  defaults: {
    messageRefTimestamp: CHATGPT_MESSAGE_REF_TIMESTAMP_DEFAULT
  }
} as const satisfies ChatgptSourceDataCollectionStrategyContract;

export interface CollectChatgptSourceDataInput {
  root: Document;
  conversationUrl: string;
  captureScope: ChatgptCaptureScope;
}

export interface CollectedChatgptSourceData extends ConversationSource {
  collectionMeta: {
    scopeIds: readonly string[];
  };
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
  strategy: ChatgptSourceDataCollectionStrategyContract["fields"]["conversationId"]
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

export function resolveChatgptConversationOriginalId(input: {
  root: Document;
  conversationUrl: string;
}): string | null {
  return resolveConversationOriginalId(
    input.root,
    input.conversationUrl,
    CHATGPT_SOURCE_DATA_COLLECTION_STRATEGY.fields.conversationId
  );
}

function resolveConversationUrl(
  root: Document,
  conversationUrl: string,
  strategy: ChatgptSourceDataCollectionStrategyContract["fields"]["conversationId"]
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
  strategy: ChatgptSourceDataCollectionStrategyContract["fields"]["role"]
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

function parseMessageOriginalId(
  element: Element,
  strategy: ChatgptSourceDataCollectionStrategyContract["fields"]["messageId"]
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
  strategy: ChatgptSourceDataCollectionStrategyContract["fields"]["content"]
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

function hasActiveAssistantGenerationSignal(
  root: Document,
  strategy: ChatgptSourceDataCollectionStrategyContract["fields"]["assistantGeneration"]
): boolean {
  return root.querySelector(strategy.stopButtonSelector) !== null;
}

// Contract: returns ConversationSource only when conversationId(UUID) is resolvable
// and capture scope rows are already resolved by caller.
export function collectChatgptSourceData(
  input: CollectChatgptSourceDataInput
): CollectedChatgptSourceData | null {
  const strategy: ChatgptSourceDataCollectionStrategyContract = CHATGPT_SOURCE_DATA_COLLECTION_STRATEGY;
  const messageElements = input.captureScope.messageContainers;
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
  const assistantGenerationActive = hasActiveAssistantGenerationSignal(
    input.root,
    strategy.fields.assistantGeneration
  );
  const latestMessageIndex = messageElements.length - 1;

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

    if (assistantGenerationActive && role === "assistant" && index === latestMessageIndex) {
      continue;
    }

    const content = parseContent(element, role, strategy.fields.content);
    if (role === "assistant" && content.length === 0) {
      continue;
    }

    const preview = content.slice(0, strategy.derived.previewMaxLength);
    const turnIndex = parseChatgptTurnIndexFromElement(element, index);

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

  const deduplicatedMessageRefs: ConversationSource["messageRefs"] = [];
  const seenOriginalIds = new Set<string>();
  for (let index = messageRefs.length - 1; index >= 0; index -= 1) {
    const messageRef = messageRefs[index];
    const originalId = messageRef.metadata.originalId;
    if (seenOriginalIds.has(originalId)) {
      continue;
    }
    seenOriginalIds.add(originalId);
    deduplicatedMessageRefs.push(messageRef);
  }
  deduplicatedMessageRefs.reverse();

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
    messageRefs: deduplicatedMessageRefs,
    collectionMeta: {
      scopeIds: deduplicatedMessageRefs.map((messageRef) => messageRef.metadata.originalId)
    }
  };
}

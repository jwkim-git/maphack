import { CHATGPT_AGENT_TURN_SELECTOR } from "./selectors";
import { parseChatgptTurnIndexFromElement } from "./turnIndex";

export const CHATGPT_MESSAGE_REF_TIMESTAMP_DEFAULT = null;

export type ChatgptMessageRole = "user" | "assistant";

type ChatgptSourceDataCollectionStrategyContract = {
  fields: {
    messageId: {
      primaryAttribute: "data-message-id";
      descendantSelector: "[data-message-id]";
      descendantAttribute: "data-message-id";
      temporaryPrefixes: readonly string[];
    };
    turnIndex: {
      fallbackPolicy: "node-list-index";
    };
    role: {
      turnContainerSelector: '[data-testid^="conversation-turn-"]';
      primaryAttribute: "data-message-author-role";
      fallbackTurnAttribute: "data-turn";
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
    mediaFallback: {
      imageSelector: "img[src]";
      labels: {
        image: "[Image]";
        etc: "[Etc]";
      };
    };
    agentTurn: {
      selector: string;
      imageAltSelector: "img[alt]";
      imageIdParamName: "id";
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
    messageId: {
      primaryAttribute: "data-message-id",
      descendantSelector: "[data-message-id]",
      descendantAttribute: "data-message-id",
      temporaryPrefixes: ["request-placeholder-"]
    },
    turnIndex: {
      fallbackPolicy: "node-list-index"
    },
    role: {
      turnContainerSelector: '[data-testid^="conversation-turn-"]',
      primaryAttribute: "data-message-author-role",
      fallbackTurnAttribute: "data-turn"
    },
    content: {
      user: {
        primary: "div.whitespace-pre-wrap",
        fallbacks: [".whitespace-pre-wrap", '[data-turn="user"]']
      },
      assistant: {
        primary: "div.markdown",
        fallbacks: [".markdown", '[data-turn="assistant"]']
      }
    },
    mediaFallback: {
      imageSelector: "img[src]",
      labels: {
        image: "[Image]",
        etc: "[Etc]"
      }
    },
    agentTurn: {
      selector: CHATGPT_AGENT_TURN_SELECTOR,
      imageAltSelector: "img[alt]",
      imageIdParamName: "id"
    }
  },
  derived: {
    previewMaxLength: 200
  },
  defaults: {
    messageRefTimestamp: CHATGPT_MESSAGE_REF_TIMESTAMP_DEFAULT
  }
} as const satisfies ChatgptSourceDataCollectionStrategyContract;

export type ParsedChatgptMessageRow = {
  element: Element;
  originalId: string;
  role: ChatgptMessageRole;
  turnIndex: number;
  turnIndexSource: "primary" | "fallback";
  rowText: string;
  contentHeight: number;
};

function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value.trim();
}

function parseRoleFromElement(
  element: Element,
  strategy: ChatgptSourceDataCollectionStrategyContract["fields"]["role"]
): ChatgptMessageRole | null {
  const primary = normalizeText(element.getAttribute(strategy.primaryAttribute));
  if (primary === "assistant" || primary === "user") {
    return primary;
  }

  const turnContainer = element.closest(strategy.turnContainerSelector);
  const turnContainerRole = normalizeText(turnContainer?.getAttribute(strategy.fallbackTurnAttribute));
  if (turnContainerRole === "assistant" || turnContainerRole === "user") {
    return turnContainerRole;
  }

  return null;
}

function parseAgentTurnFileId(
  element: Element,
  strategy: ChatgptSourceDataCollectionStrategyContract["fields"]["agentTurn"]
): string | null {
  const matchesAgentTurnSelector =
    element.matches(strategy.selector) || element.querySelector(strategy.selector) !== null;
  if (!matchesAgentTurnSelector) {
    return null;
  }

  const img = element.querySelector(strategy.imageAltSelector);
  const src = img?.getAttribute("src");
  if (!src) {
    return null;
  }

  try {
    const url = new URL(src);
    const fileId = url.searchParams.get(strategy.imageIdParamName);
    return fileId && fileId.length > 0 ? fileId : null;
  } catch {
    return null;
  }
}

function parseMessageOriginalId(
  element: Element,
  strategy: ChatgptSourceDataCollectionStrategyContract["fields"]["messageId"],
  agentTurnStrategy: ChatgptSourceDataCollectionStrategyContract["fields"]["agentTurn"]
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

  return parseAgentTurnFileId(element, agentTurnStrategy);
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

export function parseChatgptMessageRow(
  element: Element,
  fallbackIndex: number
): ParsedChatgptMessageRow | null {
  const strategy: ChatgptSourceDataCollectionStrategyContract = CHATGPT_SOURCE_DATA_COLLECTION_STRATEGY;
  const originalId = parseMessageOriginalId(element, strategy.fields.messageId, strategy.fields.agentTurn);
  if (!originalId) {
    return null;
  }

  const role = parseRoleFromElement(element, strategy.fields.role);
  if (!role) {
    return null;
  }

  const suppressTextContent = originalId.startsWith("file_");
  const parsedTurnIndex = parseChatgptTurnIndexFromElement(element, fallbackIndex);

  return {
    element,
    originalId,
    role,
    turnIndex: parsedTurnIndex.value,
    turnIndexSource: parsedTurnIndex.source,
    rowText: suppressTextContent ? "" : parseContent(element, role, strategy.fields.content),
    contentHeight: element.getBoundingClientRect().height
  };
}

import type { ConversationSource } from "../../../../../../packages/core/src/application/ports/ConversationSourcePort";
import { toMapHackMessageId } from "../../../../../../packages/core/src/domain/value/MapHackMessageId";
import type { CurrentChatgptConversation } from "./currentConversation";
import { CHATGPT_AGENT_TURN_SELECTOR } from "./selectors";
import type { ChatgptCaptureScope } from "./threadScope";
import { parseChatgptTurnIndexFromElement } from "./turnIndex";

export const CHATGPT_MESSAGE_REF_TIMESTAMP_DEFAULT = null;

type ChatgptMessageRole = ConversationSource["messageRefs"][number]["role"];

type ChatgptSourceDataCollectionStrategyContract = {
  fields: {
    messageId: {
      primaryAttribute: "data-message-id";
      descendantSelector: "[data-message-id]";
      descendantAttribute: "data-message-id";
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
    assistantGeneration: {
      stopButtonSelector: 'button[data-testid="stop-button"]';
    };
    mediaFallback: {
      imageSelector: "img[src]";
      labels: {
        image: "[Image]";
        attachment: "[Attachment]";
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
      descendantAttribute: "data-message-id"
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
    assistantGeneration: {
      stopButtonSelector: 'button[data-testid="stop-button"]'
    },
    mediaFallback: {
      imageSelector: "img[src]",
      labels: {
        image: "[Image]",
        attachment: "[Attachment]"
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

export interface CollectChatgptSourceDataInput {
  root: Document;
  conversation: CurrentChatgptConversation;
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
  const isAgentTurn =
    element.matches(strategy.selector) || element.querySelector(strategy.selector) !== null;
  if (!isAgentTurn) {
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

function detectMediaPreview(
  element: Element,
  strategy: ChatgptSourceDataCollectionStrategyContract["fields"]["mediaFallback"]
): string {
  const img = element.querySelector(strategy.imageSelector);
  if (!img) {
    return strategy.labels.attachment;
  }

  const alt = normalizeText(img.getAttribute("alt"));
  return alt.length > 0 ? alt : strategy.labels.image;
}

function hasActiveAssistantGenerationSignal(
  root: Document,
  strategy: ChatgptSourceDataCollectionStrategyContract["fields"]["assistantGeneration"]
): boolean {
  return root.querySelector(strategy.stopButtonSelector) !== null;
}

export function collectChatgptSourceData(
  input: CollectChatgptSourceDataInput
): CollectedChatgptSourceData | null {
  const strategy: ChatgptSourceDataCollectionStrategyContract = CHATGPT_SOURCE_DATA_COLLECTION_STRATEGY;
  const messageElements = input.captureScope.messageContainers;
  const conversationOriginalId = input.conversation.originalId;
  const conversationId = input.conversation.id;
  const resolvedConversationUrl = input.conversation.url;

  const messageRefs: ConversationSource["messageRefs"] = [];
  const assistantGenerationActive = hasActiveAssistantGenerationSignal(
    input.root,
    strategy.fields.assistantGeneration
  );
  const latestMessageIndex = messageElements.length - 1;

  for (let index = 0; index < messageElements.length; index += 1) {
    const element = messageElements[index];
    const originalId = parseMessageOriginalId(element, strategy.fields.messageId, strategy.fields.agentTurn);
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
    const preview = content.length > 0
      ? content.slice(0, strategy.derived.previewMaxLength)
      : detectMediaPreview(element, strategy.fields.mediaFallback);
    const parsedTurnIndex = parseChatgptTurnIndexFromElement(element, index);

    messageRefs.push({
      id: toMapHackMessageId(originalId),
      conversationId,
      role,
      preview,
      timestamp: strategy.defaults.messageRefTimestamp,
      platform: "chatgpt",
      conversationUrl: resolvedConversationUrl,
      metadata: {
        originalId,
        turnIndex: parsedTurnIndex.value,
        turnIndexSource: parsedTurnIndex.source
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

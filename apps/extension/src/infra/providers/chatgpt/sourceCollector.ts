import type { ConversationSource } from "../../../../../../packages/core/src/application/ports/ConversationSourcePort";
import { toMapHackMessageId } from "../../../../../../packages/core/src/domain/value/MapHackMessageId";
import type { ChatgptCaptureReadyGate } from "./captureReadyGate";
import type { CurrentChatgptConversation } from "./currentConversation";
import {
  CHATGPT_SOURCE_DATA_COLLECTION_STRATEGY,
  type ParsedChatgptMessageRow,
  parseChatgptMessageRow
} from "./domParser";
import type { ChatgptCaptureScope } from "./threadScope";

export interface CollectedChatgptSourceData extends ConversationSource {
  collectionMeta: {
    scopeIds: readonly string[];
  };
}

export type ChatgptSourceCollectionResult =
  | { kind: "source"; source: CollectedChatgptSourceData }
  | { kind: "capture-ready-pending" };

export function collectChatgptSourceData(input: {
  conversation: CurrentChatgptConversation;
  captureScope: ChatgptCaptureScope;
  captureReadyGate: ChatgptCaptureReadyGate;
}): ChatgptSourceCollectionResult | null {
  const messageElements = input.captureScope.messageContainers;
  const latestIndex = messageElements.length - 1;
  const parsedRows: Array<{ index: number; row: ParsedChatgptMessageRow }> = [];

  for (let index = 0; index < messageElements.length; index += 1) {
    const row = parseChatgptMessageRow(messageElements[index], index);
    if (!row) {
      continue;
    }
    parsedRows.push({ index, row });
  }

  const latestAssistant = parsedRows.find(
    ({ index, row }) => index === latestIndex && row.role === "assistant"
  );

  if (latestAssistant) {
    const readyState = input.captureReadyGate.check({
      container: input.captureScope.container,
      element: latestAssistant.row.element,
      originalId: latestAssistant.row.originalId,
      role: latestAssistant.row.role,
      turnIndex: latestAssistant.row.turnIndex,
      turnIndexSource: latestAssistant.row.turnIndexSource,
      rowText: latestAssistant.row.rowText,
      contentHeight: latestAssistant.row.contentHeight
    });

    if (readyState === "pending") {
      return { kind: "capture-ready-pending" };
    }
  }

  if (hasTemporaryMessageOriginalId(parsedRows)) {
    return { kind: "capture-ready-pending" };
  }

  const messageRefs = dedupeByOriginalId(
    parsedRows.map(({ row }) => toMessageRef(row, input.conversation))
  );

  return {
    kind: "source",
    source: toCollectedSource(messageRefs, input.conversation)
  };
}

function toMessageRef(
  row: ParsedChatgptMessageRow,
  conversation: CurrentChatgptConversation
): ConversationSource["messageRefs"][number] {
  const strategy = CHATGPT_SOURCE_DATA_COLLECTION_STRATEGY;

  return {
    id: toMapHackMessageId(row.originalId),
    conversationId: conversation.id,
    role: row.role,
    preview: resolvePreview(row),
    timestamp: strategy.defaults.messageRefTimestamp,
    platform: "chatgpt",
    conversationUrl: conversation.url,
    metadata: {
      originalId: row.originalId,
      turnIndex: row.turnIndex,
      turnIndexSource: row.turnIndexSource
    }
  };
}

function hasTemporaryMessageOriginalId(
  parsedRows: Array<{ index: number; row: ParsedChatgptMessageRow }>
): boolean {
  const prefixes = CHATGPT_SOURCE_DATA_COLLECTION_STRATEGY.fields.messageId.temporaryPrefixes;
  return parsedRows.some(({ row }) =>
    prefixes.some((prefix) => row.originalId.startsWith(prefix))
  );
}

function resolvePreview(row: ParsedChatgptMessageRow): string {
  const strategy = CHATGPT_SOURCE_DATA_COLLECTION_STRATEGY;
  if (row.originalId.startsWith("file_")) {
    return strategy.fields.mediaFallback.labels.image;
  }
  if (row.rowText.length > 0) {
    return row.rowText.slice(0, strategy.derived.previewMaxLength);
  }
  if (row.element.querySelector(strategy.fields.mediaFallback.imageSelector) !== null) {
    return strategy.fields.mediaFallback.labels.image;
  }
  return strategy.fields.mediaFallback.labels.etc;
}

function dedupeByOriginalId(
  messageRefs: ConversationSource["messageRefs"]
): ConversationSource["messageRefs"] {
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
  return deduplicatedMessageRefs;
}

function toCollectedSource(
  messageRefs: ConversationSource["messageRefs"],
  conversation: CurrentChatgptConversation
): CollectedChatgptSourceData {
  return {
    conversation: {
      id: conversation.id,
      createdAt: null,
      updatedAt: null,
      platform: "chatgpt",
      metadata: {
        originalId: conversation.originalId,
        url: conversation.url
      }
    },
    messageRefs,
    collectionMeta: {
      scopeIds: messageRefs.map((messageRef) => messageRef.metadata.originalId)
    }
  };
}

import {
  createBookmarksUpdatedEvent,
  createSourceUpdatedEvent,
  isBookmarksUpdatedEvent,
  isSourceUpdatedEvent
} from "../infra/messaging/runtimeBridge";

type ChromeLike = {
  tabs?: {
    sendMessage?: (tabId: number, message: unknown) => void;
  };
};

const sourceRevisionByConversationId = new Map<string, number>();
const assistantGeneratingByConversationId = new Map<string, boolean>();
let bookmarkRevision = 0;
const backgroundSessionId = `bg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function resolveNextSourceRevision(conversationId: string): number {
  const nextSourceRevision = (sourceRevisionByConversationId.get(conversationId) ?? 0) + 1;
  sourceRevisionByConversationId.set(conversationId, nextSourceRevision);
  return nextSourceRevision;
}

export function resolveNextBookmarkRevision(): number {
  bookmarkRevision += 1;
  return bookmarkRevision;
}

export function updateAssistantGenerating(conversationId: string, value: boolean): void {
  assistantGeneratingByConversationId.set(conversationId, value);
}

export function resolveAssistantGenerating(conversationId: string): boolean {
  return assistantGeneratingByConversationId.get(conversationId) ?? false;
}

export function emitSourceUpdatedEvent(
  conversationId: string,
  sourceRevision: number,
  senderTabId: number | null,
  assistantGenerating: boolean
): void {
  if (senderTabId === null) {
    return;
  }

  const chromeLike = (globalThis as { chrome?: ChromeLike }).chrome;
  const event = createSourceUpdatedEvent(conversationId, sourceRevision, backgroundSessionId, assistantGenerating);
  if (!isSourceUpdatedEvent(event)) {
    return;
  }

  const tabs = chromeLike?.tabs;
  if (tabs && typeof tabs.sendMessage === "function") {
    tabs.sendMessage(senderTabId, event);
  }
}

export function emitBookmarksUpdatedEvent(tabIds: number[], nextBookmarkRevision: number): void {
  if (tabIds.length === 0) {
    return;
  }

  const chromeLike = (globalThis as { chrome?: ChromeLike }).chrome;
  const event = createBookmarksUpdatedEvent(nextBookmarkRevision, backgroundSessionId);
  if (!isBookmarksUpdatedEvent(event)) {
    return;
  }

  const tabs = chromeLike?.tabs;
  if (!tabs || typeof tabs.sendMessage !== "function") {
    return;
  }

  for (const tabId of tabIds) {
    tabs.sendMessage(tabId, event);
  }
}

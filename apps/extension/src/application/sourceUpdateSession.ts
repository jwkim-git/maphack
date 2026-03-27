import {
  createSourceUpdatedEvent,
  isSourceUpdatedEvent
} from "../infra/messaging/runtimeBridge";

type ChromeLike = {
  tabs?: {
    sendMessage?: (tabId: number, message: unknown) => void;
  };
};

const sourceVersionByConversationId = new Map<string, number>();
const backgroundSessionId = `bg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function resolveNextConversationSeq(conversationId: string): number {
  const nextSeq = (sourceVersionByConversationId.get(conversationId) ?? 0) + 1;
  sourceVersionByConversationId.set(conversationId, nextSeq);
  return nextSeq;
}

export function emitSourceUpdatedEvent(conversationId: string, seq: number, senderTabId: number | null): void {
  if (senderTabId === null) {
    return;
  }

  const chromeLike = (globalThis as { chrome?: ChromeLike }).chrome;
  const event = createSourceUpdatedEvent(conversationId, seq, backgroundSessionId);
  if (!isSourceUpdatedEvent(event)) {
    return;
  }

  const tabs = chromeLike?.tabs;
  if (tabs && typeof tabs.sendMessage === "function") {
    tabs.sendMessage(senderTabId, event);
  }
}

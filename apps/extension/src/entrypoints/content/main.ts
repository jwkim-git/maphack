import { toTimestampPayloadMessage, toTimestampPullRequestMessage } from "../../infra/messaging/postMessageBridge";
import type { TimestampPayloadSource } from "../../infra/messaging/timestampPayload";
import { collectFiberTimestampSeeds } from "../../infra/providers/chatgpt/fiberTimestampCollector";
import { readCurrentChatgptConversation } from "../../infra/providers/chatgpt/currentConversation";
import { createTimestampPayloadMessage, type TimestampSeed } from "../../infra/providers/chatgpt/timestampAdapter";
import { resolveProviderIdByHostname } from "../../infra/providers/index";

export type PostTimestampMessage = (message: unknown, targetOrigin: string) => void;

export interface PublishTimestampPayloadInput {
  hostname: string;
  requestId: string;
  conversationId: string;
  source: TimestampPayloadSource;
  seeds: TimestampSeed[];
  targetOrigin: string;
  postTimestampMessage: PostTimestampMessage;
}

function resolveActiveConversationId(): string | null {
  return readCurrentChatgptConversation()?.id ?? null;
}

function isValidTargetOrigin(hostname: string, targetOrigin: string): boolean {
  try {
    const parsed = new URL(targetOrigin);
    return parsed.origin === targetOrigin && ["http:", "https:"].includes(parsed.protocol) && parsed.hostname.toLowerCase() === hostname.trim().toLowerCase();
  } catch {
    return false;
  }
}

function collectFiberSnapshot(request: {
  conversationId: string;
  messageIds: string[];
}): { conversationId: string; source: TimestampPayloadSource; seeds: TimestampSeed[] } | null {
  if (typeof window === "undefined") {
    return null;
  }

  const activeConversationId = resolveActiveConversationId();
  if (activeConversationId !== null && activeConversationId !== request.conversationId) {
    return null;
  }

  return { conversationId: request.conversationId, source: "fiber", seeds: collectFiberTimestampSeeds(request.messageIds) };
}

export function publishTimestampPayload(input: PublishTimestampPayloadInput): "provider-unsupported" | "payload-invalid" | "sent" {
  if (resolveProviderIdByHostname(input.hostname) !== "chatgpt") {
    return "provider-unsupported";
  }
  if (!isValidTargetOrigin(input.hostname, input.targetOrigin)) {
    return "payload-invalid";
  }

  try {
    const payload = createTimestampPayloadMessage({
      requestId: input.requestId,
      conversationId: input.conversationId,
      source: input.source,
      items: input.seeds
    });
    const validated = toTimestampPayloadMessage(payload);
    if (validated === null) {
      return "payload-invalid";
    }

    input.postTimestampMessage(validated, input.targetOrigin);
    return "sent";
  } catch {
    return "payload-invalid";
  }
}

export function relayIsolatedTimestampRequest(input: {
  event: { source: unknown; origin: string; data: unknown };
  currentWindow: unknown;
  currentOrigin: string;
  hostname: string;
  collectSeedsByRequest: (request: {
    conversationId: string;
    messageIds: string[];
  }) => { conversationId: string; source: TimestampPayloadSource; seeds: TimestampSeed[] } | null;
  postTimestampMessage: PostTimestampMessage;
}): "accepted" | "ignored" {
  if (input.event.source !== input.currentWindow || input.event.origin !== input.currentOrigin) {
    return "ignored";
  }

  const request = toTimestampPullRequestMessage(input.event.data);
  if (request === null) {
    return "ignored";
  }

  const snapshot = input.collectSeedsByRequest({ conversationId: request.conversationId, messageIds: request.messageIds });
  if (snapshot === null || snapshot.conversationId !== request.conversationId) {
    return "ignored";
  }

  return publishTimestampPayload({
    hostname: input.hostname,
    requestId: request.requestId,
    conversationId: snapshot.conversationId,
    source: snapshot.source,
    seeds: snapshot.seeds,
    targetOrigin: input.currentOrigin,
    postTimestampMessage: input.postTimestampMessage
  }) === "sent"
    ? "accepted"
    : "ignored";
}

export function bootstrapMainTimestampBridge(): void {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function" || typeof window.postMessage !== "function") {
    return;
  }

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    relayIsolatedTimestampRequest({
      event: { source: event.source, origin: event.origin, data: event.data },
      currentWindow: window,
      currentOrigin: window.location.origin,
      hostname: window.location.hostname,
      collectSeedsByRequest: collectFiberSnapshot,
      postTimestampMessage: (message, targetOrigin) => window.postMessage(message, targetOrigin)
    });
  });
}

void bootstrapMainTimestampBridge();

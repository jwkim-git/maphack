import {
  toTimestampPayloadMessage,
  toTimestampPullRequestMessage
} from "../../infra/messaging/postMessageBridge";
import { createTimestampPayloadMessage, type TimestampSeed } from "../../infra/providers/chatgpt/timestampAdapter";
import { resolveProviderIdByHostname } from "../../infra/providers/index";
import type { TimestampPayloadSource } from "../../infra/messaging/timestampPayload";

export type PostTimestampMessage = (message: unknown, targetOrigin: string) => void;

export type PublishTimestampPayloadResult =
  | "provider-unsupported"
  | "payload-invalid"
  | "sent";

export interface PublishTimestampPayloadInput {
  hostname: string;
  conversationId: string;
  source: TimestampPayloadSource;
  seeds: TimestampSeed[];
  targetOrigin: string;
  postTimestampMessage: PostTimestampMessage;
}

function isValidTargetOriginForHostname(targetOrigin: string, hostname: string): boolean {
  try {
    const parsed = new URL(targetOrigin);
    if (parsed.origin !== targetOrigin) {
      return false;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    return parsed.hostname.toLowerCase() === hostname.trim().toLowerCase();
  } catch {
    return false;
  }
}

// Build and validate one timestamp payload, then post only valid messages.
export function publishTimestampPayload(
  input: PublishTimestampPayloadInput
): PublishTimestampPayloadResult {
  const providerId = resolveProviderIdByHostname(input.hostname);
  if (providerId !== "chatgpt") {
    return "provider-unsupported";
  }

  if (!isValidTargetOriginForHostname(input.targetOrigin, input.hostname)) {
    return "payload-invalid";
  }

  let builtPayload: ReturnType<typeof createTimestampPayloadMessage>;
  try {
    builtPayload = createTimestampPayloadMessage({
      conversationId: input.conversationId,
      source: input.source,
      items: input.seeds
    });
  } catch {
    return "payload-invalid";
  }

  const validatedPayload = toTimestampPayloadMessage(builtPayload);
  if (validatedPayload === null) {
    return "payload-invalid";
  }

  input.postTimestampMessage(validatedPayload, input.targetOrigin);
  return "sent";
}

type MainSeedSnapshot = {
  conversationId: string;
  source: TimestampPayloadSource;
  seeds: TimestampSeed[];
};

type MainTimestampPullRequest = {
  conversationId: string;
  messageIds: string[];
};

export interface CollectMainTimestampSeeds {
  (): MainSeedSnapshot | null;
}

export interface CollectMainTimestampSeedsByRequest {
  (request: MainTimestampPullRequest): MainSeedSnapshot | null;
}

export interface TimestampMessageEventLike {
  source: unknown;
  origin: string;
  data: unknown;
}

export interface RelayIsolatedTimestampRequestInput {
  event: TimestampMessageEventLike;
  currentWindow: unknown;
  currentOrigin: string;
  hostname: string;
  collectSeedsByRequest: CollectMainTimestampSeedsByRequest;
  postTimestampMessage: PostTimestampMessage;
}

export type RelayIsolatedTimestampRequestResult = "accepted" | "ignored";

// Read one seed snapshot and delegate publishing with current page context.
export function runMainTimestampCollection(
  collectSeeds: CollectMainTimestampSeeds,
  postTimestampMessage: PostTimestampMessage
): PublishTimestampPayloadResult {
  if (typeof window === "undefined") {
    return "provider-unsupported";
  }

  const snapshot = collectSeeds();
  if (snapshot === null) {
    return "payload-invalid";
  }

  return publishTimestampPayload({
    hostname: window.location.hostname,
    conversationId: snapshot.conversationId,
    source: snapshot.source,
    seeds: snapshot.seeds,
    targetOrigin: window.location.origin,
    postTimestampMessage
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveWindowTimestampRegistry(): Record<string, unknown> | null {
  if (typeof window === "undefined") {
    return null;
  }

  const globalWindow = window as unknown as {
    __MAPHACK_TIMESTAMP_SEED_REGISTRY__?: unknown;
  };

  if (!isRecord(globalWindow.__MAPHACK_TIMESTAMP_SEED_REGISTRY__)) {
    return null;
  }

  return globalWindow.__MAPHACK_TIMESTAMP_SEED_REGISTRY__;
}

function collectSeedsFromWindowRegistry(request: MainTimestampPullRequest): MainSeedSnapshot {
  const registry = resolveWindowTimestampRegistry();

  const seeds: TimestampSeed[] = request.messageIds.map((messageId) => {
    const value = registry && Object.prototype.hasOwnProperty.call(registry, messageId)
      ? registry[messageId]
      : null;

    return {
      id: messageId,
      createTime:
        typeof value === "string" ||
        typeof value === "number" ||
        value === null ||
        value === undefined
          ? value
          : null
    };
  });

  return {
    conversationId: request.conversationId,
    source: "json",
    seeds
  };
}

export function relayIsolatedTimestampRequest(
  input: RelayIsolatedTimestampRequestInput
): RelayIsolatedTimestampRequestResult {
  if (input.event.source !== input.currentWindow) {
    return "ignored";
  }

  if (input.event.origin !== input.currentOrigin) {
    return "ignored";
  }

  const request = toTimestampPullRequestMessage(input.event.data);
  if (request === null) {
    return "ignored";
  }

  const snapshot = input.collectSeedsByRequest({
    conversationId: request.conversationId,
    messageIds: request.messageIds
  });

  if (snapshot === null || snapshot.conversationId !== request.conversationId) {
    return "ignored";
  }

  const result = publishTimestampPayload({
    hostname: input.hostname,
    conversationId: snapshot.conversationId,
    source: snapshot.source,
    seeds: snapshot.seeds,
    targetOrigin: input.currentOrigin,
    postTimestampMessage: input.postTimestampMessage
  });

  return result === "sent" ? "accepted" : "ignored";
}

function bindTimestampPullRequestListener(
  collectSeedsByRequest: CollectMainTimestampSeedsByRequest,
  postTimestampMessage: PostTimestampMessage
): void {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return;
  }

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    relayIsolatedTimestampRequest({
      event: {
        source: event.source,
        origin: event.origin,
        data: event.data
      },
      currentWindow: window,
      currentOrigin: window.location.origin,
      hostname: window.location.hostname,
      collectSeedsByRequest,
      postTimestampMessage
    });
  });
}

function resolveWindowPostTimestampMessage(): PostTimestampMessage | null {
  if (typeof window === "undefined" || typeof window.postMessage !== "function") {
    return null;
  }

  return (message: unknown, targetOrigin: string) => {
    window.postMessage(message, targetOrigin);
  };
}

export function bootstrapMainTimestampBridge(): void {
  if (typeof window === "undefined") {
    return;
  }

  const postTimestampMessage = resolveWindowPostTimestampMessage();
  if (postTimestampMessage === null) {
    return;
  }

  bindTimestampPullRequestListener(
    (request) => collectSeedsFromWindowRegistry(request),
    postTimestampMessage
  );
}

void bootstrapMainTimestampBridge();

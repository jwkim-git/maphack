import {
  toTimestampPayloadMessage,
  toTimestampPullRequestMessage
} from "../../infra/messaging/postMessageBridge";
import {
  createApplyTimestampsRequest,
  createCaptureConversationRequest,
  isApplyTimestampsRequest,
  isCaptureConversationRequest
} from "../../infra/messaging/runtimeBridge";
import {
  toRuntimeConversationSource,
  toRuntimeTimestampMappings
} from "../../infra/messaging/runtimeMapper";
import { collectChatgptSourceData } from "../../infra/providers/chatgpt/domParser";
import { resolveProviderIdByHostname } from "../../infra/providers/index";
import {
  TIMESTAMP_PULL_REQUEST_SIGNATURE,
  TIMESTAMP_PULL_REQUEST_TYPE
} from "../../infra/messaging/timestampPayload";

export type RuntimeSendMessage = (message: unknown) => void | Promise<unknown>;
export type PostMainMessage = (message: unknown, targetOrigin: string) => void;

export type CaptureConversationSourceResult =
  | "provider-unsupported"
  | "source-unavailable"
  | "payload-invalid"
  | "sent";

export interface CaptureConversationSourceInput {
  hostname: string;
  conversationUrl: string;
  root: Document;
  sendRuntimeMessage: RuntimeSendMessage;
}

type ChatgptSourceData = NonNullable<ReturnType<typeof collectChatgptSourceData>>;

type SourceResolution =
  | { kind: "provider-unsupported" }
  | { kind: "source-unavailable" }
  | { kind: "ok"; source: ChatgptSourceData };

export interface TimestampMessageEventLike {
  source: unknown;
  origin: string;
  data: unknown;
}

export interface RelayMainTimestampPayloadInput {
  event: TimestampMessageEventLike;
  currentWindow: unknown;
  currentOrigin: string;
  sendRuntimeMessage: RuntimeSendMessage;
}

export type RelayMainTimestampPayloadResult = "accepted" | "ignored";

// Validate MAIN->ISOLATED postMessage boundaries and forward only verified payloads.
export async function relayMainTimestampPayload(
  input: RelayMainTimestampPayloadInput
): Promise<RelayMainTimestampPayloadResult> {
  if (input.event.source !== input.currentWindow) {
    return "ignored";
  }

  if (input.event.origin !== input.currentOrigin) {
    return "ignored";
  }

  const timestampPayload = toTimestampPayloadMessage(input.event.data);
  if (timestampPayload === null) {
    return "ignored";
  }

  const runtimeMappings = toRuntimeTimestampMappings(timestampPayload.payload);
  const request = createApplyTimestampsRequest(
    timestampPayload.conversationId,
    timestampPayload.source,
    runtimeMappings
  );

  if (!isApplyTimestampsRequest(request)) {
    return "ignored";
  }

  await input.sendRuntimeMessage(request);
  return "accepted";
}

function resolveSourceData(
  hostname: string,
  root: Document,
  conversationUrl: string
): SourceResolution {
  const providerId = resolveProviderIdByHostname(hostname);
  if (providerId !== "chatgpt") {
    return { kind: "provider-unsupported" };
  }

  const source = collectChatgptSourceData({
    root,
    conversationUrl
  });

  if (source === null) {
    return { kind: "source-unavailable" };
  }

  return {
    kind: "ok",
    source
  };
}

async function sendCapturedSourceToBackground(
  source: ChatgptSourceData,
  sendRuntimeMessage: RuntimeSendMessage
): Promise<"payload-invalid" | "sent"> {
  const runtimeSource = toRuntimeConversationSource(source);
  const request = createCaptureConversationRequest(runtimeSource);
  if (!isCaptureConversationRequest(request)) {
    return "payload-invalid";
  }

  await sendRuntimeMessage(request);
  return "sent";
}

type SourceSyncState = {
  activeConversationId: string | null;
  requestedMessageIds: Set<string>;
};

function requestMainTimestampsForNewMessageIds(
  source: ChatgptSourceData,
  state: SourceSyncState,
  postMainMessage: PostMainMessage,
  targetOrigin: string
): void {
  if (state.activeConversationId !== source.conversation.id) {
    state.activeConversationId = source.conversation.id;
    state.requestedMessageIds.clear();
  }

  const nextMessageIds: string[] = [];
  for (const messageRef of source.messageRefs) {
    if (state.requestedMessageIds.has(messageRef.id)) {
      continue;
    }
    nextMessageIds.push(messageRef.id);
  }

  if (nextMessageIds.length === 0) {
    return;
  }

  const request = {
    type: TIMESTAMP_PULL_REQUEST_TYPE,
    signature: TIMESTAMP_PULL_REQUEST_SIGNATURE,
    conversationId: source.conversation.id,
    messageIds: nextMessageIds
  };

  if (toTimestampPullRequestMessage(request) === null) {
    return;
  }

  postMainMessage(request, targetOrigin);
  for (const messageId of nextMessageIds) {
    state.requestedMessageIds.add(messageId);
  }
}

interface SyncConversationSourceInput {
  hostname: string;
  conversationUrl: string;
  root: Document;
  sendRuntimeMessage: RuntimeSendMessage;
  postMainMessage: PostMainMessage;
  targetOrigin: string;
  state: SourceSyncState;
}

async function syncConversationSource(
  input: SyncConversationSourceInput
): Promise<CaptureConversationSourceResult> {
  const sourceResolution = resolveSourceData(
    input.hostname,
    input.root,
    input.conversationUrl
  );

  if (sourceResolution.kind !== "ok") {
    return sourceResolution.kind;
  }

  const captureResult = await sendCapturedSourceToBackground(
    sourceResolution.source,
    input.sendRuntimeMessage
  );

  if (captureResult !== "sent") {
    return captureResult;
  }

  requestMainTimestampsForNewMessageIds(
    sourceResolution.source,
    input.state,
    input.postMainMessage,
    input.targetOrigin
  );

  return "sent";
}

// Collect source data once in ISOLATED and send it only when source is resolvable.
export async function captureConversationSource(
  input: CaptureConversationSourceInput
): Promise<CaptureConversationSourceResult> {
  const sourceResolution = resolveSourceData(
    input.hostname,
    input.root,
    input.conversationUrl
  );

  if (sourceResolution.kind !== "ok") {
    return sourceResolution.kind;
  }

  return sendCapturedSourceToBackground(sourceResolution.source, input.sendRuntimeMessage);
}

type ChromeRuntimeLike = {
  runtime?: {
    sendMessage?: RuntimeSendMessage;
  };
};

function resolveRuntimeSendMessage(): RuntimeSendMessage | null {
  const chromeLike = (globalThis as { chrome?: ChromeRuntimeLike }).chrome;
  const sendMessage = chromeLike?.runtime?.sendMessage;

  if (typeof sendMessage !== "function") {
    return null;
  }

  return sendMessage;
}

function resolvePostMainMessage(): PostMainMessage | null {
  if (typeof window === "undefined" || typeof window.postMessage !== "function") {
    return null;
  }

  return (message: unknown, targetOrigin: string) => {
    window.postMessage(message, targetOrigin);
  };
}

function bindMainTimestampRelay(sendRuntimeMessage: RuntimeSendMessage): void {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return;
  }

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    void relayMainTimestampPayload({
      event: {
        source: event.source,
        origin: event.origin,
        data: event.data
      },
      currentWindow: window,
      currentOrigin: window.location.origin,
      sendRuntimeMessage
    });
  });
}

interface BindSourceSyncLoopInput {
  hostname: string;
  root: Document;
  getConversationUrl: () => string;
  sendRuntimeMessage: RuntimeSendMessage;
  postMainMessage: PostMainMessage;
  targetOrigin: string;
  state: SourceSyncState;
}

function bindSourceSyncLoop(input: BindSourceSyncLoopInput): void {
  if (
    typeof MutationObserver === "undefined" ||
    (typeof input.root.body === "undefined" && typeof input.root.documentElement === "undefined")
  ) {
    return;
  }

  const observeTarget = input.root.body ?? input.root.documentElement;
  if (observeTarget === null) {
    return;
  }

  let scheduled = false;
  let running = false;

  const flush = async (): Promise<void> => {
    if (running || !scheduled) {
      return;
    }

    running = true;
    try {
      while (scheduled) {
        scheduled = false;
        await syncConversationSource({
          hostname: input.hostname,
          conversationUrl: input.getConversationUrl(),
          root: input.root,
          sendRuntimeMessage: input.sendRuntimeMessage,
          postMainMessage: input.postMainMessage,
          targetOrigin: input.targetOrigin,
          state: input.state
        });
      }
    } finally {
      running = false;
    }
  };

  const schedule = (): void => {
    scheduled = true;
    void flush();
  };

  const observer = new MutationObserver(() => {
    schedule();
  });

  observer.observe(observeTarget, {
    subtree: true,
    childList: true,
    characterData: true
  });

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("popstate", schedule);
  }
}

// Bind browser runtime globals and execute one capture attempt.
export async function bootstrapIsolatedCapture(): Promise<CaptureConversationSourceResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "provider-unsupported";
  }

  const sendRuntimeMessage = resolveRuntimeSendMessage();
  if (sendRuntimeMessage === null) {
    return "provider-unsupported";
  }

  const postMainMessage = resolvePostMainMessage();
  if (postMainMessage === null) {
    return "provider-unsupported";
  }

  bindMainTimestampRelay(sendRuntimeMessage);

  const state: SourceSyncState = {
    activeConversationId: null,
    requestedMessageIds: new Set<string>()
  };

  const initialResult = await syncConversationSource({
    hostname: window.location.hostname,
    conversationUrl: window.location.href,
    root: document,
    sendRuntimeMessage,
    postMainMessage,
    targetOrigin: window.location.origin,
    state
  });

  bindSourceSyncLoop({
    hostname: window.location.hostname,
    root: document,
    getConversationUrl: () => window.location.href,
    sendRuntimeMessage,
    postMainMessage,
    targetOrigin: window.location.origin,
    state
  });

  return initialResult;
}

void bootstrapIsolatedCapture();

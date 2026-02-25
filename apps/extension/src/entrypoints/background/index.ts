import { CaptureConversation } from "../../../../../packages/core/src/application/usecases/CaptureConversation";
import { ListBaseMessages } from "../../../../../packages/core/src/application/usecases/ListBaseMessages";
import type { MessagingEvent, MessagingPort } from "../../../../../packages/core/src/application/ports/MessagingPort";
import type { MapHackConversationId } from "../../../../../packages/core/src/domain/value/MapHackConversationId";
import {
  createListBaseMessagesFailure,
  createListBaseMessagesSuccess,
  isApplyTimestampsRequest,
  isCaptureConversationRequest,
  isListBaseMessagesFailure,
  isListBaseMessagesRequest,
  isListBaseMessagesSuccess
} from "../../infra/messaging/runtimeBridge";
import {
  toDomainConversationSource,
  toDomainTimestampMappings,
  toRuntimeMessageRefs
} from "../../infra/messaging/runtimeMapper";
import { resolveProviderIdByHostname } from "../../infra/providers/index";
import { MemoryConversationSourceCache } from "../../infra/storage/memoryCache";

type RuntimeSendResponse = (response?: unknown) => void;

type ChromeRuntimeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: RuntimeSendResponse
) => boolean | void;

type ChromeRuntimeLike = {
  id?: string;
  onMessage?: {
    addListener?: (listener: ChromeRuntimeMessageListener) => void;
  };
};

type ChromeLike = {
  runtime?: ChromeRuntimeLike;
};

class NoopMessagingPort implements MessagingPort {
  async publish(_event: MessagingEvent): Promise<void> {}
}

const sourceStore = new MemoryConversationSourceCache();
const captureConversation = new CaptureConversation(sourceStore, new NoopMessagingPort());
const listBaseMessages = new ListBaseMessages(sourceStore);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string" && error.message.length > 0) {
    return error.message;
  }
  return "unexpected-runtime-error";
}

function resolveRuntimeId(): string | null {
  const chromeLike = (globalThis as { chrome?: ChromeLike }).chrome;
  const runtimeId = chromeLike?.runtime?.id;
  return typeof runtimeId === "string" && runtimeId.length > 0 ? runtimeId : null;
}

function isAllowedSenderUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "chrome-extension:") {
      return true;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    return resolveProviderIdByHostname(parsed.hostname) !== null;
  } catch {
    return false;
  }
}

function isInternalRuntimeSender(sender: unknown): boolean {
  if (!isObject(sender)) {
    return false;
  }

  const runtimeId = resolveRuntimeId();
  if (runtimeId !== null && typeof sender.id === "string" && sender.id !== runtimeId) {
    return false;
  }

  if (typeof sender.url === "string" && sender.url.length > 0) {
    return isAllowedSenderUrl(sender.url);
  }

  return true;
}

function createRuntimeMessageListener(): ChromeRuntimeMessageListener {
  return (message: unknown, sender: unknown, sendResponse: RuntimeSendResponse): boolean | void => {
    // Drop messages from non-internal or unsupported sender contexts.
    if (!isInternalRuntimeSender(sender)) {
      return false;
    }

    if (isCaptureConversationRequest(message)) {
      void captureConversation.execute({
        source: toDomainConversationSource(message.source)
      });
      return false;
    }

    if (isApplyTimestampsRequest(message)) {
      void sourceStore.apply(
        message.conversationId as MapHackConversationId,
        message.source,
        toDomainTimestampMappings(message.mappings)
      );
      return false;
    }

    if (isListBaseMessagesRequest(message)) {
      void listBaseMessages
        .execute({
          conversationId: message.conversationId as MapHackConversationId
        })
        .then((result) => {
          const response = createListBaseMessagesSuccess(
            message.requestId,
            toRuntimeMessageRefs(result.messageRefs)
          );
          if (!isListBaseMessagesSuccess(response)) {
            return;
          }
          sendResponse(response);
        })
        .catch((error: unknown) => {
          const response = createListBaseMessagesFailure(
            message.requestId,
            normalizeErrorMessage(error)
          );
          if (!isListBaseMessagesFailure(response)) {
            return;
          }
          sendResponse(response);
        });

      // Keep response channel open for async result.
      return true;
    }

    // Drop unknown message types (allowlist enforcement).
    return false;
  };
}

function bindBackgroundRuntimeListener(): void {
  const chromeLike = (globalThis as { chrome?: ChromeLike }).chrome;
  const addListener = chromeLike?.runtime?.onMessage?.addListener;
  if (typeof addListener !== "function") {
    return;
  }

  addListener(createRuntimeMessageListener());
}

bindBackgroundRuntimeListener();

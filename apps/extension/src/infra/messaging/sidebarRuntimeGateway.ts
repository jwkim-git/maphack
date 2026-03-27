import type { Bookmark } from "../../../../../packages/core/src/domain/entities/Bookmark";
import type { MessageRef } from "../../../../../packages/core/src/domain/entities/MessageRef";
import type {
  SidebarGateway,
  GatewayResult,
  SourceUpdatedSignal
} from "../../application/ports/SidebarGateway";
import {
  createAddBookmarkRequest,
  createListBaseMessagesRequest,
  createListBookmarksRequest,
  createRemoveBookmarkRequest,
  isAddBookmarkFailure,
  isAddBookmarkSuccess,
  isListBaseMessagesFailure,
  isListBaseMessagesSuccess,
  isListBookmarksFailure,
  isListBookmarksSuccess,
  isRemoveBookmarkFailure,
  isRemoveBookmarkSuccess,
  isSourceUpdatedEvent,
  type RuntimeBookmark,
  type RuntimeMessageRef
} from "./runtimeBridge";
import {
  toDomainBookmark,
  toDomainMessageRef,
  toRuntimeMessageRef
} from "./runtimeMapper";

type RequestScope = "list-base" | "list-bookmarks" | "add-bookmark" | "remove-bookmark";
type RuntimeResponseWithRequestId = { requestId: string };
type RuntimeFailureWithRequestId = RuntimeResponseWithRequestId & { error: string };
type RuntimeMessageListener = (message: unknown) => void;
type ChromeRuntimeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void
) => void;

type ChromeRuntimeLike = {
  sendMessage?: (message: unknown, callback?: (response: unknown) => void) => unknown;
  onMessage?: {
    addListener?: (listener: ChromeRuntimeMessageListener) => void;
    removeListener?: (listener: ChromeRuntimeMessageListener) => void;
  };
};

const RUNTIME_RESPONSE_TIMEOUT_MS = 2_000;
const LIST_BASE_RESPONSE_TIMEOUT_MS = 300;
const LIST_BASE_TIMEOUT = Symbol("list-base-timeout");

export interface RuntimeApi {
  sendMessage(message: unknown): Promise<unknown>;
  addMessageListener(listener: RuntimeMessageListener): () => void;
}

function createRuntimeRequestId(scope: RequestScope): string {
  return `mh-req:${scope}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function resolveChromeRuntime(): ChromeRuntimeLike | null {
  const runtime = (globalThis as { chrome?: { runtime?: ChromeRuntimeLike } }).chrome?.runtime;
  return runtime ?? null;
}

export function createChromeRuntimeApi(): RuntimeApi {
  return {
    sendMessage(message: unknown): Promise<unknown> {
      const runtime = resolveChromeRuntime();
      if (!runtime || typeof runtime.sendMessage !== "function") {
        return Promise.resolve(undefined);
      }

      return new Promise<unknown>((resolve) => {
        let settled = false;
        const settle = (value: unknown): void => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(value);
        };

        const timeoutId = setTimeout(() => {
          settle(undefined);
        }, RUNTIME_RESPONSE_TIMEOUT_MS);

        try {
          runtime.sendMessage?.(message, (response: unknown) => {
            clearTimeout(timeoutId);
            settle(response);
          });
        } catch {
          clearTimeout(timeoutId);
          settle(undefined);
        }
      });
    },

    addMessageListener(listener: RuntimeMessageListener): () => void {
      const runtime = resolveChromeRuntime();
      if (!runtime?.onMessage || typeof runtime.onMessage.addListener !== "function") {
        return () => {};
      }

      const wrapped: ChromeRuntimeMessageListener = (message: unknown) => {
        listener(message);
      };

      runtime.onMessage.addListener(wrapped);
      return () => {
        runtime.onMessage?.removeListener?.(wrapped);
      };
    }
  };
}

async function request<
  TSuccess extends RuntimeResponseWithRequestId,
  TFailure extends RuntimeFailureWithRequestId,
  TRequest extends RuntimeResponseWithRequestId
>(
  runtimeApi: RuntimeApi,
  scope: RequestScope,
  createRequest: (requestId: string) => TRequest,
  isSuccess: (value: unknown) => value is TSuccess,
  isFailure: (value: unknown) => value is TFailure,
  invalidError: string
): Promise<GatewayResult<TSuccess>> {
  const requestPayload = createRequest(createRuntimeRequestId(scope));
  const response = await runtimeApi.sendMessage(requestPayload);

  if (isSuccess(response) && response.requestId === requestPayload.requestId) {
    return { ok: true, value: response };
  }

  if (isFailure(response) && response.requestId === requestPayload.requestId) {
    return { ok: false, error: response.error };
  }

  return { ok: false, error: invalidError };
}

export function createSidebarRuntimeGateway(
  runtimeApi: RuntimeApi = createChromeRuntimeApi()
): SidebarGateway {
  return {
    subscribeSourceUpdated(listener: (signal: SourceUpdatedSignal) => void): () => void {
      return runtimeApi.addMessageListener((message) => {
        if (isSourceUpdatedEvent(message)) {
          listener({
            conversationId: message.conversationId,
            seq: message.seq,
            sessionId: message.sessionId
          });
        }
      });
    },

    async listBaseMessages(conversationId: string): Promise<GatewayResult<MessageRef[]>> {
      const requestId = createRuntimeRequestId("list-base");
      const requestPayload = createListBaseMessagesRequest(requestId, conversationId);

      const response = await Promise.race([
        runtimeApi.sendMessage(requestPayload),
        new Promise<typeof LIST_BASE_TIMEOUT>((resolve) => {
          setTimeout(() => resolve(LIST_BASE_TIMEOUT), LIST_BASE_RESPONSE_TIMEOUT_MS);
        })
      ]);

      if (response === LIST_BASE_TIMEOUT) {
        return { ok: false, error: "list-base-timeout" };
      }

      if (response === undefined) {
        return { ok: false, error: "list-base-no-response" };
      }

      if (isListBaseMessagesSuccess(response) && response.requestId === requestId) {
        return {
          ok: true,
          value: response.messageRefs.map((message: RuntimeMessageRef) =>
            toDomainMessageRef({
              ...message,
              metadata: { ...message.metadata }
            })
          )
        };
      }

      if (isListBaseMessagesFailure(response) && response.requestId === requestId) {
        return { ok: false, error: response.error };
      }

      return { ok: false, error: "list-base-messages-invalid-response" };
    },

    async listBookmarks(): Promise<GatewayResult<Bookmark[]>> {
      const result = await request(
        runtimeApi,
        "list-bookmarks",
        (requestId) => createListBookmarksRequest(requestId),
        isListBookmarksSuccess,
        isListBookmarksFailure,
        "list-bookmarks-invalid-response"
      );

      if (!result.ok) {
        return result;
      }

      return {
        ok: true,
        value: result.value.bookmarks.map((bookmark: RuntimeBookmark) =>
          toDomainBookmark({ ...bookmark })
        )
      };
    },

    async addBookmark(messageRef: MessageRef): Promise<GatewayResult<Bookmark>> {
      const runtimeRef = toRuntimeMessageRef(messageRef);
      const result = await request(
        runtimeApi,
        "add-bookmark",
        (requestId) =>
          createAddBookmarkRequest(requestId, {
            ...runtimeRef,
            metadata: { ...runtimeRef.metadata }
          }),
        isAddBookmarkSuccess,
        isAddBookmarkFailure,
        "add-bookmark-invalid-response"
      );

      if (!result.ok) {
        return result;
      }

      return {
        ok: true,
        value: toDomainBookmark({ ...result.value.bookmark })
      };
    },

    async removeBookmark(bookmarkId: string): Promise<GatewayResult<string>> {
      const result = await request(
        runtimeApi,
        "remove-bookmark",
        (requestId) => createRemoveBookmarkRequest(requestId, bookmarkId),
        isRemoveBookmarkSuccess,
        isRemoveBookmarkFailure,
        "remove-bookmark-invalid-response"
      );

      if (!result.ok) {
        return result;
      }

      return {
        ok: true,
        value: result.value.bookmarkId
      };
    }
  };
}

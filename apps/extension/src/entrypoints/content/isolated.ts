import { bindIsolatedSyncLoop } from "./isolatedSyncLoop";
import { bootstrapSourceSyncState } from "../../application/sourceSync/state";
import {
  relayMainTimestampPayload,
  syncResolvedConversationSource,
  type CaptureResult,
  type RuntimeSendMessage
} from "./isolatedSyncRuntime";
import { mountSidebarInIsolated } from "./sidebarMount";

const INITIAL_SOURCE_SYNC_MAX_ATTEMPTS = 5;
const INITIAL_SOURCE_SYNC_RETRY_DELAY_MS = 200;
const CAPTURE_RECOVERY_RETRY_BACKOFF_MS = [500, 1_000, 2_000, 3_000] as const;

export async function bootstrapIsolatedCapture(): Promise<CaptureResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "provider-unsupported";
  }

  const sendRuntimeMessage: RuntimeSendMessage = (message) => {
    const runtime = (
      globalThis as { chrome?: { runtime?: { sendMessage?: RuntimeSendMessage; id?: string } } }
    ).chrome?.runtime;

    if (
      !runtime ||
      typeof runtime.sendMessage !== "function" ||
      typeof runtime.id !== "string" ||
      runtime.id.length === 0
    ) {
      return Promise.resolve(undefined);
    }

    try {
      return runtime.sendMessage(message);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Extension context invalidated")) {
        return Promise.resolve(undefined);
      }
      return Promise.reject(error);
    }
  };
  const postMainMessage = typeof window.postMessage === "function"
    ? (message: unknown, targetOrigin: string) => window.postMessage(message, targetOrigin)
    : null;
  if (postMainMessage === null) {
    return "provider-unsupported";
  }

  const state = bootstrapSourceSyncState();
  let nextCaptureRetryAt: number | null = null;
  let captureRetryAttempt = 0;
  let refreshRetry = (): void => {};

  const scheduleCaptureRetry = (): void => {
    const attemptIndex = Math.min(
      captureRetryAttempt,
      CAPTURE_RECOVERY_RETRY_BACKOFF_MS.length - 1
    );
    nextCaptureRetryAt = Date.now() + CAPTURE_RECOVERY_RETRY_BACKOFF_MS[attemptIndex];
    captureRetryAttempt = Math.min(
      captureRetryAttempt + 1,
      CAPTURE_RECOVERY_RETRY_BACKOFF_MS.length - 1
    );
  };

  const clearCaptureRetry = (): void => {
    nextCaptureRetryAt = null;
    captureRetryAttempt = 0;
  };

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    void relayMainTimestampPayload({
      event: { source: event.source, origin: event.origin, data: event.data },
      currentWindow: window,
      currentOrigin: window.location.origin,
      sendRuntimeMessage,
      state
    })
      .then((result) => {
        if (result === "failed") {
          console.warn("[MapHack][isolated] timestamp-relay-failed");
        }
      })
      .catch((error) => {
        console.warn("[MapHack][isolated] timestamp-relay-exception", error);
      })
      .finally(() => {
        refreshRetry();
      });
  });

  const syncCurrentConversationSource = async (): Promise<CaptureResult> => {
    try {
      const result = await syncResolvedConversationSource({
        hostname: window.location.hostname,
        root: document,
        sendRuntimeMessage,
        postMainMessage,
        targetOrigin: window.location.origin,
        state
      });
      if (result === "sent" || result === "transition-pending") {
        clearCaptureRetry();
      } else {
        scheduleCaptureRetry();
      }
      return result;
    } catch (error) {
      console.warn("[MapHack][isolated] source-sync-exception", error);
      scheduleCaptureRetry();
      return "capture-failed";
    }
  };

  let initialResult: CaptureResult = "source-unavailable";
  for (let attempt = 0; attempt < INITIAL_SOURCE_SYNC_MAX_ATTEMPTS; attempt += 1) {
    initialResult = await syncCurrentConversationSource();
    if (initialResult === "sent") {
      break;
    }

    if (attempt < INITIAL_SOURCE_SYNC_MAX_ATTEMPTS - 1) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, INITIAL_SOURCE_SYNC_RETRY_DELAY_MS);
      });
    }
  }

  if (initialResult !== "sent" && initialResult !== "transition-pending") {
    console.warn("initial-source-sync-before-sidebar-exhausted", {
      result: initialResult,
      attempts: INITIAL_SOURCE_SYNC_MAX_ATTEMPTS
    });
    nextCaptureRetryAt = Date.now();
  }

  await mountSidebarInIsolated(document);

  const syncLoop = bindIsolatedSyncLoop({
    root: document,
    onSync: async () => {
      await syncCurrentConversationSource();
    },
    getNextRetryAt: () => {
      let nextRetryAt: number | null = nextCaptureRetryAt;
      const now = Date.now();
      const pendingMessageIds = new Set<string>();
      if (state.transitionRetryAt !== null) {
        nextRetryAt = nextRetryAt === null
          ? state.transitionRetryAt
          : Math.min(nextRetryAt, state.transitionRetryAt);
      }
      for (const pending of state.pendingTimestampRequests.values()) {
        nextRetryAt = nextRetryAt === null
          ? pending.expiresAt
          : Math.min(nextRetryAt, pending.expiresAt);

        if (pending.expiresAt <= now) {
          continue;
        }

        for (const messageId of pending.messageIds) {
          pendingMessageIds.add(messageId);
        }
      }
      for (const [messageId, requestState] of state.requestStateByMessageId.entries()) {
        if (pendingMessageIds.has(messageId)) {
          continue;
        }
        if (requestState.status !== "unresolved") {
          continue;
        }
        if (nextRetryAt === null || requestState.retryAt < nextRetryAt) {
          nextRetryAt = requestState.retryAt;
        }
      }
      return nextRetryAt;
    }
  });

  refreshRetry = syncLoop.refreshRetry;

  return initialResult;
}

void bootstrapIsolatedCapture();

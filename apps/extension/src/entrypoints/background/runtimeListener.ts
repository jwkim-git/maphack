import type {
  ConversationSource,
  ConversationSourcePort
} from "../../../../../packages/core/src/application/ports/ConversationSourcePort";
import type { TimestampPort } from "../../../../../packages/core/src/application/ports/TimestampPort";
import type { UserDataBookmarkPort } from "../../../../../packages/core/src/application/ports/UserDataBookmarkPort";
import type { Bookmark } from "../../../../../packages/core/src/domain/entities/Bookmark";
import type { MessageRef } from "../../../../../packages/core/src/domain/entities/MessageRef";
import type { MapHackBookmarkId } from "../../../../../packages/core/src/domain/value/MapHackBookmarkId";
import type { MapHackConversationId } from "../../../../../packages/core/src/domain/value/MapHackConversationId";
import {
  createAddBookmarkFailure,
  createAddBookmarkSuccess,
  createApplyTimestampsFailure,
  createApplyTimestampsSuccess,
  createCaptureConversationFailure,
  createCaptureConversationSuccess,
  createListBaseMessagesFailure,
  createListBaseMessagesSuccess,
  createListBookmarksFailure,
  createListBookmarksSuccess,
  createRemoveBookmarkFailure,
  createRemoveBookmarkSuccess,
  isAddBookmarkFailure,
  isAddBookmarkRequest,
  isAddBookmarkSuccess,
  isApplyTimestampsFailure,
  isApplyTimestampsRequest,
  isApplyTimestampsSuccess,
  isCaptureConversationFailure,
  isCaptureConversationRequest,
  isCaptureConversationSuccess,
  isListBaseMessagesFailure,
  isListBaseMessagesRequest,
  isListBaseMessagesSuccess,
  isListBookmarksFailure,
  isListBookmarksRequest,
  isListBookmarksSuccess,
  isRemoveBookmarkFailure,
  isRemoveBookmarkRequest,
  isRemoveBookmarkSuccess
} from "../../infra/messaging/runtimeBridge";
import {
  toDomainConversationSource,
  toDomainMessageRef,
  toDomainTimestampMappings,
  toRuntimeBookmark,
  toRuntimeBookmarks,
  toRuntimeMessageRefs
} from "../../infra/messaging/runtimeMapper";
import { resolveProviderIdByHostname } from "../../infra/providers/index";
import { reconcileEditedBookmarks } from "../../application/reconcileEditedBookmarks";
import { reconcileBookmarkTimestamps } from "../../application/reconcileBookmarkTimestamps";
import {
  emitBookmarksUpdatedEvent,
  emitSourceUpdatedEvent,
  resolveNextBookmarkRevision,
  resolveNextSourceRevision,
  updateAssistantGenerating,
  resolveAssistantGenerating
} from "../../application/sourceUpdateSession";

export interface BackgroundRuntimeDependencies {
  sourceStore: Pick<
    ConversationSourcePort & TimestampPort,
    "get" | "save" | "listByConversationId" | "apply"
  >;
  bookmarkStore: Pick<UserDataBookmarkPort, "listByConversationId" | "updateEdited" | "updateTimestamp">;
  captureConversation: {
    execute(command: { source: ConversationSource; captureMode: "snapshot" | "delta" }): Promise<unknown>;
  };
  listBaseMessages: {
    execute(command: { conversationId: MapHackConversationId }): Promise<
      | { status: "available"; messageRefs: MessageRef[] }
      | { status: "source-missing" }
    >;
  };
  addBookmark: {
    execute(command: { messageRef: MessageRef }): Promise<Bookmark>;
  };
  removeBookmark: {
    execute(command: { bookmarkId: MapHackBookmarkId }): Promise<unknown>;
  };
  listBookmarks: {
    execute(): Promise<{ bookmarks: Bookmark[] }>;
  };
}

export type RuntimeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void
) => boolean | void;

type ChromeLike = {
  runtime?: {
    id?: string;
  };
  tabs?: {
    query?: (
      queryInfo: { url?: string | string[] },
      callback: (tabs: Array<{ id?: number }>) => void
    ) => void;
  };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : "unexpected-runtime-error";
}

function resolveRuntimeId(): string | null {
  const runtimeId = (globalThis as { chrome?: ChromeLike }).chrome?.runtime?.id;
  return typeof runtimeId === "string" && runtimeId.length > 0 ? runtimeId : null;
}

async function resolveBookmarkSignalTabIds(): Promise<number[]> {
  const tabs = (globalThis as { chrome?: ChromeLike }).chrome?.tabs;
  if (!tabs || typeof tabs.query !== "function") {
    return [];
  }

  return new Promise((resolve) => {
    try {
      tabs.query?.(
        {
          url: ["https://chatgpt.com/*", "https://chat.openai.com/*"]
        },
        (matchedTabs) => {
          const nextTabIds = new Set<number>();
          for (const tab of matchedTabs) {
            if (
              tab &&
              typeof tab.id === "number" &&
              Number.isInteger(tab.id) &&
              tab.id >= 0
            ) {
              nextTabIds.add(tab.id);
            }
          }
          resolve([...nextTabIds]);
        }
      );
    } catch {
      resolve([]);
    }
  });
}

function resolveSenderTabId(sender: unknown): number | null {
  if (!isObject(sender)) {
    return null;
  }

  const tab = sender.tab;
  if (!isObject(tab)) {
    return null;
  }

  const tabId = tab.id;
  return typeof tabId === "number" && Number.isInteger(tabId) && tabId >= 0 ? tabId : null;
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

export function isInternalRuntimeSender(sender: unknown, _message: unknown): boolean {
  if (!isObject(sender)) {
    return false;
  }

  const runtimeId = resolveRuntimeId();
  if (runtimeId !== null && sender.id !== runtimeId) {
    return false;
  }

  if (typeof sender.url !== "string" || sender.url.length === 0) {
    return false;
  }

  return isAllowedSenderUrl(sender.url);
}

export function createBackgroundRuntimeListener(
  dependencies: BackgroundRuntimeDependencies
): RuntimeMessageListener {
  return (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => {
    if (!isInternalRuntimeSender(sender, message)) {
      return false;
    }
    const senderTabId = resolveSenderTabId(sender);

    if (isCaptureConversationRequest(message)) {
      const domainSource = toDomainConversationSource(message.source);
      void dependencies.captureConversation
        .execute({
          source: domainSource,
          captureMode: message.captureMode
        })
        .then(() => {
          const response = createCaptureConversationSuccess(message.requestId);
          if (isCaptureConversationSuccess(response)) {
            sendResponse(response);
          }

          const conversationId = domainSource.conversation.id;
          updateAssistantGenerating(conversationId, message.assistantGenerating);
          const sourceRevision = resolveNextSourceRevision(conversationId);
          emitSourceUpdatedEvent(conversationId, sourceRevision, senderTabId, message.assistantGenerating);

          void (async () => {
            const editedResult = await reconcileEditedBookmarks(
              conversationId,
              dependencies.sourceStore,
              dependencies.bookmarkStore
            );
            const timestampResult = await reconcileBookmarkTimestamps(
              conversationId,
              dependencies.sourceStore,
              dependencies.bookmarkStore
            );

            if (editedResult.updatedCount + timestampResult.updatedCount === 0) {
              return;
            }

            const tabIds = await resolveBookmarkSignalTabIds();
            const bookmarkRevision = resolveNextBookmarkRevision();
            emitBookmarksUpdatedEvent(tabIds, bookmarkRevision);
          })().catch((error: unknown) => {
            console.error("capture-post-sync-failed", error);
          });
        })
        .catch((error: unknown) => {
          const response = createCaptureConversationFailure(
            message.requestId,
            normalizeErrorMessage(error)
          );
          if (isCaptureConversationFailure(response)) {
            sendResponse(response);
          }
        });
      return true;
    }

    if (isApplyTimestampsRequest(message)) {
      const conversationId = message.conversationId as MapHackConversationId;
      void dependencies.sourceStore
        .apply(
          conversationId,
          message.source,
          toDomainTimestampMappings(message.mappings)
        )
        .then((applyResult) => {
          if (applyResult.kind === "updated") {
            const sourceRevision = resolveNextSourceRevision(conversationId);
            emitSourceUpdatedEvent(conversationId, sourceRevision, senderTabId, resolveAssistantGenerating(conversationId));
          }

          const response =
            applyResult.kind === "source-missing"
              ? createApplyTimestampsFailure(
                  message.requestId,
                  conversationId,
                  "snapshot-required"
                )
              : createApplyTimestampsSuccess(message.requestId, conversationId);

          const isExpectedResponse =
            applyResult.kind === "source-missing"
              ? isApplyTimestampsFailure(response)
              : isApplyTimestampsSuccess(response);

          if (isExpectedResponse) {
            sendResponse(response);
          }

          if (applyResult.kind === "updated") {
            void (async () => {
              const { updatedCount } = await reconcileBookmarkTimestamps(
                conversationId,
                dependencies.sourceStore,
                dependencies.bookmarkStore
              );
              if (updatedCount === 0) {
                return;
              }

              const tabIds = await resolveBookmarkSignalTabIds();
              const bookmarkRevision = resolveNextBookmarkRevision();
              emitBookmarksUpdatedEvent(tabIds, bookmarkRevision);
            })().catch((error: unknown) => {
              console.error("apply-post-sync-failed", error);
            });
          }
        })
        .catch((error: unknown) => {
          console.error("apply-timestamps-failed", normalizeErrorMessage(error));
          const response = createApplyTimestampsFailure(
            message.requestId,
            conversationId,
            "apply-failed"
          );
          if (isApplyTimestampsFailure(response)) {
            sendResponse(response);
          }
        });
      return true;
    }

    if (isAddBookmarkRequest(message)) {
      void dependencies.addBookmark
        .execute({ messageRef: toDomainMessageRef(message.messageRef) })
        .then((bookmark) => {
          const response = createAddBookmarkSuccess(message.requestId, toRuntimeBookmark(bookmark));
          if (isAddBookmarkSuccess(response)) {
            sendResponse(response);
          }

          void (async () => {
            const tabIds = await resolveBookmarkSignalTabIds();
            const bookmarkRevision = resolveNextBookmarkRevision();
            emitBookmarksUpdatedEvent(tabIds, bookmarkRevision);
          })().catch((error: unknown) => {
            console.error("bookmark-add-post-sync-failed", error);
          });
        })
        .catch((error: unknown) => {
          const response = createAddBookmarkFailure(message.requestId, normalizeErrorMessage(error));
          if (isAddBookmarkFailure(response)) {
            sendResponse(response);
          }
        });
      return true;
    }

    if (isRemoveBookmarkRequest(message)) {
      void dependencies.removeBookmark
        .execute({ bookmarkId: message.bookmarkId as MapHackBookmarkId })
        .then(() => {
          const response = createRemoveBookmarkSuccess(message.requestId, message.bookmarkId);
          if (isRemoveBookmarkSuccess(response)) {
            sendResponse(response);
          }

          void (async () => {
            const tabIds = await resolveBookmarkSignalTabIds();
            const bookmarkRevision = resolveNextBookmarkRevision();
            emitBookmarksUpdatedEvent(tabIds, bookmarkRevision);
          })().catch((error: unknown) => {
            console.error("bookmark-remove-post-sync-failed", error);
          });
        })
        .catch((error: unknown) => {
          const response = createRemoveBookmarkFailure(message.requestId, normalizeErrorMessage(error));
          if (isRemoveBookmarkFailure(response)) {
            sendResponse(response);
          }
        });
      return true;
    }

    if (isListBookmarksRequest(message)) {
      void dependencies.listBookmarks
        .execute()
        .then((result) => {
          const response = createListBookmarksSuccess(message.requestId, toRuntimeBookmarks(result.bookmarks));
          if (isListBookmarksSuccess(response)) {
            sendResponse(response);
          }
        })
        .catch((error: unknown) => {
          const response = createListBookmarksFailure(message.requestId, normalizeErrorMessage(error));
          if (isListBookmarksFailure(response)) {
            sendResponse(response);
          }
        });
      return true;
    }

    if (!isListBaseMessagesRequest(message)) {
      return false;
    }

    void dependencies.listBaseMessages
      .execute({ conversationId: message.conversationId as MapHackConversationId })
      .then((result) => {
        if (result.status === "source-missing") {
          const response = createListBaseMessagesFailure(
            message.requestId,
            "list-base-source-missing"
          );
          if (isListBaseMessagesFailure(response)) {
            sendResponse(response);
          }
          return;
        }

        const response = createListBaseMessagesSuccess(
          message.requestId,
          toRuntimeMessageRefs(result.messageRefs)
        );
        if (isListBaseMessagesSuccess(response)) {
          sendResponse(response);
        }
      })
      .catch((error: unknown) => {
        const response = createListBaseMessagesFailure(
          message.requestId,
          normalizeErrorMessage(error)
        );
        if (isListBaseMessagesFailure(response)) {
          sendResponse(response);
        }
      });

    return true;
  };
}

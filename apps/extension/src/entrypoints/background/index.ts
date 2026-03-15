import { AddBookmark } from "../../../../../packages/core/src/application/usecases/AddBookmark";
import { CaptureConversation } from "../../../../../packages/core/src/application/usecases/CaptureConversation";
import { ListBaseMessages } from "../../../../../packages/core/src/application/usecases/ListBaseMessages";
import { ListBookmarks } from "../../../../../packages/core/src/application/usecases/ListBookmarks";
import { RemoveBookmark } from "../../../../../packages/core/src/application/usecases/RemoveBookmark";
import type {
  ConversationSource
} from "../../../../../packages/core/src/application/ports/ConversationSourcePort";
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
  createSourceUpdatedEvent,
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
  isRemoveBookmarkSuccess,
  isSourceUpdatedEvent
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
import { IndexedDbBookmarkStore } from "../../infra/storage/indexedDb";
import { MemoryConversationSourceCache } from "../../infra/storage/memoryCache";
import type { RuntimeConversationSource } from "../../../../../packages/shared/src/types/runtimeMessages";

export interface BackgroundRuntimeDependencies {
  sourceStore: Pick<
    MemoryConversationSourceCache,
    "apply" | "listByConversationId" | "countUnresolvedByConversationId"
  >;
  bookmarkStore: Pick<UserDataBookmarkPort, "listByConversationId" | "updateEdited">;
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

let defaultDependencies: BackgroundRuntimeDependencies | null = null;
let defaultListener: RuntimeMessageListener | null = null;

type RuntimeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void
) => boolean | void;

type ChromeLike = {
  runtime?: {
    id?: string;
    sendMessage?: (message: unknown) => void;
    onMessage?: { addListener?: (listener: RuntimeMessageListener) => void };
  };
  tabs?: {
    sendMessage?: (tabId: number, message: unknown) => void;
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

const sourceVersionByConversationId = new Map<string, number>();
const backgroundSessionId = `bg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

function resolveNextConversationSeq(conversationId: string): number {
  const nextSeq = (sourceVersionByConversationId.get(conversationId) ?? 0) + 1;
  sourceVersionByConversationId.set(conversationId, nextSeq);
  return nextSeq;
}

function emitSourceUpdatedEvent(conversationId: string, seq: number, senderTabId: number | null): void {
  const chromeLike = (globalThis as { chrome?: ChromeLike }).chrome;
  const event = createSourceUpdatedEvent(conversationId, seq, backgroundSessionId);
  if (!isSourceUpdatedEvent(event)) {
    return;
  }

  if (senderTabId !== null) {
    const tabs = chromeLike?.tabs;
    if (tabs && typeof tabs.sendMessage === "function") {
      tabs.sendMessage(senderTabId, event);
    }
    return;
  }

  const runtime = chromeLike?.runtime;
  if (runtime && typeof runtime.sendMessage === "function") {
    runtime.sendMessage(event);
  }
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
  const pendingTurnIndexesByConversationId = new Map<string, Set<number>>();

  function resolveTurnIndexesFromRuntimeSource(source: RuntimeConversationSource): Set<number> {
    const turnIndexes = new Set<number>();
    for (const messageRef of source.messageRefs) {
      turnIndexes.add(messageRef.metadata.turnIndex);
    }
    return turnIndexes;
  }

  function mergePendingTurnIndexes(conversationId: string, turnIndexes: Set<number>): void {
    const pending = pendingTurnIndexesByConversationId.get(conversationId) ?? new Set<number>();
    for (const turnIndex of turnIndexes) {
      pending.add(turnIndex);
    }
    pendingTurnIndexesByConversationId.set(conversationId, pending);
  }

  function setSnapshotPendingTurnIndexes(conversationId: string, turnIndexes: Set<number>): void {
    const existing = pendingTurnIndexesByConversationId.get(conversationId);
    if (existing && existing.size > 0) {
      return;
    }
    pendingTurnIndexesByConversationId.set(conversationId, new Set(turnIndexes));
  }

  async function reconcileEditedBookmarks(
    conversationId: string,
    turnIndexes: Set<number>
  ): Promise<void> {
    if (turnIndexes.size === 0) {
      return;
    }

    const [messageRefs, bookmarks] = await Promise.all([
      dependencies.sourceStore.listByConversationId(conversationId as MapHackConversationId),
      dependencies.bookmarkStore.listByConversationId(conversationId as MapHackConversationId)
    ]);

    const latestMessageIdByTurnIndex = new Map<number, string>();
    for (const messageRef of messageRefs) {
      latestMessageIdByTurnIndex.set(messageRef.metadata.turnIndex, messageRef.id);
    }

    for (const bookmark of bookmarks) {
      if (!turnIndexes.has(bookmark.turnIndex)) {
        continue;
      }

      const latestMessageId = latestMessageIdByTurnIndex.get(bookmark.turnIndex);
      if (latestMessageId === undefined) {
        continue;
      }

      const nextEdited = latestMessageId !== bookmark.messageId;
      if (bookmark.edited === nextEdited) {
        continue;
      }

      await dependencies.bookmarkStore.updateEdited(bookmark.id, nextEdited);
    }
  }

  return (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => {
    if (!isInternalRuntimeSender(sender, message)) {
      return false;
    }
    const senderTabId = resolveSenderTabId(sender);

    if (isCaptureConversationRequest(message)) {
      const turnIndexes = resolveTurnIndexesFromRuntimeSource(message.source);

      void dependencies.captureConversation
        .execute({
          source: toDomainConversationSource(message.source),
          captureMode: message.captureMode
        })
        .then(() => {
          if (message.captureMode === "snapshot") {
            setSnapshotPendingTurnIndexes(message.source.conversation.id, turnIndexes);
          } else {
            mergePendingTurnIndexes(message.source.conversation.id, turnIndexes);
          }

          const response = createCaptureConversationSuccess(message.requestId);
          if (isCaptureConversationSuccess(response)) {
            sendResponse(response);
          }
        })
        .catch((error: unknown) => {
          if (
            message.captureMode === "delta" &&
            normalizeErrorMessage(error) === "snapshot-required"
          ) {
            mergePendingTurnIndexes(message.source.conversation.id, turnIndexes);
          }

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
      void dependencies.sourceStore
        .apply(
          message.conversationId as MapHackConversationId,
          message.source,
          toDomainTimestampMappings(message.mappings)
        )
        .then(async () => {
          const unresolvedCount = await dependencies.sourceStore.countUnresolvedByConversationId(
            message.conversationId as MapHackConversationId
          );
          const ready = unresolvedCount === 0;

          if (ready) {
            const pendingTurnIndexes =
              pendingTurnIndexesByConversationId.get(message.conversationId) ?? new Set<number>();

            await reconcileEditedBookmarks(message.conversationId, pendingTurnIndexes);
            pendingTurnIndexesByConversationId.delete(message.conversationId);
          }

          const seq = resolveNextConversationSeq(message.conversationId);

          if (ready) {
            emitSourceUpdatedEvent(message.conversationId, seq, senderTabId);
          }

          const response = createApplyTimestampsSuccess(
            message.requestId,
            message.conversationId,
            unresolvedCount,
            ready,
            seq
          );
          if (isApplyTimestampsSuccess(response)) {
            sendResponse(response);
          }
        })
        .catch((error: unknown) => {
          const response = createApplyTimestampsFailure(
            message.requestId,
            message.conversationId,
            normalizeErrorMessage(error)
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

function createDefaultDependencies(): BackgroundRuntimeDependencies {
  const sourceStore = new MemoryConversationSourceCache();
  const bookmarkStore = new IndexedDbBookmarkStore();

  return {
    sourceStore,
    bookmarkStore,
    captureConversation: new CaptureConversation(sourceStore),
    listBaseMessages: new ListBaseMessages(sourceStore),
    addBookmark: new AddBookmark(bookmarkStore),
    removeBookmark: new RemoveBookmark(bookmarkStore),
    listBookmarks: new ListBookmarks(bookmarkStore)
  };
}

function resolveDefaultDependencies(): BackgroundRuntimeDependencies {
  if (defaultDependencies === null) {
    defaultDependencies = createDefaultDependencies();
  }

  return defaultDependencies;
}

function resolveBackgroundRuntimeListener(): RuntimeMessageListener {
  if (defaultListener === null) {
    defaultListener = createBackgroundRuntimeListener(resolveDefaultDependencies());
  }

  return defaultListener;
}

function bindBackgroundRuntimeListener(): void {
  const runtime = (globalThis as { chrome?: ChromeLike }).chrome?.runtime;
  const onMessage = runtime?.onMessage;
  if (!onMessage || typeof onMessage.addListener !== "function") {
    return;
  }

  onMessage.addListener((message, sender, sendResponse) => {
    try {
      return resolveBackgroundRuntimeListener()(message, sender, sendResponse);
    } catch (error) {
      console.error("background-runtime-listener-failed", error);
      return false;
    }
  });
}

bindBackgroundRuntimeListener();

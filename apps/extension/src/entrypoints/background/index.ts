import { AddBookmark } from "../../../../../packages/core/src/application/usecases/AddBookmark";
import { CaptureConversation } from "../../../../../packages/core/src/application/usecases/CaptureConversation";
import { ListBaseMessages } from "../../../../../packages/core/src/application/usecases/ListBaseMessages";
import { ListBookmarks } from "../../../../../packages/core/src/application/usecases/ListBookmarks";
import { RemoveBookmark } from "../../../../../packages/core/src/application/usecases/RemoveBookmark";
import { IndexedDbBookmarkStore } from "../../infra/storage/indexedDb";
import { MemoryConversationSourceCache } from "../../infra/storage/memoryCache";
import {
  createBackgroundRuntimeListener,
  type BackgroundRuntimeDependencies,
  type RuntimeMessageListener
} from "./runtimeListener";

type ChromeLike = {
  runtime?: {
    onMessage?: { addListener?: (listener: RuntimeMessageListener) => void };
  };
};

let defaultDependencies: BackgroundRuntimeDependencies | null = null;
let defaultListener: RuntimeMessageListener | null = null;

function createDefaultDependencies(): BackgroundRuntimeDependencies {
  const sourceStore = new MemoryConversationSourceCache();
  const bookmarkStore = new IndexedDbBookmarkStore();

  return {
    sourceStore,
    bookmarkStore,
    captureConversation: new CaptureConversation(sourceStore),
    listBaseMessages: new ListBaseMessages(sourceStore),
    addBookmark: new AddBookmark(bookmarkStore, sourceStore),
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

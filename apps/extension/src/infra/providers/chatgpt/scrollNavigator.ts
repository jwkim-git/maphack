import type {
  TurnNavigationTarget,
  TurnNavigator
} from "../../../application/ports/TurnNavigator";
import { CHATGPT_SCROLL_CONTAINER_PRIMARY } from "./selectors";
import {
  findChatgptTurnElementByMessageId,
  findChatgptTurnElementByTurnIndex
} from "./turnIndex";

type ChatgptScrollContainerResolutionStrategyContract = {
  primary: string;
  fallbacks: readonly ("closest-overflow-scroll-container" | "document-scrolling-element")[];
};

const CHATGPT_SCROLL_CONTAINER_RESOLUTION_STRATEGY = {
  primary: CHATGPT_SCROLL_CONTAINER_PRIMARY,
  fallbacks: [
    "closest-overflow-scroll-container",
    "document-scrolling-element"
  ]
} as const satisfies ChatgptScrollContainerResolutionStrategyContract;

type ChatgptScrollContainerResolutionStrategy = typeof CHATGPT_SCROLL_CONTAINER_RESOLUTION_STRATEGY;

type ChatgptTurnNavigatorOptions = {
  documentRef: Document;
  windowRef: Window;
  storageRef?: Storage | null;
};

type PersistedTurnNavigationTarget = {
  conversationId: string;
  conversationUrl: string;
  messageId: string;
  turnIndex: number;
};

const CHATGPT_PENDING_NAVIGATION_STORAGE_KEY = "maphack:chatgpt-pending-turn-navigation";

function resolveClosestOverflowScrollContainer(
  messageContainers: readonly Element[],
  windowRef: Window
): Element | null {
  for (const messageElement of messageContainers) {
    let current: Element | null = messageElement.parentElement;
    while (current) {
      const overflowY = windowRef.getComputedStyle(current).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        return current;
      }
      current = current.parentElement;
    }
  }

  return null;
}

function resolveChatgptScrollContainer(
  root: Document,
  messageContainers: readonly Element[],
  windowRef: Window
): Element | null {
  const strategy: ChatgptScrollContainerResolutionStrategy = CHATGPT_SCROLL_CONTAINER_RESOLUTION_STRATEGY;

  const fromPrimary = root.querySelector(strategy.primary);
  if (fromPrimary) {
    return fromPrimary;
  }

  for (const fallback of strategy.fallbacks) {
    if (fallback === "closest-overflow-scroll-container") {
      const fromClosest = resolveClosestOverflowScrollContainer(messageContainers, windowRef);
      if (fromClosest) {
        return fromClosest;
      }
      continue;
    }

    if (fallback === "document-scrolling-element") {
      return (root.scrollingElement as Element | null) ?? null;
    }
  }

  return null;
}

function resolveSessionStorage(windowRef: Window, storageRef?: Storage | null): Storage | null {
  if (storageRef !== undefined) {
    return storageRef;
  }

  try {
    return windowRef.sessionStorage;
  } catch {
    return null;
  }
}

function isPersistedTurnNavigationTarget(value: unknown): value is PersistedTurnNavigationTarget {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.conversationId === "string" &&
    typeof candidate.conversationUrl === "string" &&
    typeof candidate.messageId === "string" &&
    typeof candidate.turnIndex === "number"
  );
}

function readPendingTarget(storageRef: Storage | null): PersistedTurnNavigationTarget | null {
  if (!storageRef) {
    return null;
  }

  try {
    const raw = storageRef.getItem(CHATGPT_PENDING_NAVIGATION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return isPersistedTurnNavigationTarget(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writePendingTarget(
  storageRef: Storage | null,
  target: TurnNavigationTarget
): void {
  if (!storageRef) {
    return;
  }

  try {
    storageRef.setItem(
      CHATGPT_PENDING_NAVIGATION_STORAGE_KEY,
      JSON.stringify(target)
    );
  } catch {}
}

function clearPendingTarget(storageRef: Storage | null): void {
  if (!storageRef) {
    return;
  }

  try {
    storageRef.removeItem(CHATGPT_PENDING_NAVIGATION_STORAGE_KEY);
  } catch {}
}

function resolveScrollContainerVisibleStartOffset(
  scrollContainer: Element,
  windowRef: Window
): number {
  const rawValue = windowRef.getComputedStyle(scrollContainer).scrollPaddingTop;
  const parsedValue = Number.parseFloat(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function scrollTurnElementIntoView(
  root: Document,
  turnElement: Element,
  windowRef: Window
): void {
  const scrollContainer = resolveChatgptScrollContainer(root, [turnElement], windowRef);
  if (!scrollContainer) {
    turnElement.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const visibleStartOffset = resolveScrollContainerVisibleStartOffset(scrollContainer, windowRef);
  const nextTop =
    scrollContainer.scrollTop +
    (turnElement.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top) -
    visibleStartOffset;

  scrollContainer.scrollTo({
    top: nextTop,
    behavior: "smooth"
  });
}

function findChatgptTurnElementByTarget(
  root: Document,
  target: PersistedTurnNavigationTarget | TurnNavigationTarget
): Element | null {
  return (
    findChatgptTurnElementByMessageId(root, target.messageId) ??
    findChatgptTurnElementByTurnIndex(root, target.turnIndex)
  );
}

async function consumePendingTarget(
  root: Document,
  windowRef: Window,
  storageRef: Storage | null,
  readyConversationId: string
): Promise<void> {
  const pendingTarget = readPendingTarget(storageRef);
  if (!pendingTarget) {
    return;
  }

  if (pendingTarget.conversationId !== readyConversationId) {
    return;
  }

  const turnElement = findChatgptTurnElementByTarget(root, pendingTarget);
  if (!turnElement) {
    return;
  }

  scrollTurnElementIntoView(root, turnElement, windowRef);
  clearPendingTarget(storageRef);
}

export function createChatgptTurnNavigator(
  options: ChatgptTurnNavigatorOptions
): TurnNavigator {
  const { documentRef, windowRef } = options;
  const storageRef = resolveSessionStorage(windowRef, options.storageRef);

  return {
    async navigateWithinConversation(target: TurnNavigationTarget): Promise<void> {
      const turnElement = findChatgptTurnElementByTarget(documentRef, target);
      if (!turnElement) {
        return;
      }

      scrollTurnElementIntoView(documentRef, turnElement, windowRef);
    },

    async navigateAcrossConversations(target: TurnNavigationTarget): Promise<void> {
      writePendingTarget(storageRef, target);
      windowRef.location.assign(target.conversationUrl);
    },

    async consumePendingNavigation(readyConversationId: string): Promise<void> {
      await consumePendingTarget(documentRef, windowRef, storageRef, readyConversationId);
    }
  };
}

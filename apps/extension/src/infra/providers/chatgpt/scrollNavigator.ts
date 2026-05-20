import type {
  TurnNavigationTarget,
  TurnNavigator
} from "../../../application/ports/TurnNavigator";
import {
  startScrollPositionSettler,
  type ScrollPositionSettlerTransaction,
  type StartScrollPositionSettler
} from "../../browser/scrollPositionSettler";
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
  scrollPositionSettler?: StartScrollPositionSettler;
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

function findChatgptTurnElementByTarget(
  root: Document,
  target: PersistedTurnNavigationTarget | TurnNavigationTarget
): Element | null {
  return (
    findChatgptTurnElementByMessageId(root, target.messageId) ??
    findChatgptTurnElementByTurnIndex(root, target.turnIndex)
  );
}

export function createChatgptTurnNavigator(
  options: ChatgptTurnNavigatorOptions
): TurnNavigator {
  const { documentRef, windowRef } = options;
  const storageRef = resolveSessionStorage(windowRef, options.storageRef);
  const scrollPositionSettler = options.scrollPositionSettler ?? startScrollPositionSettler;
  let pendingObserver: MutationObserver | null = null;
  let activeScrollTransaction: ScrollPositionSettlerTransaction | null = null;

  function disposePendingObserver(): void {
    if (pendingObserver) {
      pendingObserver.disconnect();
      pendingObserver = null;
    }
  }

  function disposeActiveScrollTransaction(): void {
    activeScrollTransaction?.dispose();
    activeScrollTransaction = null;
  }

  function completeActiveScrollTransaction(
    transaction: ScrollPositionSettlerTransaction | null,
    callback: () => void
  ): void {
    if (!transaction || activeScrollTransaction !== transaction) {
      return;
    }

    activeScrollTransaction = null;
    callback();
  }

  function startTurnNavigationSettlement(
    turnElement: Element,
    callbacks: {
      onSettled: () => void;
      onUnavailable: () => void;
      onAborted: () => void;
    }
  ): boolean {
    const scrollContainer = resolveChatgptScrollContainer(documentRef, [turnElement], windowRef);
    if (!scrollContainer) {
      return false;
    }

    disposeActiveScrollTransaction();
    let transaction: ScrollPositionSettlerTransaction | null = null;
    transaction = scrollPositionSettler({
      targetElement: turnElement,
      scrollContainer,
      windowRef,
      onSettled: () => completeActiveScrollTransaction(transaction, callbacks.onSettled),
      onUnavailable: () => completeActiveScrollTransaction(transaction, callbacks.onUnavailable),
      onAborted: () => completeActiveScrollTransaction(transaction, callbacks.onAborted)
    });
    activeScrollTransaction = transaction;
    return true;
  }

  function resolveMutationObserver(): typeof MutationObserver | null {
    const fromWindow = (windowRef as Window & { MutationObserver?: typeof MutationObserver }).MutationObserver;
    if (fromWindow) {
      return fromWindow;
    }

    return typeof MutationObserver === "undefined" ? null : MutationObserver;
  }

  function armPendingNavigationObserver(pendingTarget: PersistedTurnNavigationTarget): void {
    disposePendingObserver();

    const observeTarget = documentRef.body ?? documentRef.documentElement;
    const MutationObserverCtor = resolveMutationObserver();
    if (!observeTarget || !MutationObserverCtor) {
      return;
    }

    pendingObserver = new MutationObserverCtor(() => {
      void tryStartPendingNavigation(pendingTarget);
    });
    pendingObserver.observe(observeTarget, {
      subtree: true,
      childList: true
    });
  }

  function tryStartPendingNavigation(pendingTarget: PersistedTurnNavigationTarget): boolean {
    const turnElement = findChatgptTurnElementByTarget(documentRef, pendingTarget);
    if (!turnElement) {
      return false;
    }

    disposePendingObserver();
    return startTurnNavigationSettlement(turnElement, {
      onSettled: () => clearPendingTarget(storageRef),
      onUnavailable: () => armPendingNavigationObserver(pendingTarget),
      onAborted: () => clearPendingTarget(storageRef)
    });
  }

  return {
    async navigateWithinConversation(target: TurnNavigationTarget): Promise<void> {
      disposePendingObserver();
      disposeActiveScrollTransaction();
      clearPendingTarget(storageRef);

      const turnElement = findChatgptTurnElementByTarget(documentRef, target);
      if (!turnElement) {
        return;
      }

      startTurnNavigationSettlement(turnElement, {
        onSettled: () => {},
        onUnavailable: () => {},
        onAborted: () => {}
      });
    },

    async navigateAcrossConversations(target: TurnNavigationTarget): Promise<void> {
      disposePendingObserver();
      disposeActiveScrollTransaction();
      writePendingTarget(storageRef, target);
      windowRef.location.assign(target.conversationUrl);
    },

    async consumePendingNavigation(readyConversationId: string): Promise<void> {
      disposePendingObserver();

      const pendingTarget = readPendingTarget(storageRef);
      if (!pendingTarget || pendingTarget.conversationId !== readyConversationId) {
        return;
      }

      if (!tryStartPendingNavigation(pendingTarget)) {
        armPendingNavigationObserver(pendingTarget);
      }
    }
  };
}

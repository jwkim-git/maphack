import { CHATGPT_SCROLL_CONTAINER_PRIMARY } from "./selectors";

type ChatgptScrollContainerResolutionStrategyContract = {
  primary: string;
  fallbacks: readonly ("closest-overflow-scroll-container" | "document-scrolling-element")[];
};

export const CHATGPT_SCROLL_CONTAINER_RESOLUTION_STRATEGY = {
  primary: CHATGPT_SCROLL_CONTAINER_PRIMARY,
  fallbacks: [
    "closest-overflow-scroll-container",
    "document-scrolling-element"
  ]
} as const satisfies ChatgptScrollContainerResolutionStrategyContract;

type ChatgptScrollContainerResolutionStrategy = typeof CHATGPT_SCROLL_CONTAINER_RESOLUTION_STRATEGY;

function resolveClosestOverflowScrollContainer(
  root: Document,
  messageContainers: readonly Element[]
): Element | null {
  for (const messageElement of messageContainers) {
    let current: Element | null = messageElement.parentElement;
    while (current) {
      const overflowY = root.defaultView?.getComputedStyle(current).overflowY ?? "";
      if (overflowY === "auto" || overflowY === "scroll") {
        return current;
      }
      current = current.parentElement;
    }
  }

  return null;
}

export function resolveChatgptScrollContainer(
  root: Document,
  messageContainers: readonly Element[]
): Element | null {
  const strategy: ChatgptScrollContainerResolutionStrategy = CHATGPT_SCROLL_CONTAINER_RESOLUTION_STRATEGY;

  const fromPrimary = root.querySelector(strategy.primary);
  if (fromPrimary) {
    return fromPrimary;
  }

  for (const fallback of strategy.fallbacks) {
    if (fallback === "closest-overflow-scroll-container") {
      const fromClosest = resolveClosestOverflowScrollContainer(root, messageContainers);
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


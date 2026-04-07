import {
  CHATGPT_AGENT_TURN_SELECTOR,
  CHATGPT_MESSAGE_CONTAINER_FALLBACKS,
  CHATGPT_MESSAGE_CONTAINER_PRIMARY,
  CHATGPT_SCROLL_CONTAINER_PRIMARY
} from "./selectors";

export type ChatgptCaptureScope = {
  container: Element;
  messageContainers: Element[];
};

function resolveAgentTurnContainers(root: ParentNode): Element[] {
  const agentTurns = Array.from(root.querySelectorAll(CHATGPT_AGENT_TURN_SELECTOR));
  return agentTurns.filter((el) =>
    el.querySelector("img[src]") !== null &&
    el.closest("[data-message-id]") === null
  );
}

function sortByDocumentOrder(elements: Element[]): Element[] {
  return elements.sort((a, b) => {
    const position = a.compareDocumentPosition(b);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

function resolveChatgptMessageContainers(root: ParentNode): Element[] {
  const fromPrimary = Array.from(root.querySelectorAll(CHATGPT_MESSAGE_CONTAINER_PRIMARY));
  const fromAgentTurn = resolveAgentTurnContainers(root);

  if (fromPrimary.length > 0 || fromAgentTurn.length > 0) {
    return sortByDocumentOrder([...fromPrimary, ...fromAgentTurn]);
  }

  const hasCommittedMessageDescendant = (element: Element): boolean =>
    element.querySelector(CHATGPT_MESSAGE_CONTAINER_PRIMARY) !== null;

  for (const selector of CHATGPT_MESSAGE_CONTAINER_FALLBACKS) {
    const fromFallback = Array.from(root.querySelectorAll(selector)).filter(
      hasCommittedMessageDescendant
    );
    if (fromFallback.length > 0) {
      return fromFallback;
    }
  }

  return [];
}

function isRenderedElement(element: Element, windowRef: Window): boolean {
  if (!element.isConnected) {
    return false;
  }

  if (element.getClientRects().length === 0) {
    return false;
  }

  const style = windowRef.getComputedStyle(element);
  if (!style) {
    return true;
  }

  return style.display !== "none" && style.visibility !== "hidden";
}

function resolveClosestOverflowContainer(element: Element, windowRef: Window): Element | null {
  let current: Element | null = element.parentElement;
  while (current) {
    const overflowY = windowRef.getComputedStyle(current).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

export function resolveChatgptCaptureScope(root: Document, windowRef: Window): ChatgptCaptureScope | null {
  const primaryContainers = Array.from(root.querySelectorAll(CHATGPT_SCROLL_CONTAINER_PRIMARY));
  const primaryScopes = primaryContainers
    .map((container) => ({
      container,
      messageContainers: resolveChatgptMessageContainers(container).filter((element) =>
        isRenderedElement(element, windowRef)
      )
    }))
    .filter((scope) => scope.messageContainers.length > 0);

  if (primaryScopes.length === 1) {
    return primaryScopes[0];
  }

  if (primaryScopes.length > 1) {
    return null;
  }

  const renderedRows = resolveChatgptMessageContainers(root).filter((element) =>
    isRenderedElement(element, windowRef)
  );
  if (renderedRows.length === 0) {
    return null;
  }

  const distinctContainers = new Set<Element>();
  for (const row of renderedRows) {
    const container = resolveClosestOverflowContainer(row, windowRef);
    if (!container) {
      return null;
    }
    distinctContainers.add(container);
  }

  if (distinctContainers.size !== 1) {
    return null;
  }

  return {
    container: Array.from(distinctContainers)[0],
    messageContainers: renderedRows
  };
}

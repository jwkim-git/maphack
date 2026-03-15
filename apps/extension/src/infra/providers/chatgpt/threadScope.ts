import {
  CHATGPT_MESSAGE_CONTAINER_FALLBACKS,
  CHATGPT_MESSAGE_CONTAINER_PRIMARY,
  CHATGPT_SCROLL_CONTAINER_PRIMARY
} from "./selectors";

export type ChatgptCaptureScope = {
  container: Element;
  messageContainers: Element[];
};

function resolveChatgptMessageContainers(root: ParentNode): Element[] {
  const fromPrimary = Array.from(root.querySelectorAll(CHATGPT_MESSAGE_CONTAINER_PRIMARY));
  if (fromPrimary.length > 0) {
    return fromPrimary;
  }

  for (const selector of CHATGPT_MESSAGE_CONTAINER_FALLBACKS) {
    const fromFallback = Array.from(root.querySelectorAll(selector));
    if (fromFallback.length > 0) {
      return fromFallback;
    }
  }

  return [];
}

function isRenderedElement(element: Element, root: Document): boolean {
  if (!element.isConnected) {
    return false;
  }

  if (element.getClientRects().length === 0) {
    return false;
  }

  const style = root.defaultView?.getComputedStyle(element);
  if (!style) {
    return true;
  }

  return style.display !== "none" && style.visibility !== "hidden";
}

function resolveClosestOverflowContainer(root: Document, element: Element): Element | null {
  let current: Element | null = element.parentElement;
  while (current) {
    const overflowY = root.defaultView?.getComputedStyle(current).overflowY ?? "";
    if (overflowY === "auto" || overflowY === "scroll") {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

export function resolveChatgptCaptureScope(root: Document): ChatgptCaptureScope | null {
  const primaryContainers = Array.from(root.querySelectorAll(CHATGPT_SCROLL_CONTAINER_PRIMARY));
  const primaryScopes = primaryContainers
    .map((container) => ({
      container,
      messageContainers: resolveChatgptMessageContainers(container).filter((element) =>
        isRenderedElement(element, root)
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
    isRenderedElement(element, root)
  );
  if (renderedRows.length === 0) {
    return null;
  }

  const distinctContainers = new Set<Element>();
  for (const row of renderedRows) {
    const container = resolveClosestOverflowContainer(root, row);
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

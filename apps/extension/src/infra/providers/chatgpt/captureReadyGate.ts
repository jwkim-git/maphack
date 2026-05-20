export type ChatgptCaptureReadyInput = {
  container: Element;
  element: Element;
  originalId: string;
  role: "user" | "assistant";
  turnIndex: number;
  turnIndexSource: "primary" | "fallback";
  rowText: string;
  contentHeight: number;
};

type ChatgptCaptureReadySnapshot = Omit<
  ChatgptCaptureReadyInput,
  "container" | "element"
>;

export class ChatgptCaptureReadyGate {
  private container: Element | null = null;
  private element: Element | null = null;
  private previous: ChatgptCaptureReadySnapshot | null = null;
  private mutationObserver: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mutationDirty = false;
  private resizeDirty = false;
  private layoutShiftDirty = false;

  constructor(private readonly onRetryNeeded: () => void) {
    if (typeof PerformanceObserver === "undefined") {
      return;
    }

    try {
      const observer = new PerformanceObserver(() => {
        this.layoutShiftDirty = true;
        this.onRetryNeeded();
      });
      observer.observe({ type: "layout-shift", buffered: true });
    } catch {
      // Layout-shift observation is unavailable in some extension contexts.
    }
  }

  check(input: ChatgptCaptureReadyInput): "ready" | "pending" {
    this.observeContainer(input.container);
    this.observeElement(input.element);

    const current = toSnapshot(input);
    const ready =
      this.previous !== null &&
      sameSnapshot(this.previous, current) &&
      !this.mutationDirty &&
      !this.resizeDirty &&
      !this.layoutShiftDirty;

    this.previous = current;
    this.mutationDirty = false;
    this.resizeDirty = false;
    this.layoutShiftDirty = false;

    if (ready) {
      return "ready";
    }

    this.requestNextFrameRetry();
    return "pending";
  }

  private observeContainer(container: Element): void {
    if (this.container === container) {
      return;
    }

    this.mutationObserver?.disconnect();
    this.container = container;
    this.previous = null;
    this.mutationDirty = true;

    if (typeof MutationObserver === "undefined") {
      return;
    }

    this.mutationObserver = new MutationObserver(() => {
      this.mutationDirty = true;
      this.onRetryNeeded();
    });
    this.mutationObserver.observe(container, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "data-message-id",
        "data-message-author-role",
        "data-turn",
        "data-testid",
        "src",
        "alt",
        "class",
        "style"
      ]
    });
  }

  private observeElement(element: Element): void {
    if (this.element === element) {
      return;
    }

    this.resizeObserver?.disconnect();
    this.element = element;
    this.previous = null;
    this.resizeDirty = true;

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeDirty = true;
      this.onRetryNeeded();
    });
    this.resizeObserver.observe(element);
  }

  private requestNextFrameRetry(): void {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(this.onRetryNeeded);
      return;
    }

    this.onRetryNeeded();
  }
}

function toSnapshot(input: ChatgptCaptureReadyInput): ChatgptCaptureReadySnapshot {
  return {
    originalId: input.originalId,
    role: input.role,
    turnIndex: input.turnIndex,
    turnIndexSource: input.turnIndexSource,
    rowText: input.rowText,
    contentHeight: input.contentHeight
  };
}

function sameSnapshot(
  left: ChatgptCaptureReadySnapshot,
  right: ChatgptCaptureReadySnapshot
): boolean {
  return (
    left.originalId === right.originalId &&
    left.role === right.role &&
    left.turnIndex === right.turnIndex &&
    left.turnIndexSource === right.turnIndexSource &&
    left.rowText === right.rowText &&
    left.contentHeight === right.contentHeight
  );
}

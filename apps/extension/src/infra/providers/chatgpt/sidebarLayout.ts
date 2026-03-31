interface AppliedLayoutState {
  target: HTMLElement;
  previousWidth: string;
  previousMaxWidth: string;
  previousTransition: string;
}

const PERSISTENT_RIGHT_PANEL_SELECTOR =
  "div.bg-token-bg-elevated-secondary.relative.z-1.shrink-0.overflow-x-hidden.max-lg\\:w-0\\!.stage-thread-flyout-preset-default";

const TRIGGER_BAR_VARIANTS = [
  {
    rootSelector: "div.fixed.end-4.top-1\\/2.z-10.-translate-y-1\\/2",
    itemSelector:
      ":scope > div.relative.flex.items-start > div.flex.w-9.flex-col.items-center.gap-2.py-1 > button.h-\\[2px\\].w-\\[18px\\].rounded-full.transition-all[aria-label]",
    minItems: 3
  }
] as const;

interface ChatgptSidebarLayoutOptions {
  sidebarWidthPx: number;
  openButtonSizePx: number;
  viewportRightTolerancePx: number;
}

interface ClosedOpenButtonPlacement {
  centerXPx: number;
  centerYPx: number;
}

interface HiddenElementState {
  element: HTMLElement;
  previousDisplay: string;
}

function resolveChatgptViewportRoot(documentRef: Document): HTMLElement | null {
  const appRoot = Array.from(documentRef.body?.children ?? []).find((element) => {
    if (!(element instanceof HTMLDivElement)) {
      return false;
    }

    if (element.id) {
      return false;
    }

    return element.querySelector("main#main") instanceof HTMLElement;
  });

  if (!(appRoot instanceof HTMLDivElement)) {
    return null;
  }

  const viewportRoot = appRoot.firstElementChild;
  return viewportRoot instanceof HTMLElement ? viewportRoot : null;
}

function captureState(target: HTMLElement): AppliedLayoutState {
  return {
    target,
    previousWidth: target.style.width,
    previousMaxWidth: target.style.maxWidth,
    previousTransition: target.style.transition
  };
}

function restoreState(state: AppliedLayoutState | null): void {
  if (!state) {
    return;
  }

  state.target.style.width = state.previousWidth;
  state.target.style.maxWidth = state.previousMaxWidth;
  state.target.style.transition = state.previousTransition;
}

function resolveMainUsableRightBoundary(
  documentRef: Document,
  windowRef: Window,
  viewportRightTolerancePx: number
): number {
  const viewportWidth = windowRef.innerWidth;
  const panel = documentRef.querySelector(PERSISTENT_RIGHT_PANEL_SELECTOR);

  if (panel instanceof HTMLElement) {
    const rect = panel.getBoundingClientRect();
    if (rect.width > 0 && Math.abs(rect.right - viewportWidth) <= viewportRightTolerancePx) {
      return rect.left;
    }
  }

  return viewportWidth;
}

function resolveClosedOpenButtonPlacement(
  documentRef: Document,
  windowRef: Window,
  options: ChatgptSidebarLayoutOptions
): ClosedOpenButtonPlacement {
  const mainUsableRightBoundary = resolveMainUsableRightBoundary(
    documentRef,
    windowRef,
    options.viewportRightTolerancePx
  );

  const rightGapPx = 16;
  const bottomGapPx = 24;

  return {
    centerXPx:
      mainUsableRightBoundary - rightGapPx - options.openButtonSizePx / 2,
    centerYPx:
      windowRef.innerHeight - bottomGapPx - options.openButtonSizePx / 2
  };
}

function resolveTriggerBarRoot(documentRef: Document): HTMLElement | null {
  for (const variant of TRIGGER_BAR_VARIANTS) {
    const root = documentRef.querySelector(variant.rootSelector);
    if (!(root instanceof HTMLElement)) {
      continue;
    }

    const items = root.querySelectorAll<HTMLButtonElement>(variant.itemSelector);
    if (items.length >= variant.minItems) {
      return root;
    }
  }

  return null;
}

function hideElement(element: HTMLElement): HiddenElementState {
  const hiddenState: HiddenElementState = {
    element,
    previousDisplay: element.style.display
  };

  element.style.display = "none";
  return hiddenState;
}

function restoreHiddenElement(state: HiddenElementState | null): void {
  if (!state) {
    return;
  }

  state.element.style.display = state.previousDisplay;
}

function placementsEqual(
  left: ClosedOpenButtonPlacement,
  right: ClosedOpenButtonPlacement
): boolean {
  return left.centerXPx === right.centerXPx && left.centerYPx === right.centerYPx;
}

export function createChatgptSidebarLayout(
  documentRef: Document,
  windowRef: Window,
  options: ChatgptSidebarLayoutOptions
) {
  if (!documentRef.body) {
    return null;
  }
  let appliedState: AppliedLayoutState | null = null;
  let hiddenTriggerBar: HiddenElementState | null = null;
  let shellOpen = false;
  let lastClosedPlacement = resolveClosedOpenButtonPlacement(documentRef, windowRef, options);
  let closedPlacementSubscriber:
    | ((placement: ClosedOpenButtonPlacement) => void)
    | null = null;
  let pendingFrameId: number | null = null;

  const syncOpenLayoutTarget = (): boolean => {
    const nextTarget = resolveChatgptViewportRoot(documentRef);
    if (!nextTarget) {
      return false;
    }

    if (appliedState && appliedState.target !== nextTarget) {
      restoreState(appliedState);
      appliedState = null;
    }

    if (!appliedState) {
      appliedState = captureState(nextTarget);
    }

    nextTarget.style.width = `calc(100vw - ${options.sidebarWidthPx}px)`;
    nextTarget.style.maxWidth = `calc(100vw - ${options.sidebarWidthPx}px)`;
    nextTarget.style.transition = "width 160ms ease, max-width 160ms ease";
    return true;
  };

  const syncTriggerBarVisibility = (): void => {
    const nextTriggerBarRoot = resolveTriggerBarRoot(documentRef);

    if (!shellOpen) {
      restoreHiddenElement(hiddenTriggerBar);
      hiddenTriggerBar = null;
      return;
    }

    if (
      hiddenTriggerBar &&
      hiddenTriggerBar.element === nextTriggerBarRoot &&
      hiddenTriggerBar.element.style.display === "none"
    ) {
      return;
    }

    restoreHiddenElement(hiddenTriggerBar);
    hiddenTriggerBar = null;

    if (nextTriggerBarRoot) {
      hiddenTriggerBar = hideElement(nextTriggerBarRoot);
    }
  };

  const syncClosedPlacement = (): void => {
    const nextPlacement = resolveClosedOpenButtonPlacement(documentRef, windowRef, options);
    if (placementsEqual(lastClosedPlacement, nextPlacement)) {
      return;
    }

    lastClosedPlacement = nextPlacement;

    if (!shellOpen && closedPlacementSubscriber) {
      closedPlacementSubscriber(nextPlacement);
    }
  };

  const syncObservedUi = (): void => {
    if (shellOpen) {
      void syncOpenLayoutTarget();
      syncTriggerBarVisibility();
      return;
    }

    syncTriggerBarVisibility();
    syncClosedPlacement();
  };

  const scheduleObservedUiSync = (): void => {
    if (pendingFrameId !== null) {
      return;
    }

    pendingFrameId = windowRef.requestAnimationFrame(() => {
      pendingFrameId = null;
      syncObservedUi();
    });
  };

  const mutationObserver = new MutationObserver(() => {
    scheduleObservedUiSync();
  });

  mutationObserver.observe(documentRef.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"]
  });

  const handleResize = (): void => {
    scheduleObservedUiSync();
  };

  windowRef.addEventListener("resize", handleResize);

  return {
    open(): boolean {
      shellOpen = true;

      const layoutApplied = syncOpenLayoutTarget();
      if (!layoutApplied) {
        restoreState(appliedState);
        appliedState = null;
        shellOpen = false;
        restoreHiddenElement(hiddenTriggerBar);
        hiddenTriggerBar = null;
        lastClosedPlacement = resolveClosedOpenButtonPlacement(documentRef, windowRef, options);
        return false;
      }

      syncTriggerBarVisibility();
      return true;
    },
    close(): void {
      restoreState(appliedState);
      appliedState = null;
      shellOpen = false;
      restoreHiddenElement(hiddenTriggerBar);
      hiddenTriggerBar = null;
      lastClosedPlacement = resolveClosedOpenButtonPlacement(documentRef, windowRef, options);
    },
    dispose(): void {
      shellOpen = false;

      if (pendingFrameId !== null) {
        windowRef.cancelAnimationFrame(pendingFrameId);
        pendingFrameId = null;
      }

      mutationObserver.disconnect();
      windowRef.removeEventListener("resize", handleResize);

      restoreState(appliedState);
      appliedState = null;
      restoreHiddenElement(hiddenTriggerBar);
      hiddenTriggerBar = null;
      closedPlacementSubscriber = null;
    },
    getClosedOpenButtonPlacement() {
      return lastClosedPlacement;
    },
    subscribeClosedOpenButtonPlacement(
      onPlacementChange: (placement: ClosedOpenButtonPlacement) => void
    ) {
      closedPlacementSubscriber = onPlacementChange;

      return () => {
        if (closedPlacementSubscriber === onPlacementChange) {
          closedPlacementSubscriber = null;
        }
      };
    }
  };
}

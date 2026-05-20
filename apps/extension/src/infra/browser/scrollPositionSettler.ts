import {
  MAPHACK_SCROLL_NAVIGATION_ANCHOR_OFFSET_PX,
  resolveCssPixelTolerance,
  resolveScrollPositionState,
  type ScrollPositionDirtyState,
  type ScrollPositionSample
} from "../../application/scrollPosition/scrollPositionPolicy";

export type ScrollPositionSettlerTransaction = {
  dispose(): void;
};

export type StartScrollPositionSettler = (input: {
  targetElement: Element;
  scrollContainer: Element;
  windowRef: Window;
  navigationAnchorOffset?: number;
  onSettled: () => void;
  onUnavailable: () => void;
  onAborted: () => void;
}) => ScrollPositionSettlerTransaction;

type BrowserObserverWindow = Window & {
  IntersectionObserver?: typeof IntersectionObserver;
  ResizeObserver?: typeof ResizeObserver;
  PerformanceObserver?: typeof PerformanceObserver;
  WheelEvent?: typeof WheelEvent;
};

const USER_INPUT_LISTENER_OPTIONS = { capture: true, passive: true } as const;

export const startScrollPositionSettler: StartScrollPositionSettler = ({
  targetElement,
  scrollContainer,
  windowRef,
  navigationAnchorOffset = MAPHACK_SCROLL_NAVIGATION_ANCHOR_OFFSET_PX,
  onSettled,
  onUnavailable,
  onAborted
}) => {
  const browserWindow = windowRef as BrowserObserverWindow;
  const dirty: ScrollPositionDirtyState = {
    resized: false,
    layoutShifted: false
  };
  let previousSample: ScrollPositionSample | null = null;
  let intersects = false;
  let disposed = false;
  let rafId: number | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let performanceObserver: PerformanceObserver | null = null;

  const dispose = (): void => {
    if (disposed) {
      return;
    }

    disposed = true;
    if (rafId !== null) {
      windowRef.cancelAnimationFrame(rafId);
      rafId = null;
    }
    intersectionObserver?.disconnect();
    resizeObserver?.disconnect();
    performanceObserver?.disconnect();
    scrollContainer.removeEventListener("wheel", handleTrustedUserInput, USER_INPUT_LISTENER_OPTIONS);
    scrollContainer.removeEventListener("pointerdown", handleTrustedUserInput, USER_INPUT_LISTENER_OPTIONS);
    windowRef.removeEventListener("keydown", handleTrustedUserInput, USER_INPUT_LISTENER_OPTIONS);
  };

  const finish = (callback: () => void): void => {
    dispose();
    callback();
  };

  function handleTrustedUserInput(event: Event): void {
    if (!event.isTrusted || disposed) {
      return;
    }

    finish(onAborted);
  }

  function scheduleSample(): void {
    if (disposed || rafId !== null) {
      return;
    }

    rafId = windowRef.requestAnimationFrame(() => {
      rafId = null;
      sampleAndSeek();
    });
  }

  function markResized(): void {
    dirty.resized = true;
    scheduleSample();
  }

  function markLayoutShifted(): void {
    dirty.layoutShifted = true;
    scheduleSample();
  }

  function readSample(): ScrollPositionSample | null {
    if (!targetElement.isConnected || !scrollContainer.isConnected) {
      return null;
    }

    const targetRect = targetElement.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const scrollPaddingTop = Number.parseFloat(
      windowRef.getComputedStyle(scrollContainer).scrollPaddingTop
    );

    return {
      targetRect: {
        top: targetRect.top,
        height: targetRect.height
      },
      containerRect: {
        top: containerRect.top,
        height: containerRect.height
      },
      scrollTop: scrollContainer.scrollTop,
      scrollPaddingTop: Number.isFinite(scrollPaddingTop) ? scrollPaddingTop : 0,
      navigationAnchorOffset
    };
  }

  function dispatchScrollRestorationSuppressor(): void {
    const WheelEventCtor = browserWindow.WheelEvent ?? WheelEvent;
    scrollContainer.dispatchEvent(
      new WheelEventCtor("wheel", { deltaY: -1, bubbles: true })
    );
  }

  function sampleAndSeek(): void {
    if (disposed) {
      return;
    }

    const currentSample = readSample();
    if (!currentSample) {
      finish(onUnavailable);
      return;
    }

    const currentDirty = {
      resized: dirty.resized,
      layoutShifted: dirty.layoutShifted
    };
    dirty.resized = false;
    dirty.layoutShifted = false;

    const state = resolveScrollPositionState({
      previous: previousSample,
      current: currentSample,
      dirty: currentDirty,
      intersects,
      devicePixelRatio: windowRef.devicePixelRatio
    });

    if (state.kind === "settled") {
      finish(onSettled);
      return;
    }

    if (state.kind === "unavailable") {
      finish(onUnavailable);
      return;
    }

    if (state.nextScrollTop !== null) {
      const tolerance = resolveCssPixelTolerance(windowRef.devicePixelRatio);
      if (Math.abs(scrollContainer.scrollTop - state.nextScrollTop) > tolerance) {
        const previousScrollTop = scrollContainer.scrollTop;
        scrollContainer.scrollTop = state.nextScrollTop;
        const appliedScrollTop = scrollContainer.scrollTop;
        dispatchScrollRestorationSuppressor();
        if (
          Math.abs(appliedScrollTop - previousScrollTop) <= tolerance &&
          Math.abs(appliedScrollTop - state.nextScrollTop) > tolerance
        ) {
          previousSample = currentSample;
          return;
        }

        previousSample = null;
        scheduleSample();
        return;
      }
    }

    previousSample = currentSample;
    if (state.shouldResample) {
      scheduleSample();
    }
  }

  const IntersectionObserverCtor = browserWindow.IntersectionObserver;
  if (IntersectionObserverCtor) {
    intersectionObserver = new IntersectionObserverCtor(
      (entries) => {
        intersects = entries.some((entry) => entry.isIntersecting);
        scheduleSample();
      },
      { root: scrollContainer }
    );
    intersectionObserver.observe(targetElement);
  }

  const ResizeObserverCtor = browserWindow.ResizeObserver;
  if (ResizeObserverCtor) {
    resizeObserver = new ResizeObserverCtor(markResized);
    resizeObserver.observe(targetElement);
    resizeObserver.observe(scrollContainer);
  }

  const PerformanceObserverCtor = browserWindow.PerformanceObserver;
  if (PerformanceObserverCtor) {
    try {
      performanceObserver = new PerformanceObserverCtor(markLayoutShifted);
      performanceObserver.observe({ type: "layout-shift", buffered: true });
    } catch {
      performanceObserver = null;
    }
  }

  scrollContainer.addEventListener("wheel", handleTrustedUserInput, USER_INPUT_LISTENER_OPTIONS);
  scrollContainer.addEventListener("pointerdown", handleTrustedUserInput, USER_INPUT_LISTENER_OPTIONS);
  windowRef.addEventListener("keydown", handleTrustedUserInput, USER_INPUT_LISTENER_OPTIONS);

  scheduleSample();

  return { dispose };
};

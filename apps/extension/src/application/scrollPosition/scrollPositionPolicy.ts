export type ScrollPositionRectSnapshot = {
  top: number;
  height: number;
};

export type ScrollPositionSample = {
  targetRect: ScrollPositionRectSnapshot;
  containerRect: ScrollPositionRectSnapshot;
  scrollTop: number;
  scrollPaddingTop: number;
  navigationAnchorOffset: number;
};

export type ScrollPositionDirtyState = {
  resized: boolean;
  layoutShifted: boolean;
};

export type ScrollPositionState =
  | { kind: "settled" }
  | { kind: "pending"; nextScrollTop: number | null; shouldResample: boolean }
  | { kind: "unavailable" };

export const MAPHACK_SCROLL_NAVIGATION_ANCHOR_OFFSET_PX = 12;

export function resolveCssPixelTolerance(devicePixelRatio: number): number {
  return Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? 1 / devicePixelRatio : 1;
}

export function resolveScrollAnchorTop(sample: ScrollPositionSample): number {
  return sample.containerRect.top + sample.scrollPaddingTop + sample.navigationAnchorOffset;
}

export function resolveNextScrollTop(sample: ScrollPositionSample): number {
  return sample.scrollTop + (sample.targetRect.top - resolveScrollAnchorTop(sample));
}

export function resolveScrollPositionState(input: {
  previous: ScrollPositionSample | null;
  current: ScrollPositionSample;
  dirty: ScrollPositionDirtyState;
  intersects: boolean;
  devicePixelRatio: number;
}): ScrollPositionState {
  const tolerance = resolveCssPixelTolerance(input.devicePixelRatio);

  if (!isUsableSample(input.current)) {
    return { kind: "unavailable" };
  }

  const nextScrollTop = resolveNextScrollTop(input.current);
  const inAnchorBand = Math.abs(input.current.targetRect.top - resolveScrollAnchorTop(input.current)) <= tolerance;

  if (!inAnchorBand) {
    return { kind: "pending", nextScrollTop, shouldResample: true };
  }

  if (
    input.previous &&
    input.intersects &&
    !input.dirty.resized &&
    !input.dirty.layoutShifted &&
    hasStableSamplePair(input.previous, input.current, tolerance)
  ) {
    return { kind: "settled" };
  }

  return { kind: "pending", nextScrollTop: null, shouldResample: true };
}

function isUsableSample(sample: ScrollPositionSample): boolean {
  return (
    isFiniteRect(sample.targetRect) &&
    isFiniteRect(sample.containerRect) &&
    sample.targetRect.height > 0 &&
    sample.containerRect.height > 0 &&
    Number.isFinite(sample.scrollTop) &&
    Number.isFinite(sample.scrollPaddingTop) &&
    Number.isFinite(sample.navigationAnchorOffset)
  );
}

function isFiniteRect(rect: ScrollPositionRectSnapshot): boolean {
  return Number.isFinite(rect.top) && Number.isFinite(rect.height);
}

function hasStableSamplePair(
  previous: ScrollPositionSample,
  current: ScrollPositionSample,
  tolerance: number
): boolean {
  return (
    Math.abs(previous.targetRect.top - current.targetRect.top) <= tolerance &&
    Math.abs(previous.targetRect.height - current.targetRect.height) <= tolerance &&
    Math.abs(resolveScrollAnchorTop(previous) - resolveScrollAnchorTop(current)) <= tolerance
  );
}

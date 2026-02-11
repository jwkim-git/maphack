export type TimestampLike = string | number | null | undefined;

export function toUnixSecondsOrNull(value: TimestampLike): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    return value >= 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) {
    return asNumber >= 1_000_000_000_000
      ? Math.floor(asNumber / 1000)
      : Math.floor(asNumber);
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.floor(parsed / 1000);
}

import {
  isMapHackMessageId,
  toOriginalMessageId
} from "../../../../../../packages/core/src/domain/value/MapHackMessageId";
import type { TimestampSeed } from "./timestampAdapter";

const REACT_FIBER_KEY_PREFIX = "__reactFiber$";
const MAX_FIBER_ANCESTOR_DEPTH = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toOriginalId(messageId: string): string | null {
  if (!isMapHackMessageId(messageId)) {
    return messageId.length > 0 ? messageId : null;
  }

  const originalId = toOriginalMessageId(messageId);
  return originalId.length > 0 ? originalId : null;
}

function resolveFiber(element: Element): unknown | null {
  const record = element as unknown as Record<string, unknown>;
  const reactKey = Object.keys(record).find((key) => key.startsWith(REACT_FIBER_KEY_PREFIX));
  return reactKey ? record[reactKey] : null;
}

function resolveCreateTime(
  messages: unknown[],
  originalMessageId: string
): TimestampSeed["createTime"] | undefined {
  for (const item of messages) {
    if (!isRecord(item)) {
      continue;
    }

    if (item.id !== originalMessageId) {
      continue;
    }

    const value = item.create_time;
    if (typeof value === "number" || typeof value === "string" || value === null) {
      return value;
    }

    return null;
  }

  return undefined;
}

function resolveTimestampByMessageId(messageId: string): TimestampSeed["createTime"] {
  const originalMessageId = toOriginalId(messageId);
  if (originalMessageId === null || typeof document === "undefined") {
    return null;
  }

  const messageElement = document.querySelector(`[data-message-id="${originalMessageId}"]`);
  if (!messageElement) {
    return null;
  }

  const fiber = resolveFiber(messageElement);
  if (fiber === null) {
    return null;
  }

  let current = isRecord(fiber) ? fiber : null;

  for (let depth = 0; current !== null && depth < MAX_FIBER_ANCESTOR_DEPTH; depth += 1) {
    const memoizedProps = isRecord(current.memoizedProps) ? current.memoizedProps : null;
    const messages = memoizedProps && Array.isArray(memoizedProps.messages)
      ? memoizedProps.messages
      : null;

    if (messages !== null) {
      const createTime = resolveCreateTime(messages, originalMessageId);
      if (createTime !== undefined) {
        return createTime;
      }
    }

    current = isRecord(current.return) ? current.return : null;
  }

  return null;
}

export function collectFiberTimestampSeeds(messageIds: string[]): TimestampSeed[] {
  return messageIds.map((messageId) => ({
    id: messageId,
    createTime: resolveTimestampByMessageId(messageId)
  }));
}

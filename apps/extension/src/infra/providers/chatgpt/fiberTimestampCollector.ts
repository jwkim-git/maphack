import {
  isMapHackMessageId,
  toOriginalMessageId
} from "../../../../../../packages/core/src/domain/value/MapHackMessageId";
import type { TimestampSeed } from "./timestampAdapter";

const REACT_FIBER_KEY_PREFIX = "__reactFiber$";
const MAX_FIBER_ANCESTOR_DEPTH = 8;
const MAX_SIGNAL_STORE_FIBER_DEPTH = 15;
const AGENT_TURN_FILE_ID_PREFIX = "file_";

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

function resolveAgentTurnTimestamp(fileId: string): TimestampSeed["createTime"] {
  for (const img of document.querySelectorAll("div.agent-turn img[src]")) {
    const src = img.getAttribute("src");
    if (!src) {
      continue;
    }

    try {
      if (new URL(src).searchParams.get("id") !== fileId) {
        continue;
      }
    } catch {
      continue;
    }

    const section = img.closest('section[data-testid^="conversation-turn-"]');
    const turnId = section?.getAttribute("data-turn-id");
    if (!section || !turnId) {
      return null;
    }

    const fiber = resolveFiber(section);
    let current = isRecord(fiber) ? fiber : null;

    for (let depth = 0; current !== null && depth < MAX_SIGNAL_STORE_FIBER_DEPTH; depth += 1) {
      const props = isRecord(current.memoizedProps) ? current.memoizedProps : null;
      const conversation = props && isRecord(props.conversation) ? props.conversation : null;
      const ctx = conversation && isRecord(conversation.ctx) ? conversation.ctx : null;

      if (ctx !== null) {
        for (const sym of Object.getOwnPropertySymbols(ctx)) {
          const slot = (ctx as Record<symbol, unknown>)[sym];
          if (typeof slot !== "function") {
            continue;
          }

          try {
            const turns: unknown = (slot as () => unknown)();
            if (!Array.isArray(turns) || turns.length === 0) {
              continue;
            }

            const first = turns[0];
            if (!isRecord(first) || typeof first.id !== "string" || !Array.isArray(first.messages)) {
              continue;
            }

            const matched = turns.find((t: unknown) => isRecord(t) && t.id === turnId);
            if (!isRecord(matched) || !Array.isArray(matched.messages) || matched.messages.length === 0) {
              continue;
            }

            const value = isRecord(matched.messages[0]) ? matched.messages[0].create_time : null;
            if (typeof value === "number" || typeof value === "string") {
              return value;
            }

            return null;
          } catch {
            continue;
          }
        }

        return null;
      }

      current = isRecord(current.return) ? current.return : null;
    }

    return null;
  }

  return null;
}

function resolveTimestampByMessageId(messageId: string): TimestampSeed["createTime"] {
  const originalMessageId = toOriginalId(messageId);
  if (originalMessageId === null || typeof document === "undefined") {
    return null;
  }

  const messageElement = document.querySelector(`[data-message-id="${originalMessageId}"]`);
  if (messageElement) {
    const fiber = resolveFiber(messageElement);
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
  }

  if (originalMessageId.startsWith(AGENT_TURN_FILE_ID_PREFIX)) {
    return resolveAgentTurnTimestamp(originalMessageId);
  }

  return null;
}

export function collectFiberTimestampSeeds(messageIds: string[]): TimestampSeed[] {
  return messageIds.map((messageId) => ({
    id: messageId,
    createTime: resolveTimestampByMessageId(messageId)
  }));
}

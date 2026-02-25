import {
  TIMESTAMP_PAYLOAD_SIGNATURE,
  TIMESTAMP_PAYLOAD_TYPE,
  TIMESTAMP_PULL_REQUEST_SIGNATURE,
  TIMESTAMP_PULL_REQUEST_TYPE,
  type TimestampPullRequestMessage,
  type TimestampPayloadMessage,
  type TimestampPayloadSource
} from "./timestampPayload";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTimestampPayloadSource(value: unknown): value is TimestampPayloadSource {
  return value === "fiber" || value === "json" || value === "stream";
}

function toTimestampPayloadItem(
  value: unknown
): TimestampPayloadMessage["payload"][number] | null {
  if (!isObject(value)) {
    return null;
  }

  if (typeof value.id !== "string") {
    return null;
  }

  const rawCreateTime = value.createTime;
  if (rawCreateTime !== null && typeof rawCreateTime !== "number") {
    return null;
  }

  if (typeof rawCreateTime === "number" && !Number.isFinite(rawCreateTime)) {
    return null;
  }

  return {
    id: value.id,
    createTime: rawCreateTime
  };
}

function toTimestampPullRequestMessageIds(
  value: unknown
): TimestampPullRequestMessage["messageIds"] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const messageIds: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }
    messageIds.push(item);
  }

  if (messageIds.length === 0) {
    return null;
  }

  return messageIds;
}

export function toTimestampPayloadMessage(value: unknown): TimestampPayloadMessage | null {
  if (!isObject(value)) {
    return null;
  }

  if (
    value.type !== TIMESTAMP_PAYLOAD_TYPE ||
    value.signature !== TIMESTAMP_PAYLOAD_SIGNATURE ||
    typeof value.conversationId !== "string" ||
    !isTimestampPayloadSource(value.source) ||
    !Array.isArray(value.payload)
  ) {
    return null;
  }

  const payload: TimestampPayloadMessage["payload"] = [];
  for (const item of value.payload) {
    const parsed = toTimestampPayloadItem(item);
    if (parsed === null) {
      return null;
    }
    payload.push(parsed);
  }

  return {
    type: TIMESTAMP_PAYLOAD_TYPE,
    signature: TIMESTAMP_PAYLOAD_SIGNATURE,
    conversationId: value.conversationId,
    source: value.source,
    payload
  };
}

export function isTimestampPayloadMessage(value: unknown): value is TimestampPayloadMessage {
  return toTimestampPayloadMessage(value) !== null;
}

export function toTimestampPullRequestMessage(value: unknown): TimestampPullRequestMessage | null {
  if (!isObject(value)) {
    return null;
  }

  if (
    value.type !== TIMESTAMP_PULL_REQUEST_TYPE ||
    value.signature !== TIMESTAMP_PULL_REQUEST_SIGNATURE ||
    typeof value.conversationId !== "string"
  ) {
    return null;
  }

  const messageIds = toTimestampPullRequestMessageIds(value.messageIds);
  if (messageIds === null) {
    return null;
  }

  return {
    type: TIMESTAMP_PULL_REQUEST_TYPE,
    signature: TIMESTAMP_PULL_REQUEST_SIGNATURE,
    conversationId: value.conversationId,
    messageIds
  };
}

export function isTimestampPullRequestMessage(value: unknown): value is TimestampPullRequestMessage {
  return toTimestampPullRequestMessage(value) !== null;
}

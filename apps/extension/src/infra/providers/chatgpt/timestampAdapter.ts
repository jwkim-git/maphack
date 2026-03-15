import { toUnixSecondsOrNull } from "../../../../../../packages/shared/src/utils/time/toUnixSecondsOrNull";
import type {
  TIMESTAMP_MESSAGE_SCHEMA,
  TIMESTAMP_PAYLOAD_SIGNATURE,
  TIMESTAMP_PAYLOAD_TYPE,
  TimestampPayloadItem,
  TimestampPayloadMessage,
  TimestampPayloadSource
} from "../../messaging/timestampPayload";
import {
  TIMESTAMP_MESSAGE_SCHEMA as TIMESTAMP_MESSAGE_SCHEMA_VALUE,
  TIMESTAMP_PAYLOAD_SIGNATURE as TIMESTAMP_PAYLOAD_SIGNATURE_VALUE,
  TIMESTAMP_PAYLOAD_TYPE as TIMESTAMP_PAYLOAD_TYPE_VALUE
} from "../../messaging/timestampPayload";

export interface TimestampSeed {
  id: string;
  createTime: string | number | null | undefined;
}

export interface BuildTimestampPayloadInput {
  requestId: string;
  conversationId: string;
  source: TimestampPayloadSource;
  items: TimestampSeed[];
}

export function toTimestampPayloadItems(items: TimestampSeed[]): TimestampPayloadItem[] {
  const payload: TimestampPayloadItem[] = [];

  for (const item of items) {
    if (typeof item.id !== "string") {
      throw new Error("INVALID_TIMESTAMP_SEED_ID");
    }

    if (item.createTime === null) {
      payload.push({
        id: item.id,
        createTime: null
      });
      continue;
    }

    const normalized = toUnixSecondsOrNull(item.createTime);
    if (normalized === null) {
      throw new Error(`INVALID_TIMESTAMP_CREATE_TIME:${item.id}`);
    }

    payload.push({
      id: item.id,
      createTime: normalized
    });
  }

  return payload;
}

export function createTimestampPayloadMessage(
  input: BuildTimestampPayloadInput
): TimestampPayloadMessage {
  const payload = toTimestampPayloadItems(input.items);

  return {
    type: TIMESTAMP_PAYLOAD_TYPE_VALUE as typeof TIMESTAMP_PAYLOAD_TYPE,
    signature: TIMESTAMP_PAYLOAD_SIGNATURE_VALUE as typeof TIMESTAMP_PAYLOAD_SIGNATURE,
    schema: TIMESTAMP_MESSAGE_SCHEMA_VALUE as typeof TIMESTAMP_MESSAGE_SCHEMA,
    requestId: input.requestId,
    conversationId: input.conversationId,
    source: input.source,
    payload
  };
}

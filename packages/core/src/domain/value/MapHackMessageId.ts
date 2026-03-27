export type MapHackMessageId = `mh-msg-${string}`;

const MAPHACK_MESSAGE_ID_PREFIX = "mh-msg-";

export function toMapHackMessageId(originalId: string): MapHackMessageId {
  return `mh-msg-${originalId}`;
}

export function toOriginalMessageId(messageId: MapHackMessageId): string {
  return messageId.slice(MAPHACK_MESSAGE_ID_PREFIX.length);
}

export function isMapHackMessageId(value: string): value is MapHackMessageId {
  return value.startsWith(MAPHACK_MESSAGE_ID_PREFIX);
}

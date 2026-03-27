export type MapHackConversationId = `mh-conv-${string}`;

export function toMapHackConversationId(originalId: string): MapHackConversationId {
  return `mh-conv-${originalId}` as MapHackConversationId;
}

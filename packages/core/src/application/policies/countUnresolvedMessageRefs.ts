import type { MessageRef } from "../../domain/entities/MessageRef";

export function countUnresolvedMessageRefs(messageRefs: MessageRef[]): number {
  let count = 0;
  for (const messageRef of messageRefs) {
    if (messageRef.timestamp === null) {
      count += 1;
    }
  }
  return count;
}

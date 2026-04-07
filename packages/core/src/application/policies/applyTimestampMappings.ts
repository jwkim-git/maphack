import type { ConversationSource } from "../ports/ConversationSourcePort";
import type { TimestampMapping } from "../ports/TimestampPort";
import type { MessageRef } from "../../domain/entities/MessageRef";
import { recalculateConversationTimestampBounds } from "./recalculateConversationTimestampBounds";

export function applyTimestampMappings(
  source: ConversationSource,
  mappings: TimestampMapping[]
): { updated: ConversationSource; appliedMessageIds: Set<string> } | null {
  const messageRefById = new Map<MessageRef["id"], MessageRef>();
  for (const messageRef of source.messageRefs) {
    messageRefById.set(messageRef.id, messageRef);
  }

  const appliedMessageIds = new Set<string>();

  for (const mapping of mappings) {
    if (mapping.timestamp === null) {
      continue;
    }

    const messageRef = messageRefById.get(mapping.messageId);
    if (!messageRef) {
      continue;
    }

    messageRef.timestamp = mapping.timestamp;
    appliedMessageIds.add(messageRef.id);
  }

  if (appliedMessageIds.size === 0) {
    return null;
  }

  recalculateConversationTimestampBounds(source);

  return { updated: source, appliedMessageIds };
}

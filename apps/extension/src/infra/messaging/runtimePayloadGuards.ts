import type {
  RuntimeBookmark,
  RuntimeConversation,
  RuntimeConversationSource,
  RuntimeMessageRef,
  RuntimeTimestampMapping
} from "../../../../../packages/shared/src/types/runtimeMessages";
import {
  isNullableFiniteNumber,
  isObject
} from "./runtimeEnvelopeGuards";

export function isRuntimeMessageRef(value: unknown): value is RuntimeMessageRef {
  if (!isObject(value)) {
    return false;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.conversationId !== "string" ||
    (value.role !== "user" && value.role !== "assistant") ||
    typeof value.preview !== "string" ||
    !isNullableFiniteNumber(value.timestamp) ||
    typeof value.platform !== "string" ||
    typeof value.conversationUrl !== "string"
  ) {
    return false;
  }

  if (!isObject(value.metadata)) {
    return false;
  }

  return (
    typeof value.metadata.originalId === "string" &&
    typeof value.metadata.turnIndex === "number"
  );
}

export function isRuntimeConversation(value: unknown): value is RuntimeConversation {
  if (!isObject(value)) {
    return false;
  }

  if (
    typeof value.id !== "string" ||
    !isNullableFiniteNumber(value.createdAt) ||
    !isNullableFiniteNumber(value.updatedAt) ||
    typeof value.platform !== "string" ||
    !isObject(value.metadata)
  ) {
    return false;
  }

  if (
    typeof value.metadata.originalId !== "string" ||
    typeof value.metadata.url !== "string"
  ) {
    return false;
  }

  return true;
}

export function isRuntimeConversationSource(value: unknown): value is RuntimeConversationSource {
  if (!isObject(value)) {
    return false;
  }

  if (!isRuntimeConversation(value.conversation) || !Array.isArray(value.messageRefs)) {
    return false;
  }

  return value.messageRefs.every(isRuntimeMessageRef);
}

export function isRuntimeTimestampMapping(value: unknown): value is RuntimeTimestampMapping {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.messageId === "string" &&
    isNullableFiniteNumber(value.timestamp)
  );
}

export function isRuntimeBookmark(value: unknown): value is RuntimeBookmark {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.conversationId === "string" &&
    typeof value.messageId === "string" &&
    isNullableFiniteNumber(value.timestamp) &&
    typeof value.turnIndex === "number" &&
    Number.isFinite(value.turnIndex) &&
    typeof value.messagePreview === "string" &&
    (value.messageRole === "user" || value.messageRole === "assistant") &&
    typeof value.conversationUrl === "string" &&
    typeof value.platform === "string" &&
    typeof value.createdAt === "number" &&
    Number.isFinite(value.createdAt) &&
    typeof value.edited === "boolean"
  );
}

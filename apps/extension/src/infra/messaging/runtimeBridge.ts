import {
  APPLY_TIMESTAMPS_REQUEST_TYPE,
  CAPTURE_CONVERSATION_REQUEST_TYPE,
  LIST_BASE_MESSAGES_FAILURE_TYPE,
  LIST_BASE_MESSAGES_REQUEST_TYPE,
  LIST_BASE_MESSAGES_SUCCESS_TYPE,
  RUNTIME_MESSAGE_SCHEMA,
  RUNTIME_MESSAGE_SIGNATURE,
  type ApplyTimestampsRequest,
  type CaptureConversationRequest,
  type ListBaseMessagesFailure,
  type ListBaseMessagesRequest,
  type ListBaseMessagesSuccess,
  type RuntimeConversation,
  type RuntimeConversationSource,
  type RuntimeMessageRef,
  type RuntimeTimestampMapping,
  type RuntimeTimestampSource
} from "../../../../../packages/shared/src/types/runtimeMessages";

export {
  APPLY_TIMESTAMPS_REQUEST_TYPE,
  CAPTURE_CONVERSATION_REQUEST_TYPE,
  LIST_BASE_MESSAGES_FAILURE_TYPE,
  LIST_BASE_MESSAGES_REQUEST_TYPE,
  LIST_BASE_MESSAGES_SUCCESS_TYPE,
  RUNTIME_MESSAGE_SCHEMA,
  RUNTIME_MESSAGE_SIGNATURE
};

export type {
  ApplyTimestampsRequest,
  CaptureConversationRequest,
  ListBaseMessagesFailure,
  ListBaseMessagesRequest,
  ListBaseMessagesSuccess,
  RuntimeConversation,
  RuntimeConversationSource,
  RuntimeMessageRef,
  RuntimeTimestampMapping,
  RuntimeTimestampSource
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasRuntimeEnvelope(value: Record<string, unknown>): boolean {
  return value.signature === RUNTIME_MESSAGE_SIGNATURE && value.schema === RUNTIME_MESSAGE_SCHEMA;
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isMessageRef(value: unknown): value is RuntimeMessageRef {
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

function isConversation(value: unknown): value is RuntimeConversation {
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

function isConversationSource(value: unknown): value is RuntimeConversationSource {
  if (!isObject(value)) {
    return false;
  }

  if (!isConversation(value.conversation) || !Array.isArray(value.messageRefs)) {
    return false;
  }

  return value.messageRefs.every(isMessageRef);
}

function isTimestampMapping(value: unknown): value is RuntimeTimestampMapping {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.messageId === "string" &&
    isNullableFiniteNumber(value.timestamp)
  );
}

export function createCaptureConversationRequest(
  source: RuntimeConversationSource
): CaptureConversationRequest {
  return {
    type: CAPTURE_CONVERSATION_REQUEST_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    source
  };
}

export function isCaptureConversationRequest(value: unknown): value is CaptureConversationRequest {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === CAPTURE_CONVERSATION_REQUEST_TYPE &&
    isConversationSource(value.source)
  );
}

export function createListBaseMessagesRequest(
  requestId: string,
  conversationId: string
): ListBaseMessagesRequest {
  return {
    type: LIST_BASE_MESSAGES_REQUEST_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    conversationId
  };
}

export function createListBaseMessagesSuccess(
  requestId: string,
  messageRefs: RuntimeMessageRef[]
): ListBaseMessagesSuccess {
  return {
    type: LIST_BASE_MESSAGES_SUCCESS_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    messageRefs
  };
}

export function createListBaseMessagesFailure(
  requestId: string,
  error: string
): ListBaseMessagesFailure {
  return {
    type: LIST_BASE_MESSAGES_FAILURE_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    error
  };
}

export function isListBaseMessagesRequest(value: unknown): value is ListBaseMessagesRequest {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === LIST_BASE_MESSAGES_REQUEST_TYPE &&
    typeof value.requestId === "string" &&
    typeof value.conversationId === "string"
  );
}

export function isListBaseMessagesSuccess(value: unknown): value is ListBaseMessagesSuccess {
  if (!isObject(value)) {
    return false;
  }

  if (
    !hasRuntimeEnvelope(value) ||
    value.type !== LIST_BASE_MESSAGES_SUCCESS_TYPE ||
    typeof value.requestId !== "string" ||
    !Array.isArray(value.messageRefs)
  ) {
    return false;
  }

  return value.messageRefs.every(isMessageRef);
}

export function isListBaseMessagesFailure(value: unknown): value is ListBaseMessagesFailure {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === LIST_BASE_MESSAGES_FAILURE_TYPE &&
    typeof value.requestId === "string" &&
    typeof value.error === "string"
  );
}

export function createApplyTimestampsRequest(
  conversationId: string,
  source: RuntimeTimestampSource,
  mappings: RuntimeTimestampMapping[]
): ApplyTimestampsRequest {
  return {
    type: APPLY_TIMESTAMPS_REQUEST_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    conversationId,
    source,
    mappings
  };
}

export function isApplyTimestampsRequest(value: unknown): value is ApplyTimestampsRequest {
  if (!isObject(value)) {
    return false;
  }

  if (
    !hasRuntimeEnvelope(value) ||
    value.type !== APPLY_TIMESTAMPS_REQUEST_TYPE ||
    typeof value.conversationId !== "string" ||
    (value.source !== "fiber" && value.source !== "json" && value.source !== "stream") ||
    !Array.isArray(value.mappings)
  ) {
    return false;
  }

  return value.mappings.every(isTimestampMapping);
}

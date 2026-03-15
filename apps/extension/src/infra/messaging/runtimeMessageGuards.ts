import {
  ADD_BOOKMARK_FAILURE_TYPE,
  ADD_BOOKMARK_REQUEST_TYPE,
  ADD_BOOKMARK_SUCCESS_TYPE,
  APPLY_TIMESTAMPS_FAILURE_TYPE,
  APPLY_TIMESTAMPS_REQUEST_TYPE,
  APPLY_TIMESTAMPS_SUCCESS_TYPE,
  CAPTURE_CONVERSATION_FAILURE_TYPE,
  CAPTURE_CONVERSATION_REQUEST_TYPE,
  CAPTURE_CONVERSATION_SUCCESS_TYPE,
  LIST_BASE_MESSAGES_FAILURE_TYPE,
  LIST_BASE_MESSAGES_REQUEST_TYPE,
  LIST_BASE_MESSAGES_SUCCESS_TYPE,
  LIST_BOOKMARKS_FAILURE_TYPE,
  LIST_BOOKMARKS_REQUEST_TYPE,
  LIST_BOOKMARKS_SUCCESS_TYPE,
  REMOVE_BOOKMARK_FAILURE_TYPE,
  REMOVE_BOOKMARK_REQUEST_TYPE,
  REMOVE_BOOKMARK_SUCCESS_TYPE,
  SOURCE_UPDATED_EVENT_TYPE,
  type AddBookmarkFailure,
  type AddBookmarkRequest,
  type AddBookmarkSuccess,
  type ApplyTimestampsFailure,
  type ApplyTimestampsRequest,
  type ApplyTimestampsSuccess,
  type CaptureConversationFailure,
  type CaptureConversationRequest,
  type CaptureConversationSuccess,
  type ListBaseMessagesFailure,
  type ListBaseMessagesRequest,
  type ListBaseMessagesSuccess,
  type ListBookmarksFailure,
  type ListBookmarksRequest,
  type ListBookmarksSuccess,
  type RemoveBookmarkFailure,
  type RemoveBookmarkRequest,
  type RemoveBookmarkSuccess,
  type SourceUpdatedEvent
} from "./runtimeMessageContracts";
import {
  hasRuntimeEnvelope,
  isObject
} from "./runtimeEnvelopeGuards";
import {
  isRuntimeBookmark,
  isRuntimeConversationSource,
  isRuntimeMessageRef,
  isRuntimeTimestampMapping
} from "./runtimePayloadGuards";

export function isCaptureConversationRequest(value: unknown): value is CaptureConversationRequest {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === CAPTURE_CONVERSATION_REQUEST_TYPE &&
    typeof value.requestId === "string" &&
    (value.captureMode === "snapshot" || value.captureMode === "delta") &&
    isRuntimeConversationSource(value.source)
  );
}

export function isCaptureConversationSuccess(value: unknown): value is CaptureConversationSuccess {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === CAPTURE_CONVERSATION_SUCCESS_TYPE &&
    typeof value.requestId === "string"
  );
}

export function isCaptureConversationFailure(value: unknown): value is CaptureConversationFailure {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === CAPTURE_CONVERSATION_FAILURE_TYPE &&
    typeof value.requestId === "string" &&
    typeof value.error === "string"
  );
}

export function isAddBookmarkRequest(value: unknown): value is AddBookmarkRequest {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === ADD_BOOKMARK_REQUEST_TYPE &&
    typeof value.requestId === "string" &&
    isRuntimeMessageRef(value.messageRef)
  );
}

export function isAddBookmarkSuccess(value: unknown): value is AddBookmarkSuccess {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === ADD_BOOKMARK_SUCCESS_TYPE &&
    typeof value.requestId === "string" &&
    isRuntimeBookmark(value.bookmark)
  );
}

export function isAddBookmarkFailure(value: unknown): value is AddBookmarkFailure {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === ADD_BOOKMARK_FAILURE_TYPE &&
    typeof value.requestId === "string" &&
    typeof value.error === "string"
  );
}

export function isRemoveBookmarkRequest(value: unknown): value is RemoveBookmarkRequest {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === REMOVE_BOOKMARK_REQUEST_TYPE &&
    typeof value.requestId === "string" &&
    typeof value.bookmarkId === "string"
  );
}

export function isRemoveBookmarkSuccess(value: unknown): value is RemoveBookmarkSuccess {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === REMOVE_BOOKMARK_SUCCESS_TYPE &&
    typeof value.requestId === "string" &&
    typeof value.bookmarkId === "string"
  );
}

export function isRemoveBookmarkFailure(value: unknown): value is RemoveBookmarkFailure {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === REMOVE_BOOKMARK_FAILURE_TYPE &&
    typeof value.requestId === "string" &&
    typeof value.error === "string"
  );
}

export function isListBookmarksRequest(value: unknown): value is ListBookmarksRequest {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === LIST_BOOKMARKS_REQUEST_TYPE &&
    typeof value.requestId === "string"
  );
}

export function isListBookmarksSuccess(value: unknown): value is ListBookmarksSuccess {
  if (!isObject(value)) {
    return false;
  }

  if (
    !hasRuntimeEnvelope(value) ||
    value.type !== LIST_BOOKMARKS_SUCCESS_TYPE ||
    typeof value.requestId !== "string" ||
    !Array.isArray(value.bookmarks)
  ) {
    return false;
  }

  return value.bookmarks.every(isRuntimeBookmark);
}

export function isListBookmarksFailure(value: unknown): value is ListBookmarksFailure {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === LIST_BOOKMARKS_FAILURE_TYPE &&
    typeof value.requestId === "string" &&
    typeof value.error === "string"
  );
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

  return value.messageRefs.every(isRuntimeMessageRef);
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

export function isApplyTimestampsRequest(value: unknown): value is ApplyTimestampsRequest {
  if (!isObject(value)) {
    return false;
  }

  if (
    !hasRuntimeEnvelope(value) ||
    value.type !== APPLY_TIMESTAMPS_REQUEST_TYPE ||
    typeof value.requestId !== "string" ||
    typeof value.conversationId !== "string" ||
    value.source !== "fiber" ||
    !Array.isArray(value.mappings)
  ) {
    return false;
  }

  return value.mappings.every(isRuntimeTimestampMapping);
}

export function isApplyTimestampsSuccess(value: unknown): value is ApplyTimestampsSuccess {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === APPLY_TIMESTAMPS_SUCCESS_TYPE &&
    typeof value.requestId === "string" &&
    typeof value.conversationId === "string" &&
    typeof value.unresolvedCount === "number" &&
    Number.isInteger(value.unresolvedCount) &&
    value.unresolvedCount >= 0 &&
    typeof value.ready === "boolean" &&
    typeof value.seq === "number" &&
    Number.isInteger(value.seq) &&
    value.seq >= 0
  );
}

export function isApplyTimestampsFailure(value: unknown): value is ApplyTimestampsFailure {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === APPLY_TIMESTAMPS_FAILURE_TYPE &&
    typeof value.requestId === "string" &&
    typeof value.conversationId === "string" &&
    typeof value.error === "string"
  );
}

export function isSourceUpdatedEvent(value: unknown): value is SourceUpdatedEvent {
  if (!isObject(value)) {
    return false;
  }

  return (
    hasRuntimeEnvelope(value) &&
    value.type === SOURCE_UPDATED_EVENT_TYPE &&
    typeof value.conversationId === "string" &&
    value.ready === true &&
    typeof value.seq === "number" &&
    Number.isFinite(value.seq) &&
    typeof value.sessionId === "string" &&
    value.sessionId.length > 0
  );
}

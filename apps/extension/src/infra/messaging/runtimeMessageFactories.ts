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
  RUNTIME_MESSAGE_SCHEMA,
  RUNTIME_MESSAGE_SIGNATURE,
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
  type RuntimeBookmark,
  type RuntimeCaptureMode,
  type RuntimeConversationSource,
  type RuntimeMessageRef,
  type RuntimeTimestampMapping,
  type RuntimeTimestampSource,
  type SourceUpdatedEvent
} from "./runtimeMessageContracts";

export function createCaptureConversationRequest(
  requestId: string,
  source: RuntimeConversationSource,
  captureMode: RuntimeCaptureMode
): CaptureConversationRequest {
  return {
    type: CAPTURE_CONVERSATION_REQUEST_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    captureMode,
    source
  };
}

export function createCaptureConversationSuccess(requestId: string): CaptureConversationSuccess {
  return {
    type: CAPTURE_CONVERSATION_SUCCESS_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId
  };
}

export function createCaptureConversationFailure(
  requestId: string,
  error: string
): CaptureConversationFailure {
  return {
    type: CAPTURE_CONVERSATION_FAILURE_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    error
  };
}

export function createAddBookmarkRequest(
  requestId: string,
  messageRef: RuntimeMessageRef
): AddBookmarkRequest {
  return {
    type: ADD_BOOKMARK_REQUEST_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    messageRef
  };
}

export function createAddBookmarkSuccess(
  requestId: string,
  bookmark: RuntimeBookmark
): AddBookmarkSuccess {
  return {
    type: ADD_BOOKMARK_SUCCESS_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    bookmark
  };
}

export function createAddBookmarkFailure(requestId: string, error: string): AddBookmarkFailure {
  return {
    type: ADD_BOOKMARK_FAILURE_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    error
  };
}

export function createRemoveBookmarkRequest(
  requestId: string,
  bookmarkId: string
): RemoveBookmarkRequest {
  return {
    type: REMOVE_BOOKMARK_REQUEST_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    bookmarkId
  };
}

export function createRemoveBookmarkSuccess(
  requestId: string,
  bookmarkId: string
): RemoveBookmarkSuccess {
  return {
    type: REMOVE_BOOKMARK_SUCCESS_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    bookmarkId
  };
}

export function createRemoveBookmarkFailure(
  requestId: string,
  error: string
): RemoveBookmarkFailure {
  return {
    type: REMOVE_BOOKMARK_FAILURE_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    error
  };
}

export function createListBookmarksRequest(requestId: string): ListBookmarksRequest {
  return {
    type: LIST_BOOKMARKS_REQUEST_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId
  };
}

export function createListBookmarksSuccess(
  requestId: string,
  bookmarks: RuntimeBookmark[]
): ListBookmarksSuccess {
  return {
    type: LIST_BOOKMARKS_SUCCESS_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    bookmarks
  };
}

export function createListBookmarksFailure(
  requestId: string,
  error: string
): ListBookmarksFailure {
  return {
    type: LIST_BOOKMARKS_FAILURE_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    error
  };
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

export function createApplyTimestampsRequest(
  requestId: string,
  conversationId: string,
  source: RuntimeTimestampSource,
  mappings: RuntimeTimestampMapping[]
): ApplyTimestampsRequest {
  return {
    type: APPLY_TIMESTAMPS_REQUEST_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    conversationId,
    source,
    mappings
  };
}

export function createApplyTimestampsSuccess(
  requestId: string,
  conversationId: string,
  unresolvedCount: number,
  ready: boolean,
  seq: number
): ApplyTimestampsSuccess {
  return {
    type: APPLY_TIMESTAMPS_SUCCESS_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    conversationId,
    unresolvedCount,
    ready,
    seq
  };
}

export function createApplyTimestampsFailure(
  requestId: string,
  conversationId: string,
  error: string
): ApplyTimestampsFailure {
  return {
    type: APPLY_TIMESTAMPS_FAILURE_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    requestId,
    conversationId,
    error
  };
}

export function createSourceUpdatedEvent(
  conversationId: string,
  seq: number,
  sessionId: string
): SourceUpdatedEvent {
  return {
    type: SOURCE_UPDATED_EVENT_TYPE,
    signature: RUNTIME_MESSAGE_SIGNATURE,
    schema: RUNTIME_MESSAGE_SCHEMA,
    conversationId,
    ready: true,
    seq,
    sessionId
  };
}

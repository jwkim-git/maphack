export const CAPTURE_CONVERSATION_REQUEST_TYPE = "mh-capture-conversation-request";
export const CAPTURE_CONVERSATION_SUCCESS_TYPE = "mh-capture-conversation-success";
export const CAPTURE_CONVERSATION_FAILURE_TYPE = "mh-capture-conversation-failure";
export const ADD_BOOKMARK_REQUEST_TYPE = "mh-add-bookmark-request";
export const ADD_BOOKMARK_SUCCESS_TYPE = "mh-add-bookmark-success";
export const ADD_BOOKMARK_FAILURE_TYPE = "mh-add-bookmark-failure";
export const REMOVE_BOOKMARK_REQUEST_TYPE = "mh-remove-bookmark-request";
export const REMOVE_BOOKMARK_SUCCESS_TYPE = "mh-remove-bookmark-success";
export const REMOVE_BOOKMARK_FAILURE_TYPE = "mh-remove-bookmark-failure";
export const LIST_BOOKMARKS_REQUEST_TYPE = "mh-list-bookmarks-request";
export const LIST_BOOKMARKS_SUCCESS_TYPE = "mh-list-bookmarks-success";
export const LIST_BOOKMARKS_FAILURE_TYPE = "mh-list-bookmarks-failure";
export const LIST_BASE_MESSAGES_REQUEST_TYPE = "mh-list-base-messages-request";
export const LIST_BASE_MESSAGES_SUCCESS_TYPE = "mh-list-base-messages-success";
export const LIST_BASE_MESSAGES_FAILURE_TYPE = "mh-list-base-messages-failure";
export const APPLY_TIMESTAMPS_REQUEST_TYPE = "mh-apply-timestamps-request";
export const APPLY_TIMESTAMPS_SUCCESS_TYPE = "mh-apply-timestamps-success";
export const APPLY_TIMESTAMPS_FAILURE_TYPE = "mh-apply-timestamps-failure";
export const SOURCE_UPDATED_EVENT_TYPE = "mh-source-updated-event";
export const RUNTIME_MESSAGE_SIGNATURE = "MAPHACK_RUNTIME_V1";
export const RUNTIME_MESSAGE_SCHEMA = 1;

export type RuntimeTimestampSource = "fiber";
export type RuntimeCaptureMode = "snapshot" | "delta";
export type RuntimeMessageSignature = typeof RUNTIME_MESSAGE_SIGNATURE;
export type RuntimeMessageSchema = typeof RUNTIME_MESSAGE_SCHEMA;

export interface RuntimeConversation {
  id: string;
  createdAt: number | null;
  updatedAt: number | null;
  platform: string;
  metadata: {
    originalId: string;
    url: string;
  };
}

export interface RuntimeMessageRef {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  preview: string;
  timestamp: number | null;
  platform: string;
  conversationUrl: string;
  metadata: {
    originalId: string;
    turnIndex: number;
  };
}

export interface RuntimeConversationSource {
  conversation: RuntimeConversation;
  messageRefs: RuntimeMessageRef[];
}

export interface RuntimeTimestampMapping {
  messageId: string;
  timestamp: number | null;
}

export interface RuntimeBookmark {
  id: string;
  conversationId: string;
  messageId: string;
  timestamp: number | null;
  turnIndex: number;
  messagePreview: string;
  messageRole: "user" | "assistant";
  conversationUrl: string;
  platform: string;
  createdAt: number;
  edited: boolean;
}

export interface CaptureConversationRequest {
  type: typeof CAPTURE_CONVERSATION_REQUEST_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  captureMode: RuntimeCaptureMode;
  source: RuntimeConversationSource;
}

export interface CaptureConversationSuccess {
  type: typeof CAPTURE_CONVERSATION_SUCCESS_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
}

export interface CaptureConversationFailure {
  type: typeof CAPTURE_CONVERSATION_FAILURE_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  error: string;
}

export interface AddBookmarkRequest {
  type: typeof ADD_BOOKMARK_REQUEST_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  messageRef: RuntimeMessageRef;
}

export interface AddBookmarkSuccess {
  type: typeof ADD_BOOKMARK_SUCCESS_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  bookmark: RuntimeBookmark;
}

export interface AddBookmarkFailure {
  type: typeof ADD_BOOKMARK_FAILURE_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  error: string;
}

export interface RemoveBookmarkRequest {
  type: typeof REMOVE_BOOKMARK_REQUEST_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  bookmarkId: string;
}

export interface RemoveBookmarkSuccess {
  type: typeof REMOVE_BOOKMARK_SUCCESS_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  bookmarkId: string;
}

export interface RemoveBookmarkFailure {
  type: typeof REMOVE_BOOKMARK_FAILURE_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  error: string;
}

export interface ListBookmarksRequest {
  type: typeof LIST_BOOKMARKS_REQUEST_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
}

export interface ListBookmarksSuccess {
  type: typeof LIST_BOOKMARKS_SUCCESS_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  bookmarks: RuntimeBookmark[];
}

export interface ListBookmarksFailure {
  type: typeof LIST_BOOKMARKS_FAILURE_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  error: string;
}

export interface ListBaseMessagesRequest {
  type: typeof LIST_BASE_MESSAGES_REQUEST_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  conversationId: string;
}

export interface ListBaseMessagesSuccess {
  type: typeof LIST_BASE_MESSAGES_SUCCESS_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  messageRefs: RuntimeMessageRef[];
}

export interface ListBaseMessagesFailure {
  type: typeof LIST_BASE_MESSAGES_FAILURE_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  error: string;
}

export interface ApplyTimestampsRequest {
  type: typeof APPLY_TIMESTAMPS_REQUEST_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  conversationId: string;
  source: RuntimeTimestampSource;
  mappings: RuntimeTimestampMapping[];
}

export interface ApplyTimestampsSuccess {
  type: typeof APPLY_TIMESTAMPS_SUCCESS_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  conversationId: string;
  unresolvedCount: number;
  ready: boolean;
  seq: number;
}

export interface ApplyTimestampsFailure {
  type: typeof APPLY_TIMESTAMPS_FAILURE_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  requestId: string;
  conversationId: string;
  error: string;
}

export interface SourceUpdatedEvent {
  type: typeof SOURCE_UPDATED_EVENT_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  conversationId: string;
  ready: true;
  seq: number;
  sessionId: string;
}

export const CAPTURE_CONVERSATION_REQUEST_TYPE = "mh-capture-conversation-request";
export const LIST_BASE_MESSAGES_REQUEST_TYPE = "mh-list-base-messages-request";
export const LIST_BASE_MESSAGES_SUCCESS_TYPE = "mh-list-base-messages-success";
export const LIST_BASE_MESSAGES_FAILURE_TYPE = "mh-list-base-messages-failure";
export const APPLY_TIMESTAMPS_REQUEST_TYPE = "mh-apply-timestamps-request";
export const RUNTIME_MESSAGE_SIGNATURE = "MAPHACK_RUNTIME_V1";
export const RUNTIME_MESSAGE_SCHEMA = 1;

export type RuntimeTimestampSource = "fiber" | "json" | "stream";
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

export interface CaptureConversationRequest {
  type: typeof CAPTURE_CONVERSATION_REQUEST_TYPE;
  signature: RuntimeMessageSignature;
  schema: RuntimeMessageSchema;
  source: RuntimeConversationSource;
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
  conversationId: string;
  source: RuntimeTimestampSource;
  mappings: RuntimeTimestampMapping[];
}

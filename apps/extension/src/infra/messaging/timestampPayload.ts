export const TIMESTAMP_PAYLOAD_TYPE = "MAPHACK_TIMESTAMPS";
export const TIMESTAMP_PAYLOAD_SIGNATURE = "MAPHACK_TIMESTAMP_V1";
export const TIMESTAMP_PULL_REQUEST_TYPE = "MAPHACK_TIMESTAMP_PULL_REQUEST";
export const TIMESTAMP_PULL_REQUEST_SIGNATURE = "MAPHACK_TIMESTAMP_PULL_REQUEST_V1";
export const TIMESTAMP_MESSAGE_SCHEMA = 1;

export type TimestampPayloadType = typeof TIMESTAMP_PAYLOAD_TYPE;
export type TimestampPayloadSignature = typeof TIMESTAMP_PAYLOAD_SIGNATURE;
export type TimestampMessageSchema = typeof TIMESTAMP_MESSAGE_SCHEMA;
export type TimestampPayloadSource = "fiber";
export type TimestampPullRequestType = typeof TIMESTAMP_PULL_REQUEST_TYPE;
export type TimestampPullRequestSignature = typeof TIMESTAMP_PULL_REQUEST_SIGNATURE;

export interface TimestampPayloadItem {
  id: string;
  createTime: number | null;
}

export interface TimestampPayloadMessage {
  type: TimestampPayloadType;
  signature: TimestampPayloadSignature;
  schema: TimestampMessageSchema;
  requestId: string;
  conversationId: string;
  source: TimestampPayloadSource;
  payload: TimestampPayloadItem[];
}

export interface TimestampPullRequestMessage {
  type: TimestampPullRequestType;
  signature: TimestampPullRequestSignature;
  schema: TimestampMessageSchema;
  requestId: string;
  conversationId: string;
  messageIds: string[];
}

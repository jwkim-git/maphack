import type { MessageRef } from "../../../../../packages/core/src/domain/entities/MessageRef";
import type { Bookmark } from "../../../../../packages/core/src/domain/entities/Bookmark";

export interface SourceUpdatedSignal {
  conversationId: string;
  sourceRevision: number;
  backgroundSessionId: string;
  assistantGenerating: boolean;
}

export interface BookmarksUpdatedSignal {
  bookmarkRevision: number;
  backgroundSessionId: string;
}

export type GatewayResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface SidebarGateway {
  subscribeSourceUpdated(listener: (signal: SourceUpdatedSignal) => void): () => void;
  subscribeBookmarksUpdated(listener: (signal: BookmarksUpdatedSignal) => void): () => void;
  listBaseMessages(conversationId: string): Promise<GatewayResult<MessageRef[]>>;
  listBookmarks(): Promise<GatewayResult<Bookmark[]>>;
  addBookmark(messageRef: MessageRef): Promise<GatewayResult<Bookmark>>;
  removeBookmark(bookmarkId: string): Promise<GatewayResult<string>>;
}

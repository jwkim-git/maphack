import type {
  TimestampMapping
} from "../../../../../packages/core/src/application/ports/TimestampPort";
import type { Bookmark } from "../../../../../packages/core/src/domain/entities/Bookmark";
import type {
  ConversationSource
} from "../../../../../packages/core/src/application/ports/ConversationSourcePort";
import type { MessageRef } from "../../../../../packages/core/src/domain/entities/MessageRef";
import type { MapHackConversationId } from "../../../../../packages/core/src/domain/value/MapHackConversationId";
import type { MapHackMessageId } from "../../../../../packages/core/src/domain/value/MapHackMessageId";
import type {
  RuntimeConversationSource,
  RuntimeBookmark,
  RuntimeMessageRef,
  RuntimeTimestampMapping
} from "../../../../../packages/shared/src/types/runtimeMessages";

function toRuntimeMessageRef(ref: MessageRef): RuntimeMessageRef {
  return {
    id: ref.id,
    conversationId: ref.conversationId,
    role: ref.role,
    preview: ref.preview,
    timestamp: ref.timestamp,
    platform: ref.platform,
    conversationUrl: ref.conversationUrl,
    metadata: {
      originalId: ref.metadata.originalId,
      turnIndex: ref.metadata.turnIndex
    }
  };
}

export function toDomainMessageRef(ref: RuntimeMessageRef): MessageRef {
  return {
    id: ref.id as MessageRef["id"],
    conversationId: ref.conversationId as MapHackConversationId,
    role: ref.role,
    preview: ref.preview,
    timestamp: ref.timestamp,
    platform: ref.platform,
    conversationUrl: ref.conversationUrl,
    metadata: {
      originalId: ref.metadata.originalId,
      turnIndex: ref.metadata.turnIndex
    }
  };
}

export function toRuntimeConversationSource(source: ConversationSource): RuntimeConversationSource {
  return {
    conversation: {
      id: source.conversation.id,
      createdAt: source.conversation.createdAt,
      updatedAt: source.conversation.updatedAt,
      platform: source.conversation.platform,
      metadata: {
        originalId: source.conversation.metadata.originalId,
        url: source.conversation.metadata.url
      }
    },
    messageRefs: source.messageRefs.map(toRuntimeMessageRef)
  };
}

export function toRuntimeMessageRefs(messageRefs: MessageRef[]): RuntimeMessageRef[] {
  return messageRefs.map(toRuntimeMessageRef);
}

export function toDomainConversationSource(source: RuntimeConversationSource): ConversationSource {
  return {
    conversation: {
      id: source.conversation.id as MapHackConversationId,
      createdAt: source.conversation.createdAt,
      updatedAt: source.conversation.updatedAt,
      platform: source.conversation.platform,
      metadata: {
        originalId: source.conversation.metadata.originalId,
        url: source.conversation.metadata.url
      }
    },
    messageRefs: source.messageRefs.map(toDomainMessageRef)
  };
}

export function toRuntimeTimestampMappings(
  payload: ReadonlyArray<{ id: string; createTime: number | null }>
): RuntimeTimestampMapping[] {
  return payload.map((item) => ({
    messageId: item.id,
    timestamp: item.createTime
  }));
}

export function toDomainTimestampMappings(
  mappings: RuntimeTimestampMapping[]
): TimestampMapping[] {
  return mappings.map((item) => ({
    messageId: item.messageId as MapHackMessageId,
    timestamp: item.timestamp
  }));
}

export function toRuntimeBookmark(bookmark: Bookmark): RuntimeBookmark {
  return {
    id: bookmark.id,
    conversationId: bookmark.conversationId,
    messageId: bookmark.messageId,
    timestamp: bookmark.timestamp,
    turnIndex: bookmark.turnIndex,
    messagePreview: bookmark.messagePreview,
    messageRole: bookmark.messageRole,
    conversationUrl: bookmark.conversationUrl,
    platform: bookmark.platform,
    createdAt: bookmark.createdAt,
    edited: bookmark.edited
  };
}

export function toRuntimeBookmarks(bookmarks: Bookmark[]): RuntimeBookmark[] {
  return bookmarks.map(toRuntimeBookmark);
}

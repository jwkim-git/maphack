"use strict";
(() => {
  // packages/core/src/domain/factories/createBookmarkFromMessageRef.ts
  function createBookmarkFromMessageRef(messageRef, createdAtSeconds) {
    const messageId = messageRef.id;
    return {
      id: `bm-${messageRef.conversationId}-${messageId}`,
      conversationId: messageRef.conversationId,
      messageId,
      timestamp: messageRef.timestamp,
      turnIndex: messageRef.metadata.turnIndex,
      messagePreview: messageRef.preview,
      messageRole: messageRef.role,
      conversationUrl: messageRef.conversationUrl,
      platform: messageRef.platform,
      createdAt: createdAtSeconds,
      edited: false
    };
  }

  // packages/core/src/application/usecases/AddBookmark.ts
  var AddBookmark = class {
    constructor(bookmarkPort) {
      this.bookmarkPort = bookmarkPort;
    }
    async execute(command) {
      const createdAtSeconds = Math.floor(Date.now() / 1e3);
      const bookmark = createBookmarkFromMessageRef(command.messageRef, createdAtSeconds);
      await this.bookmarkPort.upsert(bookmark);
      return bookmark;
    }
  };

  // packages/core/src/application/usecases/CaptureConversation.ts
  var CaptureConversation = class {
    constructor(sourcePort) {
      this.sourcePort = sourcePort;
    }
    async execute(command) {
      await this.sourcePort.upsert(command.source, command.captureMode);
    }
  };

  // packages/core/src/application/usecases/ListBaseMessages.ts
  var ListBaseMessages = class {
    constructor(sourcePort) {
      this.sourcePort = sourcePort;
    }
    async execute(command) {
      const hasSource = await this.sourcePort.hasConversationSource(command.conversationId);
      if (!hasSource) {
        return { status: "source-missing" };
      }
      const messageRefs = await this.sourcePort.listByConversationId(command.conversationId);
      return {
        status: "available",
        messageRefs
      };
    }
  };

  // packages/core/src/application/usecases/ListBookmarks.ts
  var ListBookmarks = class {
    constructor(bookmarkPort) {
      this.bookmarkPort = bookmarkPort;
    }
    async execute() {
      const bookmarks = await this.bookmarkPort.list();
      return { bookmarks };
    }
  };

  // packages/core/src/application/usecases/RemoveBookmark.ts
  var RemoveBookmark = class {
    constructor(bookmarkPort) {
      this.bookmarkPort = bookmarkPort;
    }
    async execute(command) {
      await this.bookmarkPort.remove(command.bookmarkId);
    }
  };

  // packages/shared/src/types/runtimeMessages.ts
  var CAPTURE_CONVERSATION_REQUEST_TYPE = "mh-capture-conversation-request";
  var CAPTURE_CONVERSATION_SUCCESS_TYPE = "mh-capture-conversation-success";
  var CAPTURE_CONVERSATION_FAILURE_TYPE = "mh-capture-conversation-failure";
  var ADD_BOOKMARK_REQUEST_TYPE = "mh-add-bookmark-request";
  var ADD_BOOKMARK_SUCCESS_TYPE = "mh-add-bookmark-success";
  var ADD_BOOKMARK_FAILURE_TYPE = "mh-add-bookmark-failure";
  var REMOVE_BOOKMARK_REQUEST_TYPE = "mh-remove-bookmark-request";
  var REMOVE_BOOKMARK_SUCCESS_TYPE = "mh-remove-bookmark-success";
  var REMOVE_BOOKMARK_FAILURE_TYPE = "mh-remove-bookmark-failure";
  var LIST_BOOKMARKS_REQUEST_TYPE = "mh-list-bookmarks-request";
  var LIST_BOOKMARKS_SUCCESS_TYPE = "mh-list-bookmarks-success";
  var LIST_BOOKMARKS_FAILURE_TYPE = "mh-list-bookmarks-failure";
  var LIST_BASE_MESSAGES_REQUEST_TYPE = "mh-list-base-messages-request";
  var LIST_BASE_MESSAGES_SUCCESS_TYPE = "mh-list-base-messages-success";
  var LIST_BASE_MESSAGES_FAILURE_TYPE = "mh-list-base-messages-failure";
  var APPLY_TIMESTAMPS_REQUEST_TYPE = "mh-apply-timestamps-request";
  var APPLY_TIMESTAMPS_SUCCESS_TYPE = "mh-apply-timestamps-success";
  var APPLY_TIMESTAMPS_FAILURE_TYPE = "mh-apply-timestamps-failure";
  var SOURCE_UPDATED_EVENT_TYPE = "mh-source-updated-event";
  var RUNTIME_MESSAGE_SIGNATURE = "MAPHACK_RUNTIME_V1";
  var RUNTIME_MESSAGE_SCHEMA = 1;

  // apps/extension/src/infra/messaging/runtimeMessageFactories.ts
  function createCaptureConversationSuccess(requestId) {
    return {
      type: CAPTURE_CONVERSATION_SUCCESS_TYPE,
      signature: RUNTIME_MESSAGE_SIGNATURE,
      schema: RUNTIME_MESSAGE_SCHEMA,
      requestId
    };
  }
  function createCaptureConversationFailure(requestId, error) {
    return {
      type: CAPTURE_CONVERSATION_FAILURE_TYPE,
      signature: RUNTIME_MESSAGE_SIGNATURE,
      schema: RUNTIME_MESSAGE_SCHEMA,
      requestId,
      error
    };
  }
  function createAddBookmarkSuccess(requestId, bookmark) {
    return {
      type: ADD_BOOKMARK_SUCCESS_TYPE,
      signature: RUNTIME_MESSAGE_SIGNATURE,
      schema: RUNTIME_MESSAGE_SCHEMA,
      requestId,
      bookmark
    };
  }
  function createAddBookmarkFailure(requestId, error) {
    return {
      type: ADD_BOOKMARK_FAILURE_TYPE,
      signature: RUNTIME_MESSAGE_SIGNATURE,
      schema: RUNTIME_MESSAGE_SCHEMA,
      requestId,
      error
    };
  }
  function createRemoveBookmarkSuccess(requestId, bookmarkId) {
    return {
      type: REMOVE_BOOKMARK_SUCCESS_TYPE,
      signature: RUNTIME_MESSAGE_SIGNATURE,
      schema: RUNTIME_MESSAGE_SCHEMA,
      requestId,
      bookmarkId
    };
  }
  function createRemoveBookmarkFailure(requestId, error) {
    return {
      type: REMOVE_BOOKMARK_FAILURE_TYPE,
      signature: RUNTIME_MESSAGE_SIGNATURE,
      schema: RUNTIME_MESSAGE_SCHEMA,
      requestId,
      error
    };
  }
  function createListBookmarksSuccess(requestId, bookmarks) {
    return {
      type: LIST_BOOKMARKS_SUCCESS_TYPE,
      signature: RUNTIME_MESSAGE_SIGNATURE,
      schema: RUNTIME_MESSAGE_SCHEMA,
      requestId,
      bookmarks
    };
  }
  function createListBookmarksFailure(requestId, error) {
    return {
      type: LIST_BOOKMARKS_FAILURE_TYPE,
      signature: RUNTIME_MESSAGE_SIGNATURE,
      schema: RUNTIME_MESSAGE_SCHEMA,
      requestId,
      error
    };
  }
  function createListBaseMessagesSuccess(requestId, messageRefs) {
    return {
      type: LIST_BASE_MESSAGES_SUCCESS_TYPE,
      signature: RUNTIME_MESSAGE_SIGNATURE,
      schema: RUNTIME_MESSAGE_SCHEMA,
      requestId,
      messageRefs
    };
  }
  function createListBaseMessagesFailure(requestId, error) {
    return {
      type: LIST_BASE_MESSAGES_FAILURE_TYPE,
      signature: RUNTIME_MESSAGE_SIGNATURE,
      schema: RUNTIME_MESSAGE_SCHEMA,
      requestId,
      error
    };
  }
  function createApplyTimestampsSuccess(requestId, conversationId, unresolvedCount, ready, seq) {
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
  function createApplyTimestampsFailure(requestId, conversationId, error) {
    return {
      type: APPLY_TIMESTAMPS_FAILURE_TYPE,
      signature: RUNTIME_MESSAGE_SIGNATURE,
      schema: RUNTIME_MESSAGE_SCHEMA,
      requestId,
      conversationId,
      error
    };
  }
  function createSourceUpdatedEvent(conversationId, seq, sessionId) {
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

  // apps/extension/src/infra/messaging/runtimeEnvelopeGuards.ts
  function isObject(value) {
    return typeof value === "object" && value !== null;
  }
  function hasRuntimeEnvelope(value) {
    return value.signature === RUNTIME_MESSAGE_SIGNATURE && value.schema === RUNTIME_MESSAGE_SCHEMA;
  }
  function isNullableFiniteNumber(value) {
    return value === null || typeof value === "number" && Number.isFinite(value);
  }

  // apps/extension/src/infra/messaging/runtimePayloadGuards.ts
  function isRuntimeMessageRef(value) {
    if (!isObject(value)) {
      return false;
    }
    if (typeof value.id !== "string" || typeof value.conversationId !== "string" || value.role !== "user" && value.role !== "assistant" || typeof value.preview !== "string" || !isNullableFiniteNumber(value.timestamp) || typeof value.platform !== "string" || typeof value.conversationUrl !== "string") {
      return false;
    }
    if (!isObject(value.metadata)) {
      return false;
    }
    return typeof value.metadata.originalId === "string" && typeof value.metadata.turnIndex === "number";
  }
  function isRuntimeConversation(value) {
    if (!isObject(value)) {
      return false;
    }
    if (typeof value.id !== "string" || !isNullableFiniteNumber(value.createdAt) || !isNullableFiniteNumber(value.updatedAt) || typeof value.platform !== "string" || !isObject(value.metadata)) {
      return false;
    }
    if (typeof value.metadata.originalId !== "string" || typeof value.metadata.url !== "string") {
      return false;
    }
    return true;
  }
  function isRuntimeConversationSource(value) {
    if (!isObject(value)) {
      return false;
    }
    if (!isRuntimeConversation(value.conversation) || !Array.isArray(value.messageRefs)) {
      return false;
    }
    return value.messageRefs.every(isRuntimeMessageRef);
  }
  function isRuntimeTimestampMapping(value) {
    if (!isObject(value)) {
      return false;
    }
    return typeof value.messageId === "string" && isNullableFiniteNumber(value.timestamp);
  }
  function isRuntimeBookmark(value) {
    if (!isObject(value)) {
      return false;
    }
    return typeof value.id === "string" && typeof value.conversationId === "string" && typeof value.messageId === "string" && isNullableFiniteNumber(value.timestamp) && typeof value.turnIndex === "number" && Number.isFinite(value.turnIndex) && typeof value.messagePreview === "string" && (value.messageRole === "user" || value.messageRole === "assistant") && typeof value.conversationUrl === "string" && typeof value.platform === "string" && typeof value.createdAt === "number" && Number.isFinite(value.createdAt) && typeof value.edited === "boolean";
  }

  // apps/extension/src/infra/messaging/runtimeMessageGuards.ts
  function isCaptureConversationRequest(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === CAPTURE_CONVERSATION_REQUEST_TYPE && typeof value.requestId === "string" && (value.captureMode === "snapshot" || value.captureMode === "delta") && isRuntimeConversationSource(value.source);
  }
  function isCaptureConversationSuccess(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === CAPTURE_CONVERSATION_SUCCESS_TYPE && typeof value.requestId === "string";
  }
  function isCaptureConversationFailure(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === CAPTURE_CONVERSATION_FAILURE_TYPE && typeof value.requestId === "string" && typeof value.error === "string";
  }
  function isAddBookmarkRequest(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === ADD_BOOKMARK_REQUEST_TYPE && typeof value.requestId === "string" && isRuntimeMessageRef(value.messageRef);
  }
  function isAddBookmarkSuccess(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === ADD_BOOKMARK_SUCCESS_TYPE && typeof value.requestId === "string" && isRuntimeBookmark(value.bookmark);
  }
  function isAddBookmarkFailure(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === ADD_BOOKMARK_FAILURE_TYPE && typeof value.requestId === "string" && typeof value.error === "string";
  }
  function isRemoveBookmarkRequest(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === REMOVE_BOOKMARK_REQUEST_TYPE && typeof value.requestId === "string" && typeof value.bookmarkId === "string";
  }
  function isRemoveBookmarkSuccess(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === REMOVE_BOOKMARK_SUCCESS_TYPE && typeof value.requestId === "string" && typeof value.bookmarkId === "string";
  }
  function isRemoveBookmarkFailure(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === REMOVE_BOOKMARK_FAILURE_TYPE && typeof value.requestId === "string" && typeof value.error === "string";
  }
  function isListBookmarksRequest(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === LIST_BOOKMARKS_REQUEST_TYPE && typeof value.requestId === "string";
  }
  function isListBookmarksSuccess(value) {
    if (!isObject(value)) {
      return false;
    }
    if (!hasRuntimeEnvelope(value) || value.type !== LIST_BOOKMARKS_SUCCESS_TYPE || typeof value.requestId !== "string" || !Array.isArray(value.bookmarks)) {
      return false;
    }
    return value.bookmarks.every(isRuntimeBookmark);
  }
  function isListBookmarksFailure(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === LIST_BOOKMARKS_FAILURE_TYPE && typeof value.requestId === "string" && typeof value.error === "string";
  }
  function isListBaseMessagesRequest(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === LIST_BASE_MESSAGES_REQUEST_TYPE && typeof value.requestId === "string" && typeof value.conversationId === "string";
  }
  function isListBaseMessagesSuccess(value) {
    if (!isObject(value)) {
      return false;
    }
    if (!hasRuntimeEnvelope(value) || value.type !== LIST_BASE_MESSAGES_SUCCESS_TYPE || typeof value.requestId !== "string" || !Array.isArray(value.messageRefs)) {
      return false;
    }
    return value.messageRefs.every(isRuntimeMessageRef);
  }
  function isListBaseMessagesFailure(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === LIST_BASE_MESSAGES_FAILURE_TYPE && typeof value.requestId === "string" && typeof value.error === "string";
  }
  function isApplyTimestampsRequest(value) {
    if (!isObject(value)) {
      return false;
    }
    if (!hasRuntimeEnvelope(value) || value.type !== APPLY_TIMESTAMPS_REQUEST_TYPE || typeof value.requestId !== "string" || typeof value.conversationId !== "string" || value.source !== "fiber" || !Array.isArray(value.mappings)) {
      return false;
    }
    return value.mappings.every(isRuntimeTimestampMapping);
  }
  function isApplyTimestampsSuccess(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === APPLY_TIMESTAMPS_SUCCESS_TYPE && typeof value.requestId === "string" && typeof value.conversationId === "string" && typeof value.unresolvedCount === "number" && Number.isInteger(value.unresolvedCount) && value.unresolvedCount >= 0 && typeof value.ready === "boolean" && typeof value.seq === "number" && Number.isInteger(value.seq) && value.seq >= 0;
  }
  function isApplyTimestampsFailure(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === APPLY_TIMESTAMPS_FAILURE_TYPE && typeof value.requestId === "string" && typeof value.conversationId === "string" && typeof value.error === "string";
  }
  function isSourceUpdatedEvent(value) {
    if (!isObject(value)) {
      return false;
    }
    return hasRuntimeEnvelope(value) && value.type === SOURCE_UPDATED_EVENT_TYPE && typeof value.conversationId === "string" && value.ready === true && typeof value.seq === "number" && Number.isFinite(value.seq) && typeof value.sessionId === "string" && value.sessionId.length > 0;
  }

  // apps/extension/src/infra/messaging/runtimeMapper.ts
  function toRuntimeMessageRef(ref) {
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
  function toDomainMessageRef(ref) {
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
  function toRuntimeMessageRefs(messageRefs) {
    return messageRefs.map(toRuntimeMessageRef);
  }
  function toDomainConversationSource(source) {
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
      messageRefs: source.messageRefs.map(toDomainMessageRef)
    };
  }
  function toDomainTimestampMappings(mappings) {
    return mappings.map((item) => ({
      messageId: item.messageId,
      timestamp: item.timestamp
    }));
  }
  function toRuntimeBookmark(bookmark) {
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
  function toRuntimeBookmarks(bookmarks) {
    return bookmarks.map(toRuntimeBookmark);
  }

  // apps/extension/src/infra/providers/index.ts
  function resolveProviderIdByHostname(hostname) {
    const normalized = hostname.trim().toLowerCase();
    if (normalized === "chatgpt.com" || normalized === "chat.openai.com") {
      return "chatgpt";
    }
    if (normalized === "gemini.google.com") {
      return "gemini";
    }
    return null;
  }

  // apps/extension/src/infra/storage/indexedDb.ts
  var DEFAULT_DB_NAME = "maphack";
  var DEFAULT_STORE_NAME = "bookmarks";
  var DEFAULT_DB_VERSION = 2;
  var INDEXED_DB_UNAVAILABLE_ERROR = "indexeddb-unavailable";
  var CONVERSATION_ID_INDEX = "conversationId";
  function normalizeBookmark(bookmark) {
    return {
      ...bookmark,
      edited: bookmark.edited ?? false
    };
  }
  function cloneBookmark(bookmark) {
    return normalizeBookmark(bookmark);
  }
  function toError(error, fallbackMessage) {
    if (error instanceof Error) {
      return error;
    }
    return new Error(fallbackMessage);
  }
  function sortBookmarksByCreatedAtDesc(bookmarks) {
    return bookmarks.sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return right.createdAt - left.createdAt;
      }
      return left.id.localeCompare(right.id);
    });
  }
  var IndexedDbBookmarkStore = class {
    constructor(options = {}) {
      this.databasePromise = null;
      const globalIndexedDb = globalThis.indexedDB;
      this.indexedDb = options.indexedDb ?? globalIndexedDb ?? null;
      this.databaseName = options.databaseName ?? DEFAULT_DB_NAME;
      this.storeName = options.storeName ?? DEFAULT_STORE_NAME;
      this.version = options.version ?? DEFAULT_DB_VERSION;
    }
    async upsert(bookmark) {
      const next = cloneBookmark(bookmark);
      await this.runReadWrite((store) => store.put(next));
    }
    async remove(bookmarkId) {
      await this.runReadWrite((store) => store.delete(bookmarkId));
    }
    async list() {
      const rows = await this.runReadOnly(
        (store) => store.getAll()
      );
      return sortBookmarksByCreatedAtDesc(rows.map(cloneBookmark));
    }
    async listByConversationId(conversationId) {
      const rows = await this.runReadOnly(
        (store) => store.index(CONVERSATION_ID_INDEX).getAll(conversationId)
      );
      return sortBookmarksByCreatedAtDesc(rows.map(cloneBookmark));
    }
    async updateEdited(bookmarkId, edited) {
      await this.runReadWrite((store) => {
        const readRequest = store.get(bookmarkId);
        readRequest.onsuccess = () => {
          const current = readRequest.result;
          if (!current) {
            return;
          }
          if ((current.edited ?? false) === edited) {
            return;
          }
          store.put({
            ...current,
            edited
          });
        };
        return readRequest;
      });
    }
    async getDatabase() {
      if (this.indexedDb === null) {
        throw new Error(INDEXED_DB_UNAVAILABLE_ERROR);
      }
      if (this.databasePromise !== null) {
        return this.databasePromise;
      }
      this.databasePromise = new Promise((resolve, reject) => {
        const request = this.indexedDb.open(this.databaseName, this.version);
        request.onupgradeneeded = () => {
          const database = request.result;
          const store = database.objectStoreNames.contains(this.storeName) ? request.transaction.objectStore(this.storeName) : database.createObjectStore(this.storeName, { keyPath: "id" });
          if (!store.indexNames.contains(CONVERSATION_ID_INDEX)) {
            store.createIndex(CONVERSATION_ID_INDEX, "conversationId", { unique: false });
          }
        };
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(toError(request.error, "indexeddb-open-failed"));
        };
      });
      return this.databasePromise;
    }
    async runReadWrite(operation) {
      const database = await this.getDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(this.storeName, "readwrite");
        const store = transaction.objectStore(this.storeName);
        let settled = false;
        const rejectOnce = (error, fallbackMessage) => {
          if (settled) {
            return;
          }
          settled = true;
          reject(toError(error, fallbackMessage));
        };
        transaction.oncomplete = () => {
          if (settled) {
            return;
          }
          settled = true;
          resolve();
        };
        transaction.onerror = () => {
          rejectOnce(transaction.error, "indexeddb-transaction-failed");
        };
        transaction.onabort = () => {
          rejectOnce(transaction.error, "indexeddb-transaction-aborted");
        };
        let request;
        try {
          request = operation(store);
        } catch (error) {
          rejectOnce(error, "indexeddb-operation-threw");
          return;
        }
        request.onerror = () => {
          rejectOnce(request.error, "indexeddb-request-failed");
        };
      });
    }
    async runReadOnly(operation) {
      const database = await this.getDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(this.storeName, "readonly");
        const store = transaction.objectStore(this.storeName);
        let settled = false;
        let result;
        const rejectOnce = (error, fallbackMessage) => {
          if (settled) {
            return;
          }
          settled = true;
          reject(toError(error, fallbackMessage));
        };
        transaction.oncomplete = () => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(result);
        };
        transaction.onerror = () => {
          rejectOnce(transaction.error, "indexeddb-transaction-failed");
        };
        transaction.onabort = () => {
          rejectOnce(transaction.error, "indexeddb-transaction-aborted");
        };
        let request;
        try {
          request = operation(store);
        } catch (error) {
          rejectOnce(error, "indexeddb-operation-threw");
          return;
        }
        request.onsuccess = () => {
          result = request.result;
        };
        request.onerror = () => {
          rejectOnce(request.error, "indexeddb-request-failed");
        };
      });
    }
  };

  // apps/extension/src/infra/storage/memoryCache.ts
  function cloneMessageRef(messageRef) {
    return {
      ...messageRef,
      metadata: {
        ...messageRef.metadata
      }
    };
  }
  function cloneSource(source) {
    return {
      conversation: {
        ...source.conversation,
        metadata: {
          ...source.conversation.metadata
        }
      },
      messageRefs: source.messageRefs.map(cloneMessageRef)
    };
  }
  function recalculateConversationTimestampBounds(source) {
    const timestamps = source.messageRefs.map((messageRef) => messageRef.timestamp).filter((timestamp) => timestamp !== null);
    if (timestamps.length === 0) {
      source.conversation.createdAt = null;
      source.conversation.updatedAt = null;
      return;
    }
    source.conversation.createdAt = Math.min(...timestamps);
    source.conversation.updatedAt = Math.max(...timestamps);
  }
  var MemoryConversationSourceCache = class {
    constructor() {
      this.sourceByConversationId = /* @__PURE__ */ new Map();
    }
    persistSource(conversationId, source, timestampSourceByMessageId) {
      recalculateConversationTimestampBounds(source);
      this.sourceByConversationId.set(conversationId, {
        source,
        timestampSourceByMessageId
      });
    }
    async upsert(source, captureMode) {
      if (captureMode === "snapshot") {
        await this.applySnapshotUpsert(source);
        return;
      }
      await this.applyDeltaUpsert(source);
    }
    async hasConversationSource(conversationId) {
      return this.sourceByConversationId.has(conversationId);
    }
    async applySnapshotUpsert(source) {
      const nextSource = cloneSource(source);
      const stored = this.sourceByConversationId.get(source.conversation.id);
      const previousByMessageId = /* @__PURE__ */ new Map();
      if (stored) {
        for (const messageRef of stored.source.messageRefs) {
          previousByMessageId.set(messageRef.id, messageRef);
        }
      }
      for (const messageRef of nextSource.messageRefs) {
        const previous = previousByMessageId.get(messageRef.id);
        if (previous && messageRef.timestamp === null && previous.timestamp !== null) {
          messageRef.timestamp = previous.timestamp;
        }
      }
      nextSource.messageRefs.sort((left, right) => left.metadata.turnIndex - right.metadata.turnIndex);
      const nextTimestampSourceByMessageId = /* @__PURE__ */ new Map();
      if (stored) {
        for (const messageRef of nextSource.messageRefs) {
          const previousSource = stored.timestampSourceByMessageId.get(messageRef.id);
          if (previousSource !== void 0) {
            nextTimestampSourceByMessageId.set(messageRef.id, previousSource);
          }
        }
      }
      this.persistSource(source.conversation.id, nextSource, nextTimestampSourceByMessageId);
    }
    async applyDeltaUpsert(source) {
      const stored = this.sourceByConversationId.get(source.conversation.id);
      if (!stored) {
        throw new Error("snapshot-required");
      }
      const deltaSource = cloneSource(source);
      const nextSource = cloneSource(stored.source);
      nextSource.conversation = {
        ...nextSource.conversation,
        ...deltaSource.conversation,
        metadata: {
          ...nextSource.conversation.metadata,
          ...deltaSource.conversation.metadata
        }
      };
      const previousByMessageId = /* @__PURE__ */ new Map();
      for (const messageRef of stored.source.messageRefs) {
        previousByMessageId.set(messageRef.id, messageRef);
      }
      const mergedMessageRefByTurnIndex = /* @__PURE__ */ new Map();
      for (const messageRef of nextSource.messageRefs) {
        mergedMessageRefByTurnIndex.set(messageRef.metadata.turnIndex, messageRef);
      }
      for (const messageRef of deltaSource.messageRefs) {
        const previous = previousByMessageId.get(messageRef.id);
        if (previous && messageRef.timestamp === null && previous.timestamp !== null) {
          messageRef.timestamp = previous.timestamp;
        }
      }
      for (const messageRef of deltaSource.messageRefs) {
        mergedMessageRefByTurnIndex.set(messageRef.metadata.turnIndex, messageRef);
      }
      nextSource.messageRefs = Array.from(mergedMessageRefByTurnIndex.values());
      nextSource.messageRefs.sort((left, right) => left.metadata.turnIndex - right.metadata.turnIndex);
      const nextTimestampSourceByMessageId = /* @__PURE__ */ new Map();
      for (const messageRef of nextSource.messageRefs) {
        const previousSource = stored.timestampSourceByMessageId.get(messageRef.id);
        if (previousSource !== void 0) {
          nextTimestampSourceByMessageId.set(messageRef.id, previousSource);
        }
      }
      this.persistSource(source.conversation.id, nextSource, nextTimestampSourceByMessageId);
    }
    async listByConversationId(conversationId) {
      const stored = this.sourceByConversationId.get(conversationId);
      if (!stored) {
        return [];
      }
      return stored.source.messageRefs.map(cloneMessageRef);
    }
    async countUnresolvedByConversationId(conversationId) {
      const stored = this.sourceByConversationId.get(conversationId);
      if (!stored) {
        return 0;
      }
      let unresolvedCount = 0;
      for (const messageRef of stored.source.messageRefs) {
        if (messageRef.timestamp === null) {
          unresolvedCount += 1;
        }
      }
      return unresolvedCount;
    }
    async apply(conversationId, source, mappings) {
      const stored = this.sourceByConversationId.get(conversationId);
      if (!stored) {
        return;
      }
      const nextSource = cloneSource(stored.source);
      const nextTimestampSourceByMessageId = new Map(
        stored.timestampSourceByMessageId
      );
      const messageRefById = /* @__PURE__ */ new Map();
      for (const messageRef of nextSource.messageRefs) {
        messageRefById.set(messageRef.id, messageRef);
      }
      let hasAppliedUpdate = false;
      for (const mapping of mappings) {
        if (mapping.timestamp === null) {
          continue;
        }
        const messageRef = messageRefById.get(mapping.messageId);
        if (!messageRef) {
          continue;
        }
        const currentSource = nextTimestampSourceByMessageId.get(messageRef.id);
        if (messageRef.timestamp === mapping.timestamp && currentSource === source) {
          continue;
        }
        messageRef.timestamp = mapping.timestamp;
        nextTimestampSourceByMessageId.set(messageRef.id, source);
        hasAppliedUpdate = true;
      }
      if (!hasAppliedUpdate) {
        return;
      }
      this.persistSource(conversationId, nextSource, nextTimestampSourceByMessageId);
    }
  };

  // apps/extension/src/entrypoints/background/index.ts
  var defaultDependencies = null;
  var defaultListener = null;
  function isObject2(value) {
    return typeof value === "object" && value !== null;
  }
  function normalizeErrorMessage(error) {
    return error instanceof Error && error.message.length > 0 ? error.message : "unexpected-runtime-error";
  }
  function resolveRuntimeId() {
    const runtimeId = globalThis.chrome?.runtime?.id;
    return typeof runtimeId === "string" && runtimeId.length > 0 ? runtimeId : null;
  }
  var sourceVersionByConversationId = /* @__PURE__ */ new Map();
  var backgroundSessionId = `bg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  function resolveSenderTabId(sender) {
    if (!isObject2(sender)) {
      return null;
    }
    const tab = sender.tab;
    if (!isObject2(tab)) {
      return null;
    }
    const tabId = tab.id;
    return typeof tabId === "number" && Number.isInteger(tabId) && tabId >= 0 ? tabId : null;
  }
  function resolveNextConversationSeq(conversationId) {
    const nextSeq = (sourceVersionByConversationId.get(conversationId) ?? 0) + 1;
    sourceVersionByConversationId.set(conversationId, nextSeq);
    return nextSeq;
  }
  function emitSourceUpdatedEvent(conversationId, seq, senderTabId) {
    const chromeLike = globalThis.chrome;
    const event = createSourceUpdatedEvent(conversationId, seq, backgroundSessionId);
    if (!isSourceUpdatedEvent(event)) {
      return;
    }
    if (senderTabId !== null) {
      const tabs = chromeLike?.tabs;
      if (tabs && typeof tabs.sendMessage === "function") {
        tabs.sendMessage(senderTabId, event);
      }
      return;
    }
    const runtime = chromeLike?.runtime;
    if (runtime && typeof runtime.sendMessage === "function") {
      runtime.sendMessage(event);
    }
  }
  function isAllowedSenderUrl(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "chrome-extension:") {
        return true;
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
      }
      return resolveProviderIdByHostname(parsed.hostname) !== null;
    } catch {
      return false;
    }
  }
  function isInternalRuntimeSender(sender, _message) {
    if (!isObject2(sender)) {
      return false;
    }
    const runtimeId = resolveRuntimeId();
    if (runtimeId !== null && sender.id !== runtimeId) {
      return false;
    }
    if (typeof sender.url !== "string" || sender.url.length === 0) {
      return false;
    }
    return isAllowedSenderUrl(sender.url);
  }
  function createBackgroundRuntimeListener(dependencies) {
    const pendingTurnIndexesByConversationId = /* @__PURE__ */ new Map();
    function resolveTurnIndexesFromRuntimeSource(source) {
      const turnIndexes = /* @__PURE__ */ new Set();
      for (const messageRef of source.messageRefs) {
        turnIndexes.add(messageRef.metadata.turnIndex);
      }
      return turnIndexes;
    }
    function mergePendingTurnIndexes(conversationId, turnIndexes) {
      const pending = pendingTurnIndexesByConversationId.get(conversationId) ?? /* @__PURE__ */ new Set();
      for (const turnIndex of turnIndexes) {
        pending.add(turnIndex);
      }
      pendingTurnIndexesByConversationId.set(conversationId, pending);
    }
    function setSnapshotPendingTurnIndexes(conversationId, turnIndexes) {
      const existing = pendingTurnIndexesByConversationId.get(conversationId);
      if (existing && existing.size > 0) {
        return;
      }
      pendingTurnIndexesByConversationId.set(conversationId, new Set(turnIndexes));
    }
    async function reconcileEditedBookmarks(conversationId, turnIndexes) {
      if (turnIndexes.size === 0) {
        return;
      }
      const [messageRefs, bookmarks] = await Promise.all([
        dependencies.sourceStore.listByConversationId(conversationId),
        dependencies.bookmarkStore.listByConversationId(conversationId)
      ]);
      const latestMessageIdByTurnIndex = /* @__PURE__ */ new Map();
      for (const messageRef of messageRefs) {
        latestMessageIdByTurnIndex.set(messageRef.metadata.turnIndex, messageRef.id);
      }
      for (const bookmark of bookmarks) {
        if (!turnIndexes.has(bookmark.turnIndex)) {
          continue;
        }
        const latestMessageId = latestMessageIdByTurnIndex.get(bookmark.turnIndex);
        if (latestMessageId === void 0) {
          continue;
        }
        const nextEdited = latestMessageId !== bookmark.messageId;
        if (bookmark.edited === nextEdited) {
          continue;
        }
        await dependencies.bookmarkStore.updateEdited(bookmark.id, nextEdited);
      }
    }
    return (message, sender, sendResponse) => {
      if (!isInternalRuntimeSender(sender, message)) {
        return false;
      }
      const senderTabId = resolveSenderTabId(sender);
      if (isCaptureConversationRequest(message)) {
        const turnIndexes = resolveTurnIndexesFromRuntimeSource(message.source);
        void dependencies.captureConversation.execute({
          source: toDomainConversationSource(message.source),
          captureMode: message.captureMode
        }).then(() => {
          if (message.captureMode === "snapshot") {
            setSnapshotPendingTurnIndexes(message.source.conversation.id, turnIndexes);
          } else {
            mergePendingTurnIndexes(message.source.conversation.id, turnIndexes);
          }
          const response = createCaptureConversationSuccess(message.requestId);
          if (isCaptureConversationSuccess(response)) {
            sendResponse(response);
          }
        }).catch((error) => {
          if (message.captureMode === "delta" && normalizeErrorMessage(error) === "snapshot-required") {
            mergePendingTurnIndexes(message.source.conversation.id, turnIndexes);
          }
          const response = createCaptureConversationFailure(
            message.requestId,
            normalizeErrorMessage(error)
          );
          if (isCaptureConversationFailure(response)) {
            sendResponse(response);
          }
        });
        return true;
      }
      if (isApplyTimestampsRequest(message)) {
        void dependencies.sourceStore.apply(
          message.conversationId,
          message.source,
          toDomainTimestampMappings(message.mappings)
        ).then(async () => {
          const unresolvedCount = await dependencies.sourceStore.countUnresolvedByConversationId(
            message.conversationId
          );
          const ready = unresolvedCount === 0;
          if (ready) {
            const pendingTurnIndexes = pendingTurnIndexesByConversationId.get(message.conversationId) ?? /* @__PURE__ */ new Set();
            await reconcileEditedBookmarks(message.conversationId, pendingTurnIndexes);
            pendingTurnIndexesByConversationId.delete(message.conversationId);
          }
          const seq = resolveNextConversationSeq(message.conversationId);
          if (ready) {
            emitSourceUpdatedEvent(message.conversationId, seq, senderTabId);
          }
          const response = createApplyTimestampsSuccess(
            message.requestId,
            message.conversationId,
            unresolvedCount,
            ready,
            seq
          );
          if (isApplyTimestampsSuccess(response)) {
            sendResponse(response);
          }
        }).catch((error) => {
          const response = createApplyTimestampsFailure(
            message.requestId,
            message.conversationId,
            normalizeErrorMessage(error)
          );
          if (isApplyTimestampsFailure(response)) {
            sendResponse(response);
          }
        });
        return true;
      }
      if (isAddBookmarkRequest(message)) {
        void dependencies.addBookmark.execute({ messageRef: toDomainMessageRef(message.messageRef) }).then((bookmark) => {
          const response = createAddBookmarkSuccess(message.requestId, toRuntimeBookmark(bookmark));
          if (isAddBookmarkSuccess(response)) {
            sendResponse(response);
          }
        }).catch((error) => {
          const response = createAddBookmarkFailure(message.requestId, normalizeErrorMessage(error));
          if (isAddBookmarkFailure(response)) {
            sendResponse(response);
          }
        });
        return true;
      }
      if (isRemoveBookmarkRequest(message)) {
        void dependencies.removeBookmark.execute({ bookmarkId: message.bookmarkId }).then(() => {
          const response = createRemoveBookmarkSuccess(message.requestId, message.bookmarkId);
          if (isRemoveBookmarkSuccess(response)) {
            sendResponse(response);
          }
        }).catch((error) => {
          const response = createRemoveBookmarkFailure(message.requestId, normalizeErrorMessage(error));
          if (isRemoveBookmarkFailure(response)) {
            sendResponse(response);
          }
        });
        return true;
      }
      if (isListBookmarksRequest(message)) {
        void dependencies.listBookmarks.execute().then((result) => {
          const response = createListBookmarksSuccess(message.requestId, toRuntimeBookmarks(result.bookmarks));
          if (isListBookmarksSuccess(response)) {
            sendResponse(response);
          }
        }).catch((error) => {
          const response = createListBookmarksFailure(message.requestId, normalizeErrorMessage(error));
          if (isListBookmarksFailure(response)) {
            sendResponse(response);
          }
        });
        return true;
      }
      if (!isListBaseMessagesRequest(message)) {
        return false;
      }
      void dependencies.listBaseMessages.execute({ conversationId: message.conversationId }).then((result) => {
        if (result.status === "source-missing") {
          const response2 = createListBaseMessagesFailure(
            message.requestId,
            "list-base-source-missing"
          );
          if (isListBaseMessagesFailure(response2)) {
            sendResponse(response2);
          }
          return;
        }
        const response = createListBaseMessagesSuccess(
          message.requestId,
          toRuntimeMessageRefs(result.messageRefs)
        );
        if (isListBaseMessagesSuccess(response)) {
          sendResponse(response);
        }
      }).catch((error) => {
        const response = createListBaseMessagesFailure(
          message.requestId,
          normalizeErrorMessage(error)
        );
        if (isListBaseMessagesFailure(response)) {
          sendResponse(response);
        }
      });
      return true;
    };
  }
  function createDefaultDependencies() {
    const sourceStore = new MemoryConversationSourceCache();
    const bookmarkStore = new IndexedDbBookmarkStore();
    return {
      sourceStore,
      bookmarkStore,
      captureConversation: new CaptureConversation(sourceStore),
      listBaseMessages: new ListBaseMessages(sourceStore),
      addBookmark: new AddBookmark(bookmarkStore),
      removeBookmark: new RemoveBookmark(bookmarkStore),
      listBookmarks: new ListBookmarks(bookmarkStore)
    };
  }
  function resolveDefaultDependencies() {
    if (defaultDependencies === null) {
      defaultDependencies = createDefaultDependencies();
    }
    return defaultDependencies;
  }
  function resolveBackgroundRuntimeListener() {
    if (defaultListener === null) {
      defaultListener = createBackgroundRuntimeListener(resolveDefaultDependencies());
    }
    return defaultListener;
  }
  function bindBackgroundRuntimeListener() {
    const runtime = globalThis.chrome?.runtime;
    const onMessage = runtime?.onMessage;
    if (!onMessage || typeof onMessage.addListener !== "function") {
      return;
    }
    onMessage.addListener((message, sender, sendResponse) => {
      try {
        return resolveBackgroundRuntimeListener()(message, sender, sendResponse);
      } catch (error) {
        console.error("background-runtime-listener-failed", error);
        return false;
      }
    });
  }
  bindBackgroundRuntimeListener();
})();

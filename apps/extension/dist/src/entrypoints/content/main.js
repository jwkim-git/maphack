"use strict";
(() => {
  // apps/extension/src/infra/messaging/timestampPayload.ts
  var TIMESTAMP_PAYLOAD_TYPE = "MAPHACK_TIMESTAMPS";
  var TIMESTAMP_PAYLOAD_SIGNATURE = "MAPHACK_TIMESTAMP_V1";
  var TIMESTAMP_PULL_REQUEST_TYPE = "MAPHACK_TIMESTAMP_PULL_REQUEST";
  var TIMESTAMP_PULL_REQUEST_SIGNATURE = "MAPHACK_TIMESTAMP_PULL_REQUEST_V1";
  var TIMESTAMP_MESSAGE_SCHEMA = 1;

  // apps/extension/src/infra/messaging/postMessageBridge.ts
  function isObject(value) {
    return typeof value === "object" && value !== null;
  }
  function isTimestampPayloadSource(value) {
    return value === "fiber";
  }
  function toTimestampPayloadItem(value) {
    if (!isObject(value)) {
      return null;
    }
    if (typeof value.id !== "string") {
      return null;
    }
    const rawCreateTime = value.createTime;
    if (rawCreateTime !== null && typeof rawCreateTime !== "number") {
      return null;
    }
    if (typeof rawCreateTime === "number" && !Number.isFinite(rawCreateTime)) {
      return null;
    }
    return {
      id: value.id,
      createTime: rawCreateTime
    };
  }
  function toTimestampPullRequestMessageIds(value) {
    if (!Array.isArray(value)) {
      return null;
    }
    const messageIds = [];
    for (const item of value) {
      if (typeof item !== "string") {
        return null;
      }
      messageIds.push(item);
    }
    if (messageIds.length === 0) {
      return null;
    }
    return messageIds;
  }
  function toTimestampPayloadMessage(value) {
    if (!isObject(value)) {
      return null;
    }
    if (value.type !== TIMESTAMP_PAYLOAD_TYPE || value.signature !== TIMESTAMP_PAYLOAD_SIGNATURE || value.schema !== TIMESTAMP_MESSAGE_SCHEMA || typeof value.requestId !== "string" || value.requestId.length === 0 || typeof value.conversationId !== "string" || !isTimestampPayloadSource(value.source) || !Array.isArray(value.payload)) {
      return null;
    }
    const payload = [];
    for (const item of value.payload) {
      const parsed = toTimestampPayloadItem(item);
      if (parsed === null) {
        return null;
      }
      payload.push(parsed);
    }
    return {
      type: TIMESTAMP_PAYLOAD_TYPE,
      signature: TIMESTAMP_PAYLOAD_SIGNATURE,
      schema: TIMESTAMP_MESSAGE_SCHEMA,
      requestId: value.requestId,
      conversationId: value.conversationId,
      source: value.source,
      payload
    };
  }
  function toTimestampPullRequestMessage(value) {
    if (!isObject(value)) {
      return null;
    }
    if (value.type !== TIMESTAMP_PULL_REQUEST_TYPE || value.signature !== TIMESTAMP_PULL_REQUEST_SIGNATURE || value.schema !== TIMESTAMP_MESSAGE_SCHEMA || typeof value.requestId !== "string" || value.requestId.length === 0 || typeof value.conversationId !== "string") {
      return null;
    }
    const messageIds = toTimestampPullRequestMessageIds(value.messageIds);
    if (messageIds === null) {
      return null;
    }
    return {
      type: TIMESTAMP_PULL_REQUEST_TYPE,
      signature: TIMESTAMP_PULL_REQUEST_SIGNATURE,
      schema: TIMESTAMP_MESSAGE_SCHEMA,
      requestId: value.requestId,
      conversationId: value.conversationId,
      messageIds
    };
  }

  // packages/core/src/domain/value/MapHackMessageId.ts
  var MAPHACK_MESSAGE_ID_PREFIX = "mh-msg-";
  function toOriginalMessageId(messageId) {
    return messageId.slice(MAPHACK_MESSAGE_ID_PREFIX.length);
  }
  function isMapHackMessageId(value) {
    return value.startsWith(MAPHACK_MESSAGE_ID_PREFIX);
  }

  // apps/extension/src/infra/providers/chatgpt/fiberTimestampCollector.ts
  var REACT_FIBER_KEY_PREFIX = "__reactFiber$";
  var MAX_FIBER_ANCESTOR_DEPTH = 8;
  function isRecord(value) {
    return typeof value === "object" && value !== null;
  }
  function toOriginalId(messageId) {
    if (!isMapHackMessageId(messageId)) {
      return messageId.length > 0 ? messageId : null;
    }
    const originalId = toOriginalMessageId(messageId);
    return originalId.length > 0 ? originalId : null;
  }
  function resolveFiber(element) {
    const record = element;
    const reactKey = Object.keys(record).find((key) => key.startsWith(REACT_FIBER_KEY_PREFIX));
    return reactKey ? record[reactKey] : null;
  }
  function resolveCreateTime(messages, originalMessageId) {
    for (const item of messages) {
      if (!isRecord(item)) {
        continue;
      }
      if (item.id !== originalMessageId) {
        continue;
      }
      const value = item.create_time;
      if (typeof value === "number" || typeof value === "string" || value === null) {
        return value;
      }
      return null;
    }
    return void 0;
  }
  function resolveTimestampByMessageId(messageId) {
    const originalMessageId = toOriginalId(messageId);
    if (originalMessageId === null || typeof document === "undefined") {
      return null;
    }
    const messageElement = document.querySelector(`[data-message-id="${originalMessageId}"]`);
    if (!messageElement) {
      return null;
    }
    const fiber = resolveFiber(messageElement);
    if (fiber === null) {
      return null;
    }
    let current = isRecord(fiber) ? fiber : null;
    for (let depth = 0; current !== null && depth < MAX_FIBER_ANCESTOR_DEPTH; depth += 1) {
      const memoizedProps = isRecord(current.memoizedProps) ? current.memoizedProps : null;
      const messages = memoizedProps && Array.isArray(memoizedProps.messages) ? memoizedProps.messages : null;
      if (messages !== null) {
        const createTime = resolveCreateTime(messages, originalMessageId);
        if (createTime !== void 0) {
          return createTime;
        }
      }
      current = isRecord(current.return) ? current.return : null;
    }
    return null;
  }
  function collectFiberTimestampSeeds(messageIds) {
    return messageIds.map((messageId) => ({
      id: messageId,
      createTime: resolveTimestampByMessageId(messageId)
    }));
  }

  // packages/core/src/domain/value/MapHackConversationId.ts
  function toMapHackConversationId(originalId) {
    return `mh-conv-${originalId}`;
  }

  // apps/extension/src/application/chatgpt/resolveChatgptConversationOriginalId.ts
  var CHATGPT_CONVERSATION_PATH_PATTERN = /\/c\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:[/?#]|$)/;
  function normalize(value) {
    return value?.trim() ?? "";
  }
  function extractOriginalId(value) {
    const normalized = normalize(value);
    if (normalized.length === 0) {
      return null;
    }
    const match = normalized.match(CHATGPT_CONVERSATION_PATH_PATTERN);
    return match ? normalize(match[1]).toLowerCase() : null;
  }
  function resolveChatgptConversationOriginalId(input) {
    return extractOriginalId(input.conversationUrl) ?? extractOriginalId(input.pathname) ?? extractOriginalId(input.canonicalHref) ?? null;
  }

  // apps/extension/src/infra/providers/chatgpt/currentConversation.ts
  function readCurrentChatgptConversation() {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return null;
    }
    const canonicalElement = document.querySelector('link[rel="canonical"]');
    const canonicalHref = canonicalElement instanceof HTMLLinkElement ? canonicalElement.href : null;
    const url = window.location.href;
    const pathname = window.location.pathname;
    const originalId = resolveChatgptConversationOriginalId({
      conversationUrl: url,
      pathname,
      canonicalHref
    });
    if (originalId === null) {
      return null;
    }
    return {
      id: toMapHackConversationId(originalId),
      originalId,
      url
    };
  }

  // packages/shared/src/utils/time/toUnixSecondsOrNull.ts
  function toUnixSecondsOrNull(value) {
    if (value == null) {
      return null;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        return null;
      }
      return value >= 1e12 ? Math.floor(value / 1e3) : Math.floor(value);
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      return asNumber >= 1e12 ? Math.floor(asNumber / 1e3) : Math.floor(asNumber);
    }
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return Math.floor(parsed / 1e3);
  }

  // apps/extension/src/infra/providers/chatgpt/timestampAdapter.ts
  function toTimestampPayloadItems(items) {
    const payload = [];
    for (const item of items) {
      if (typeof item.id !== "string") {
        throw new Error("INVALID_TIMESTAMP_SEED_ID");
      }
      if (item.createTime === null) {
        payload.push({
          id: item.id,
          createTime: null
        });
        continue;
      }
      const normalized = toUnixSecondsOrNull(item.createTime);
      if (normalized === null) {
        throw new Error(`INVALID_TIMESTAMP_CREATE_TIME:${item.id}`);
      }
      payload.push({
        id: item.id,
        createTime: normalized
      });
    }
    return payload;
  }
  function createTimestampPayloadMessage(input) {
    const payload = toTimestampPayloadItems(input.items);
    return {
      type: TIMESTAMP_PAYLOAD_TYPE,
      signature: TIMESTAMP_PAYLOAD_SIGNATURE,
      schema: TIMESTAMP_MESSAGE_SCHEMA,
      requestId: input.requestId,
      conversationId: input.conversationId,
      source: input.source,
      payload
    };
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

  // apps/extension/src/entrypoints/content/main.ts
  function resolveActiveConversationId() {
    return readCurrentChatgptConversation()?.id ?? null;
  }
  function isValidTargetOrigin(hostname, targetOrigin) {
    try {
      const parsed = new URL(targetOrigin);
      return parsed.origin === targetOrigin && ["http:", "https:"].includes(parsed.protocol) && parsed.hostname.toLowerCase() === hostname.trim().toLowerCase();
    } catch {
      return false;
    }
  }
  function collectFiberSnapshot(request) {
    if (typeof window === "undefined") {
      return null;
    }
    const activeConversationId = resolveActiveConversationId();
    if (activeConversationId !== null && activeConversationId !== request.conversationId) {
      return null;
    }
    return { conversationId: request.conversationId, source: "fiber", seeds: collectFiberTimestampSeeds(request.messageIds) };
  }
  function publishTimestampPayload(input) {
    if (resolveProviderIdByHostname(input.hostname) !== "chatgpt") {
      return "provider-unsupported";
    }
    if (!isValidTargetOrigin(input.hostname, input.targetOrigin)) {
      return "payload-invalid";
    }
    try {
      const payload = createTimestampPayloadMessage({
        requestId: input.requestId,
        conversationId: input.conversationId,
        source: input.source,
        items: input.seeds
      });
      const validated = toTimestampPayloadMessage(payload);
      if (validated === null) {
        return "payload-invalid";
      }
      input.postTimestampMessage(validated, input.targetOrigin);
      return "sent";
    } catch {
      return "payload-invalid";
    }
  }
  function relayIsolatedTimestampRequest(input) {
    if (input.event.source !== input.currentWindow || input.event.origin !== input.currentOrigin) {
      return "ignored";
    }
    const request = toTimestampPullRequestMessage(input.event.data);
    if (request === null) {
      return "ignored";
    }
    const snapshot = input.collectSeedsByRequest({ conversationId: request.conversationId, messageIds: request.messageIds });
    if (snapshot === null || snapshot.conversationId !== request.conversationId) {
      return "ignored";
    }
    return publishTimestampPayload({
      hostname: input.hostname,
      requestId: request.requestId,
      conversationId: snapshot.conversationId,
      source: snapshot.source,
      seeds: snapshot.seeds,
      targetOrigin: input.currentOrigin,
      postTimestampMessage: input.postTimestampMessage
    }) === "sent" ? "accepted" : "ignored";
  }
  function bootstrapMainTimestampBridge() {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function" || typeof window.postMessage !== "function") {
      return;
    }
    window.addEventListener("message", (event) => {
      relayIsolatedTimestampRequest({
        event: { source: event.source, origin: event.origin, data: event.data },
        currentWindow: window,
        currentOrigin: window.location.origin,
        hostname: window.location.hostname,
        collectSeedsByRequest: collectFiberSnapshot,
        postTimestampMessage: (message, targetOrigin) => window.postMessage(message, targetOrigin)
      });
    });
  }
  void bootstrapMainTimestampBridge();
})();

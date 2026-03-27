export interface ChatgptConversationOriginalIdInput {
  conversationUrl: string;
  pathname: string;
  canonicalHref: string | null;
}

const CHATGPT_CONVERSATION_PATH_PATTERN =
  /\/c\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:[/?#]|$)/;

function normalize(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function extractOriginalId(value: string | null | undefined): string | null {
  const normalized = normalize(value);
  if (normalized.length === 0) {
    return null;
  }

  const match = normalized.match(CHATGPT_CONVERSATION_PATH_PATTERN);
  return match ? normalize(match[1]).toLowerCase() : null;
}

export function resolveChatgptConversationOriginalId(
  input: ChatgptConversationOriginalIdInput
): string | null {
  return (
    extractOriginalId(input.conversationUrl) ??
    extractOriginalId(input.pathname) ??
    extractOriginalId(input.canonicalHref) ??
    null
  );
}

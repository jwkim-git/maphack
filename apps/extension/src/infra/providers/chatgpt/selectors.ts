export const CHATGPT_MESSAGE_CONTAINER_PRIMARY = "[data-message-id]";

export const CHATGPT_MESSAGE_CONTAINER_FALLBACKS = [
  'article[data-testid^="conversation-turn-"]',
  "article[data-turn]"
] as const;

export const CHATGPT_SCROLL_CONTAINER_PRIMARY = "[data-scroll-root]";

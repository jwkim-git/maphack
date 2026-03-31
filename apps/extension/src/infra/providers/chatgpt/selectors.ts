export const CHATGPT_MESSAGE_CONTAINER_PRIMARY = "[data-message-id]";

export const CHATGPT_MESSAGE_CONTAINER_FALLBACKS = [
  '[data-testid^="conversation-turn-"]',
  "[data-turn]"
] as const;

export const CHATGPT_AGENT_TURN_SELECTOR = "div.agent-turn";

export const CHATGPT_SCROLL_CONTAINER_PRIMARY = "[data-scroll-root]";

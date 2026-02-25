export type ProviderId = "chatgpt" | "gemini";

export function resolveProviderIdByHostname(hostname: string): ProviderId | null {
  const normalized = hostname.trim().toLowerCase();

  if (normalized === "chatgpt.com" || normalized === "chat.openai.com") {
    return "chatgpt";
  }

  if (normalized === "gemini.google.com") {
    return "gemini";
  }

  return null;
}


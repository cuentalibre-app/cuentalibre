import type { Env } from "../env";
import { anthropicProvider } from "./anthropic";
import { openAiProvider } from "./openai";
import type { AiConfig, AiProvider } from "./provider";

export { AiError, type AiProvider, type ModelInput, type TokenUsage } from "./provider";

/*
 * Reading documents with an AI model. The provider sits behind this small adapter,
 * configured with `AI_SCAN_MODEL`, `AI_SCAN_API_KEY` and `AI_SCAN_BASE_URL`, so self-hosters bring
 * their own key or a local model. Keys stay on the server.
 */

export type AiProtocol = "openai" | "anthropic";

/**
 * Which API the provider speaks. A base URL on api.anthropic.com speaks Anthropic's,
 * any other speaks OpenAI's (Ollama, OpenRouter, LM Studio…). Without one, an
 * Anthropic key (`sk-ant-`) goes to Anthropic and any other to OpenAI. Never by
 * the model's name: OpenRouter serves `anthropic/claude-…` over OpenAI's protocol.
 */
export function aiProtocol({ apiKey, baseUrl }: Pick<AiConfig, "apiKey" | "baseUrl">): AiProtocol {
  if (baseUrl) return new URL(baseUrl).hostname === "api.anthropic.com" ? "anthropic" : "openai";
  return apiKey?.startsWith("sk-ant-") ? "anthropic" : "openai";
}

/** The configured provider, or null when `AI_SCAN_MODEL` is unset and reading documents is off. */
export function createAiProvider(
  env: Pick<Env, "AI_SCAN_MODEL" | "AI_SCAN_API_KEY" | "AI_SCAN_BASE_URL">,
  fetcher?: typeof fetch,
): AiProvider | null {
  if (!env.AI_SCAN_MODEL) return null;
  const config: AiConfig = {
    model: env.AI_SCAN_MODEL,
    apiKey: env.AI_SCAN_API_KEY,
    baseUrl: env.AI_SCAN_BASE_URL,
    fetch: fetcher,
  };
  return aiProtocol(config) === "anthropic" ? anthropicProvider(config) : openAiProvider(config);
}

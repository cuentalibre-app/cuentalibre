import type { HelpChatMessage } from "@cuentalibre/contracts";
import { AI_TIMEOUT_MS, AiError, type AiConfig, type TokenUsage } from "./provider";
import { readSse } from "./sse";

/*
 * Streamed conversations, for the help chat, over the same two protocols as reading
 * documents: OpenAI's chat completions (OpenAI, Ollama, OpenRouter, vLLM…) and Anthropic's
 * Messages. The system prompt goes first and unchanged, so providers cache it: Anthropic
 * when asked to, OpenAI-compatible ones on their own.
 */

export interface ChatUsage extends TokenUsage {
  /** Input tokens read from the provider's cache, part of `inputTokens`; null when it doesn't say. */
  cachedInputTokens: number | null;
}

export type ChatEvent = { type: "text"; text: string } | { type: "usage"; usage: ChatUsage };

export interface ChatRequest {
  system: string;
  messages: HelpChatMessage[];
  /** Stops the call, as when the person leaves. */
  signal?: AbortSignal;
}

export interface ChatProvider {
  model: string;
  /**
   * Connects to the provider, throwing `AiError` if it can't or refuses, and then yields
   * the answer's text as it comes, and its usage at the end when the provider reports it.
   */
  stream(request: ChatRequest): Promise<AsyncIterable<ChatEvent>>;
}

/** Longest answer Anthropic's API may write, which requires a limit: a few paragraphs. */
const MAX_ANSWER_TOKENS = 1024;

async function connect(
  fetcher: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal | undefined,
): Promise<ReadableStream<Uint8Array>> {
  const timeout = AbortSignal.timeout(AI_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    throw new AiError(`The AI provider couldn't be reached: ${error instanceof Error ? error.message : error}`);
  }
  if (!response.ok || !response.body) {
    const detail = (await response.text().catch(() => "")).slice(0, 500);
    throw new AiError(`The AI provider answered ${response.status}: ${detail}`);
  }
  return response.body;
}

function parse(data: string): Record<string, any> {
  try {
    return JSON.parse(data) as Record<string, any>;
  } catch {
    throw new AiError("The AI provider streamed something that isn't JSON.");
  }
}

const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);

export function openAiChat({
  model,
  apiKey,
  baseUrl = "https://api.openai.com/v1",
  fetch: fetcher = fetch,
}: AiConfig): ChatProvider {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  return {
    model,
    async stream({ system, messages, signal }) {
      const body = await connect(
        fetcher,
        url,
        apiKey ? { authorization: `Bearer ${apiKey}` } : {},
        {
          model,
          stream: true,
          stream_options: { include_usage: true },
          messages: [{ role: "system", content: system }, ...messages],
        },
        signal,
      );
      return (async function* (): AsyncGenerator<ChatEvent> {
        for await (const { data } of readSse(body)) {
          if (data === "[DONE]") return;
          const chunk = parse(data);
          if (chunk.error) throw new AiError(`The AI provider failed: ${JSON.stringify(chunk.error).slice(0, 500)}`);
          const text = chunk.choices?.[0]?.delta?.content;
          if (typeof text === "string" && text) yield { type: "text", text };
          const inputTokens = count(chunk.usage?.prompt_tokens);
          const outputTokens = count(chunk.usage?.completion_tokens);
          if (inputTokens !== null && outputTokens !== null)
            yield {
              type: "usage",
              usage: {
                inputTokens,
                outputTokens,
                cachedInputTokens: count(chunk.usage.prompt_tokens_details?.cached_tokens),
              },
            };
        }
      })();
    },
  };
}

export function anthropicChat({
  model,
  apiKey,
  baseUrl = "https://api.anthropic.com",
  fetch: fetcher = fetch,
}: AiConfig): ChatProvider {
  const url = `${baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1/messages`;
  return {
    model,
    async stream({ system, messages, signal }) {
      const body = await connect(
        fetcher,
        url,
        { "anthropic-version": "2023-06-01", ...(apiKey && { "x-api-key": apiKey }) },
        {
          model,
          max_tokens: MAX_ANSWER_TOKENS,
          stream: true,
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages,
        },
        signal,
      );
      return (async function* (): AsyncGenerator<ChatEvent> {
        let input: { tokens: number; cached: number } | null = null;
        for await (const { data } of readSse(body)) {
          const event = parse(data);
          switch (event.type) {
            case "message_start": {
              // Anthropic counts the cached tokens apart from `input_tokens`
              const usage = event.message?.usage;
              const tokens = count(usage?.input_tokens);
              const cached = count(usage?.cache_read_input_tokens) ?? 0;
              if (tokens !== null)
                input = { tokens: tokens + (count(usage?.cache_creation_input_tokens) ?? 0) + cached, cached };
              break;
            }
            case "content_block_delta":
              if (event.delta?.type === "text_delta" && typeof event.delta.text === "string")
                yield { type: "text", text: event.delta.text };
              break;
            case "message_delta": {
              const outputTokens = count(event.usage?.output_tokens);
              if (input && outputTokens !== null)
                yield {
                  type: "usage",
                  usage: { inputTokens: input.tokens, outputTokens, cachedInputTokens: input.cached },
                };
              break;
            }
            case "error":
              throw new AiError(`The AI provider failed: ${JSON.stringify(event.error).slice(0, 500)}`);
            case "message_stop":
              return;
          }
        }
      })();
    },
  };
}

import { AiError, postJson, toBase64, usageOf, type AiConfig, type AiProvider, type ModelInput } from "./provider";

/*
 * Anthropic's Messages API. The answer comes as the input of a tool the model is
 * made to call, which follows the schema on every Claude model. PDFs without a
 * text layer go as documents, which Claude reads page by page as images.
 */

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const TOOL = "record_purchase";

function userContent(input: ModelInput) {
  switch (input.kind) {
    case "text":
      return `Read this document, taken from a PDF's text layer:\n\n${input.text}`;
    case "image":
      return [
        { type: "image", source: { type: "base64", media_type: input.mediaType, data: toBase64(input.data) } },
        { type: "text", text: "Read this document." },
      ];
    case "pdf":
      return [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(input.data) } },
        { type: "text", text: "Read this document." },
      ];
  }
}

export function anthropicProvider({
  model,
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  fetch: fetcher = fetch,
}: AiConfig): AiProvider {
  // `AI_BASE_URL` may name the host alone or end in /v1, like OpenAI's
  const url = `${baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1/messages`;
  return {
    model,
    async complete(input, { prompt, schema }) {
      const answer = (await postJson(
        fetcher,
        url,
        { "anthropic-version": "2023-06-01", ...(apiKey && { "x-api-key": apiKey }) },
        {
          model,
          max_tokens: 4096,
          system: prompt,
          tools: [{ name: TOOL, description: "Records the fields read from the document.", input_schema: schema }],
          tool_choice: { type: "tool", name: TOOL },
          messages: [{ role: "user", content: userContent(input) }],
        },
      )) as { content?: { type: string; name?: string; input?: unknown }[]; usage?: unknown };
      const call = answer.content?.find((block) => block.type === "tool_use" && block.name === TOOL);
      if (!call) throw new AiError("The model didn't answer with the document's fields.");
      return { answer: call.input, usage: usageOf(answer.usage, "input_tokens", "output_tokens") };
    },
  };
}

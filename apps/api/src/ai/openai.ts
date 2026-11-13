import { AiError, postJson, toBase64, type AiConfig, type AiProvider, type ModelInput } from "./provider";

/*
 * OpenAI's chat completions API, which OpenAI, Ollama, LM Studio, OpenRouter, Mistral,
 * Qwen, vLLM and others speak. The answer is asked for as structured output; a model
 * that can't follow a schema may still answer JSON, which is checked afterwards anyway.
 */

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function userContent(input: ModelInput) {
  const instruction = { type: "text", text: "Read this document." };
  switch (input.kind) {
    case "text":
      return `Read this document, taken from a PDF's text layer:\n\n${input.text}`;
    case "image":
      return [
        instruction,
        { type: "image_url", image_url: { url: `data:${input.mediaType};base64,${toBase64(input.data)}` } },
      ];
    case "pdf":
      return [
        instruction,
        {
          type: "file",
          file: { filename: "documento.pdf", file_data: `data:application/pdf;base64,${toBase64(input.data)}` },
        },
      ];
  }
}

/** The JSON in a message, without the code fence some local models wrap it in. */
export function parseJsonMessage(content: string): unknown {
  const unfenced = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "");
  try {
    return JSON.parse(unfenced);
  } catch {
    throw new AiError("The model's answer isn't JSON.");
  }
}

export function openAiProvider({
  model,
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  fetch: fetcher = fetch,
}: AiConfig): AiProvider {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  return {
    async complete(input, { prompt, schema }) {
      const answer = (await postJson(fetcher, url, apiKey ? { authorization: `Bearer ${apiKey}` } : {}, {
        model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: userContent(input) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "purchase", strict: true, schema } },
      })) as { choices?: { message?: { content?: unknown; refusal?: unknown } }[] };
      const message = answer.choices?.[0]?.message;
      if (typeof message?.refusal === "string" && message.refusal) throw new AiError("The model refused to answer.");
      if (typeof message?.content !== "string") throw new AiError("The model's answer has no content.");
      return parseJsonMessage(message.content);
    },
  };
}

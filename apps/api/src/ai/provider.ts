/*
 * What every provider adapter shares: the input it reads, its interface, and the
 * HTTP call. Errors never carry the document, which may hold personal data.
 */

/** What the model reads: a PDF's text layer, a photo, or a PDF without text (a scan). */
export type ModelInput =
  | { kind: "text"; text: string }
  | { kind: "image"; mediaType: string; data: Uint8Array }
  | { kind: "pdf"; data: Uint8Array };

export interface AiProvider {
  /** Asks the model for a JSON answer that should match `schema`; returns it unchecked. */
  complete(input: ModelInput, request: { prompt: string; schema: Record<string, unknown> }): Promise<unknown>;
}

/** The provider failed or answered something that isn't the requested JSON. */
export class AiError extends Error {}

export interface AiConfig {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  /** The HTTP client; tests pass a fake provider. */
  fetch?: typeof fetch;
}

/** How long a model may take to read one document. */
export const AI_TIMEOUT_MS = 90_000;

/** Posts JSON to the provider and returns its JSON answer, or throws `AiError` without the document in it. */
export async function postJson(
  fetcher: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AiError(`The AI provider couldn't be reached: ${error instanceof Error ? error.message : error}`);
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 500);
    throw new AiError(`The AI provider answered ${response.status}: ${detail}`);
  }
  return response.json().catch(() => {
    throw new AiError("The AI provider's answer isn't JSON.");
  });
}

export const toBase64 = (data: Uint8Array) => Buffer.from(data).toString("base64");

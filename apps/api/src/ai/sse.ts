/*
 * Server-sent events, as the providers stream their answers: blocks separated by a
 * blank line, each with an optional `event:` and one or more `data:` lines.
 */

export interface SseEvent {
  event: string | null;
  data: string;
}

function parseBlock(block: string): SseEvent | null {
  let event: string | null = null;
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  return data.length ? { event, data: data.join("\n") } : null;
}

/** The events in a response body, as they arrive. */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop()!;
    for (const block of blocks) {
      const event = parseBlock(block);
      if (event) yield event;
    }
  }
  const event = parseBlock(buffer + decoder.decode());
  if (event) yield event;
}

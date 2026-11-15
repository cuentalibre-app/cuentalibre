/** A run of an answer's text: plain words, or a web address to open. */
export type AnswerPart = { text: string } | { href: string };

/**
 * An answer split into text and the web addresses in it, so the chat can make them links. The
 * punctuation that ends a sentence or closes a bracket after an address stays text.
 */
export function splitLinks(text: string): AnswerPart[] {
  const parts: AnswerPart[] = [];
  let rest = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"«»]+/g)) {
    const href = match[0].replace(/[.,;:!?)\]]+$/, "");
    if (match.index > rest) parts.push({ text: text.slice(rest, match.index) });
    parts.push({ href });
    rest = match.index + href.length;
  }
  if (rest < text.length) parts.push({ text: text.slice(rest) });
  return parts;
}

/* Email templates: a subject and a message whose {{placeholders}} are filled in from the document when sending. */

/** `{{ name }}`: letters, digits and underscores, spaces around the name allowed. */
const PLACEHOLDER = /\{\{\s*([\p{L}\d_]+)\s*\}\}/gu;

const key = (name: string) => name.toLocaleLowerCase("es");

/**
 * Replaces each `{{name}}` with its value, whatever the name's case. Names
 * without a value stay as written, so a typo shows in the email instead of
 * vanishing.
 */
export function fillPlaceholders(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(PLACEHOLDER, (match, name: string) => values[key(name)] ?? match);
}

/** The placeholders in a text that aren't among the known names, each once, as first written. */
export function unknownPlaceholders(text: string, known: readonly string[]): string[] {
  const names = new Set(known.map(key));
  const unknown = new Map<string, string>();
  for (const [, name] of text.matchAll(PLACEHOLDER))
    if (!names.has(key(name!)) && !unknown.has(key(name!))) unknown.set(key(name!), name!);
  return [...unknown.values()];
}

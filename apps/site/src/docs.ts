import { getCollection, type CollectionEntry } from "astro:content";
import { docSectionIds } from "./site";

export type DocEntry = CollectionEntry<"docs">;

/** The page's path under /docs: "api/index" is /docs/api, "index" is /docs. */
export const docSlug = (entry: DocEntry) => entry.id.replace(/(^|\/)index$/, "") || undefined;
export const docHref = (entry: DocEntry) => ["/docs", docSlug(entry)].filter(Boolean).join("/");

/** Every page, by section and then by order: the reading order of the index and of prev/next. */
export async function docPages() {
  const entries = await getCollection("docs");
  const rank = (entry: DocEntry) => docSectionIds.indexOf(entry.data.section);
  return entries.sort((a, b) => rank(a) - rank(b) || a.data.order - b.data.order);
}

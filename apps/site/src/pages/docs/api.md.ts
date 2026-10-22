import type { APIRoute } from "astro";
import { docHref, docPages } from "../../docs";

/**
 * The whole API reference as one Markdown file, for agents and tools that read
 * docs: every page of the section in order, under its title, with absolute links.
 */
export const GET: APIRoute = async ({ site }) => {
  const pages = (await docPages()).filter((entry) => entry.data.section === "api");
  const origin = site?.origin ?? "";
  const body = pages
    .map((entry) => {
      const text = (entry.body ?? "").replace(/^(#+) /gm, "#$1 ").replace(/\]\(\//g, `](${origin}/`);
      return `## ${entry.data.title}\n\n${entry.data.description}\n\nPágina: ${origin}${docHref(entry)}\n\n${text.trim()}`;
    })
    .join("\n\n");
  const intro = "# API de cuentalibre\n\nReferencia completa de la API de cuentalibre, en un solo archivo.";
  return new Response(`${intro}\n\n${body}\n`, { headers: { "content-type": "text/markdown; charset=utf-8" } });
};

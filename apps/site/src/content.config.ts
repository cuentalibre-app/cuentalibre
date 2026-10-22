import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { docSectionIds } from "./site";

/** The documentation pages, written in Markdown under src/content/docs. */
const docs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    /** Shorter title for the index, when the page's own is long. */
    label: z.string().optional(),
    /** Lead paragraph under the title, and the page's meta description. */
    description: z.string(),
    section: z.enum(docSectionIds),
    /** Position within its section. */
    order: z.number(),
  }),
});

export const collections = { docs };

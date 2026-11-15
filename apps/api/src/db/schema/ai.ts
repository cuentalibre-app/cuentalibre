import { sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { createdAt } from "./columns";

/**
 * Each time a document was read with an AI model: what the monthly limit counts, and
 * a cache of the answer, so the same file isn't read twice. A row is made before the
 * model is called and removed if the call fails; `answer` is null while it is on its way.
 * Tokens and cost are for running the instance, never shown to the organization.
 */
export const aiReading = pgTable(
  "ai_reading",
  {
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    id: uuid().notNull(),
    /** `YYYY-MM` in Spain's time, the month it counts towards. */
    month: text().notNull(),
    /** SHA-256 of the file's bytes, in hex: the cache key along with the model and the prompt. */
    fileHash: text().notNull(),
    model: text().notNull(),
    /** A hash of the prompt and the answer's schema: changing either reads files afresh. */
    promptVersion: text().notNull(),
    /** What the model read: the PDF's text layer, an image or the PDF itself. */
    source: text().$type<"text" | "image" | "pdf">(),
    /** The model's answer, checked against its schema. */
    answer: jsonb(),
    inputTokens: integer(),
    outputTokens: integer(),
    /** Estimated from `AI_SCAN_INPUT_PRICE` and `AI_SCAN_OUTPUT_PRICE`, in millionths of a dollar; null without them. */
    costMicros: bigint({ mode: "number" }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.id] }),
    index().on(table.organizationId, table.month),
    index().on(table.organizationId, table.fileHash),
    check("ai_reading_source_check", sql`${table.source} in ('text', 'image', 'pdf')`),
  ],
);

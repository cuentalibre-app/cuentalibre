import { sql } from "drizzle-orm";
import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { createdAt } from "./columns";

export type OutboxTopic = "verifactu" | "email";

/**
 * Background work: submissions to the AEAT and emails. Jobs are written in
 * the same transaction as the change that needs them, and a worker runs them
 * (`src/outbox/worker.ts`), taking each with `FOR UPDATE SKIP LOCKED` and a
 * lease so several API processes can share the table.
 */
export const outbox = pgTable(
  "outbox",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    topic: text().$type<OutboxTopic>().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    /** At most one unfinished job per organization and key, so repeated requests don't pile up. */
    key: text(),
    runAfter: timestamp({ withTimezone: true }).defaultNow().notNull(),
    /** Taken by a worker until then; after that another may retry it. */
    lockedUntil: timestamp({ withTimezone: true }),
    attempts: integer().notNull().default(0),
    lastError: text(),
    createdAt: createdAt(),
    doneAt: timestamp({ withTimezone: true }),
    /** Gave up after too many attempts. */
    failedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index()
      .on(table.runAfter)
      .where(sql`${table.doneAt} is null and ${table.failedAt} is null`),
    uniqueIndex()
      .on(table.organizationId, table.key)
      .where(sql`${table.key} is not null and ${table.doneAt} is null and ${table.failedAt} is null`),
  ],
);

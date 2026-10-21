import type { FiledForm } from "@cuentalibre/core";
import { date, index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { createdAt, updatedAt } from "./columns";
import { amount } from "./sales";

/**
 * Closed quarters. While a quarter is closed the API rejects issuing invoices
 * dated in it. Reopening leaves a tombstone, so the change feed can report it;
 * closing it again brings the row back.
 */
export const closedQuarter = pgTable(
  "closed_quarter",
  {
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** "2026-T2". */
    period: text().notNull(),
    closedOn: date({ mode: "string" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.period] })],
);

/**
 * Returns as filed, stored when their quarter is closed. Never changed or
 * deleted: closing the quarter again stores a new version, and the latest
 * one (by `filed_on`, then `created_at`) counts.
 */
export const filedReturn = pgTable(
  "filed_return",
  {
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    id: uuid().notNull(),
    /** "303", "130". */
    form: text().$type<FiledForm>().notNull(),
    /** "2026-T2". */
    period: text().notNull(),
    /** Box number to value, as filed. */
    boxes: jsonb().$type<Record<string, number>>().notNull(),
    /** Cents to pay (positive) or to offset or refund (negative). */
    result: amount().notNull(),
    filedOn: date({ mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.id] }),
    index().on(table.organizationId, table.form, table.period),
  ],
);

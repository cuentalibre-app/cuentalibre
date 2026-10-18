import { date, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { createdAt, updatedAt } from "./columns";

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

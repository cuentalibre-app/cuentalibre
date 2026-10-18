import { bigint, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * Append-only log of every change to an organization's data: the feed clients
 * sync from (`seq` is the cursor) and the audit trail. Writes to one
 * organization are serialized (see `withOrganizationWrite`), so within an
 * organization `seq` follows commit order and a client never skips a change.
 */
export const changeLog = pgTable(
  "change_log",
  {
    seq: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** The table, e.g. `contact`. */
    entity: text().$type<"contact">().notNull(),
    recordId: uuid().notNull(),
    op: text().$type<"create" | "update" | "delete">().notNull(),
    userId: uuid().references(() => user.id, { onDelete: "set null" }),
    at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index().on(table.organizationId, table.seq)],
);

import type { SyncCommand } from "@cuentalibre/contracts";
import { bigint, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export type LoggedEntity =
  | "contact"
  | "sales_document"
  | "purchase_invoice"
  | "expense"
  | "closed_quarter"
  | "filed_return"
  | "organization_setting"
  | "tag"
  | "payment_method"
  | "manual_payment"
  | "catalog_family"
  | "product"
  | "stock_movement"
  | "tax_id_check";

/**
 * Append-only log of every change to an organization's data: the feed clients
 * sync from (`seq` is the cursor) and the audit trail. Writes to one
 * organization are serialized (see `applyCommands`), so within an
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
    entity: text().$type<LoggedEntity>().notNull(),
    /** The record's ID; for closed quarters, the period; for settings, the section. */
    recordId: text().notNull(),
    /** The command that made the change, or `verifactu` when the AEAT answered about an invoice's record, the issuer or a client's NIF. */
    op: text().$type<SyncCommand["type"] | "verifactu">().notNull(),
    userId: uuid().references(() => user.id, { onDelete: "set null" }),
    at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index().on(table.organizationId, table.seq)],
);

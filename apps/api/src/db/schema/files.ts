import { bigint, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { createdAt } from "./columns";

/**
 * Uploaded files: receipts, supplier invoices, contracts. The bytes live in the
 * storage adapter under `storage_key`; records name a file by its ID in their
 * `attachments`. Files never change once uploaded.
 */
export const file = pgTable(
  "file",
  {
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** From the client, like record IDs, so an attachment can be shown before its upload ends. */
    id: uuid().notNull(),
    name: text().notNull(),
    contentType: text().notNull(),
    /** Bytes. */
    size: bigint({ mode: "number" }).notNull(),
    /** Where the storage adapter keeps it. */
    storageKey: text().notNull().unique(),
    uploadedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.id] })],
);

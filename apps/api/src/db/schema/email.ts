import type { EmailStatus } from "@fiscalia/contracts";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { createdAt } from "./columns";
import { salesDocument } from "./sales";

/** Emails sent from Fiscalia, such as invoices to their clients. They are queued and sent by the outbox worker. */
export const emailMessage = pgTable(
  "email_message",
  {
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    id: uuid().notNull(),
    documentId: uuid(),
    to: text().array().notNull(),
    cc: text().array().notNull(),
    replyTo: text(),
    /** Display name of the sender; the address is the instance's. */
    fromName: text().notNull(),
    subject: text().notNull(),
    body: text().notNull(),
    /** IDs of uploaded files. */
    attachments: jsonb().$type<string[]>().notNull(),
    status: text().$type<EmailStatus>().notNull().default("queued"),
    error: text(),
    sentBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    sentAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.id] }),
    foreignKey({
      columns: [table.organizationId, table.documentId],
      foreignColumns: [salesDocument.organizationId, salesDocument.id],
    }),
    index().on(table.organizationId, table.documentId),
    check("email_message_status_check", sql`${table.status} in ('queued', 'sent', 'failed')`),
  ],
);

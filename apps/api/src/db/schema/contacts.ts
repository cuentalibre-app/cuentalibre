import type { Attachment, BankAccount, Contact, ContactRole, EInvoiceCodes } from "@cuentalibre/contracts";
import { sql } from "drizzle-orm";
import { boolean, check, index, jsonb, numeric, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { createdAt, updatedAt } from "./columns";

/**
 * Clients and suppliers. The key is `(organization_id, id)`, so other tables
 * reference a contact together with its organization and can't point at
 * another organization's data. Deleted contacts stay as tombstones
 * (`deleted_at`) so the change feed can tell clients to remove them.
 */
export const contact = pgTable(
  "contact",
  {
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    id: uuid().notNull(),
    role: text().$type<ContactRole>().notNull(),
    name: text().notNull(),
    taxId: text().notNull(),
    address: text(),
    postalCode: text(),
    city: text(),
    province: text(),
    country: text(),
    email: text(),
    phone: text(),
    mobile: text(),
    fax: text(),
    website: text(),
    vies: boolean(),
    /** Whole or decimal percentage, 0 to 100. */
    discount: numeric({ precision: 5, scale: 2, mode: "number" }),
    withholding: text().$type<NonNullable<Contact["withholding"]>>(),
    paymentMethodId: text(),
    language: text(),
    numberFormat: text(),
    bankAccounts: jsonb().$type<BankAccount[]>(),
    eInvoice: jsonb().$type<EInvoiceCodes>(),
    custom1: text(),
    custom2: text(),
    notes: text(),
    tags: text().array(),
    attachments: jsonb().$type<Attachment[]>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.id] }),
    index().on(table.organizationId, table.role),
    check("contact_role_check", sql`${table.role} in ('client', 'supplier')`),
  ],
);

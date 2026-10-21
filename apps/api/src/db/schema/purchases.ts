import type { Attachment, ExpenseType, InvestmentAsset, OtherPayee, RentalLocation } from "@cuentalibre/contracts";
import type { PurchaseOperationType, WithholdingKind } from "@cuentalibre/core";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { createdAt, updatedAt } from "./columns";
import { contact } from "./contacts";
import { amount, day, lineColumns } from "./sales";

/**
 * Invoices received from suppliers. Their quarter is decided by `booked_on`:
 * while it is closed, the API only lets their payments, tags, attachments and
 * private notes change. Deleted with a tombstone.
 */
export const purchaseInvoice = pgTable(
  "purchase_invoice",
  {
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    id: uuid().notNull(),
    supplierId: uuid().notNull(),
    /** The supplier's own number. */
    number: text().notNull(),
    issuedOn: day().notNull(),
    bookedOn: day().notNull(),
    dueOn: day(),
    expenseType: text().$type<ExpenseType>().notNull(),
    /** Whole percentages, 0 to 100. */
    imputation: integer().notNull(),
    vatImputation: integer(),
    withholding: text().$type<WithholdingKind>().notNull(),
    operationType: text().$type<PurchaseOperationType>().notNull(),
    operationOn: day(),
    customsDocument: text(),
    cashBasis: boolean().notNull(),
    rental: boolean().notNull(),
    rentalLocation: text().$type<RentalLocation>(),
    cadastralRef: text(),
    rectifiesId: uuid(),
    privateNotes: text().notNull(),
    tags: text().array(),
    attachments: jsonb().$type<Attachment[]>(),
    /** Investment good: how it is amortized. */
    asset: jsonb().$type<InvestmentAsset>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.id] }),
    foreignKey({
      columns: [table.organizationId, table.supplierId],
      foreignColumns: [contact.organizationId, contact.id],
    }),
    foreignKey({
      columns: [table.organizationId, table.rectifiesId],
      foreignColumns: [table.organizationId, table.id],
    }),
    index().on(table.organizationId, table.bookedOn),
    check("purchase_invoice_imputation_check", sql`${table.imputation} between 0 and 100`),
    check("purchase_invoice_vat_imputation_check", sql`${table.vatImputation} between 0 and 100`),
  ],
);

/** Lines of a received invoice, in order. */
export const purchaseLine = pgTable(
  "purchase_line",
  {
    organizationId: uuid().notNull(),
    invoiceId: uuid().notNull(),
    position: integer().notNull(),
    ...lineColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.invoiceId, table.position] }),
    foreignKey({
      columns: [table.organizationId, table.invoiceId],
      foreignColumns: [purchaseInvoice.organizationId, purchaseInvoice.id],
    }).onDelete("cascade"),
  ],
);

/** Payments of a received invoice, in order. A credit note's refunds are negative. */
export const purchasePayment = pgTable(
  "purchase_payment",
  {
    organizationId: uuid().notNull(),
    invoiceId: uuid().notNull(),
    position: integer().notNull(),
    /** The payment's own ID, from the client. */
    id: text().notNull(),
    date: day().notNull(),
    /** Cents. */
    amount: amount().notNull(),
    paymentMethodId: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.invoiceId, table.position] }),
    foreignKey({
      columns: [table.organizationId, table.invoiceId],
      foreignColumns: [purchaseInvoice.organizationId, purchaseInvoice.id],
    }).onDelete("cascade"),
  ],
);

/**
 * Expenses without an invoice of their own (tickets, fees, social security…).
 * Their quarter is decided by `date`, with the same lock as received invoices.
 */
export const expense = pgTable(
  "expense",
  {
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    id: uuid().notNull(),
    date: day().notNull(),
    number: text().notNull(),
    concept: text().notNull(),
    /** Cents, taxes included. */
    amount: amount().notNull(),
    expenseType: text().$type<ExpenseType>().notNull(),
    imputation: integer().notNull(),
    supplierId: uuid(),
    otherPayee: jsonb().$type<OtherPayee>(),
    /** Null while pending. */
    paidOn: day(),
    paymentMethodId: text(),
    rental: boolean().notNull(),
    rentalLocation: text().$type<RentalLocation>(),
    cadastralRef: text(),
    privateNotes: text().notNull(),
    tags: text().array(),
    attachments: jsonb().$type<Attachment[]>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.id] }),
    foreignKey({
      columns: [table.organizationId, table.supplierId],
      foreignColumns: [contact.organizationId, contact.id],
    }),
    index().on(table.organizationId, table.date),
    check("expense_imputation_check", sql`${table.imputation} between 0 and 100`),
    check("expense_payment_check", sql`(${table.paidOn} is null) = (${table.paymentMethodId} is null)`),
  ],
);

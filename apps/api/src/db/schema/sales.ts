import type {
  Attachment,
  IncomeType,
  InvoiceSeries,
  IssuedSnapshot,
  RentalLocation,
  SalesKind,
  SalesStatus,
} from "@fiscalia/contracts";
import type { OperationType, VatBreakdown, WithholdingKind } from "@fiscalia/core";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { createdAt, updatedAt } from "./columns";
import { contact } from "./contacts";

export const day = () => date({ mode: "string" });
export const amount = () => bigint({ mode: "number" });

/** Columns of a document line, shared by sales and purchases. Prices and quantities keep up to six decimals. */
export const lineColumns = () => ({
  /** The line's own ID, from the client. */
  id: text().notNull(),
  concept: text().notNull(),
  detail: text(),
  /** Euros. */
  unitPrice: numeric({ precision: 18, scale: 6, mode: "number" }).notNull(),
  quantity: numeric({ precision: 18, scale: 6, mode: "number" }).notNull(),
  /** Fractions: 0.21 is 21 %. */
  discount: numeric({ precision: 9, scale: 6, mode: "number" }).notNull(),
  vatRate: numeric({ precision: 6, scale: 4, mode: "number" }).notNull(),
  surchargeRate: numeric({ precision: 6, scale: 4, mode: "number" }),
  serviceFrom: day(),
  serviceTo: day(),
  productId: text(),
  unit: text(),
});

/**
 * Invoices, drafts, quotes and delivery notes. An invoice is issued once: it
 * gets its number from the server and a snapshot of its client and totals
 * (`issued_at` and the columns after it), and is never edited or deleted.
 * The other kinds can change freely and are deleted with a tombstone.
 */
export const salesDocument = pgTable(
  "sales_document",
  {
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    id: uuid().notNull(),
    kind: text().$type<SalesKind>().notNull(),
    number: text(),
    series: text().$type<InvoiceSeries>().notNull(),
    /** Custom series in the invoice settings; null for the built-in one of `series`. */
    seriesId: uuid(),
    /** Null on drafts and quotes without a client. */
    clientId: uuid(),
    issuedOn: day().notNull(),
    dueOn: day(),
    incomeType: text().$type<IncomeType>().notNull(),
    withholding: text().$type<WithholdingKind>().notNull(),
    operationType: text().$type<OperationType>().notNull(),
    operationOn: day(),
    cashBasis: boolean().notNull(),
    rental: boolean().notNull(),
    rentalLocation: text().$type<RentalLocation>(),
    cadastralRef: text(),
    rectifiesId: uuid(),
    /** Cents. */
    supplies: amount(),
    tags: text().array(),
    language: text(),
    numberFormat: text(),
    status: text().$type<SalesStatus>().notNull(),
    publicNotes: text().notNull(),
    privateNotes: text().notNull(),
    attachments: jsonb().$type<Attachment[]>(),

    // Frozen when the invoice is issued. Amounts in cents.
    issuedAt: timestamp({ withTimezone: true }),
    clientSnapshot: jsonb().$type<IssuedSnapshot["client"]>(),
    totalBase: amount(),
    totalVat: amount(),
    totalSurcharge: amount(),
    totalWithholding: amount(),
    total: amount(),
    vatBreakdown: jsonb().$type<VatBreakdown[]>(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.id] }),
    foreignKey({
      columns: [table.organizationId, table.clientId],
      foreignColumns: [contact.organizationId, contact.id],
    }),
    foreignKey({
      columns: [table.organizationId, table.rectifiesId],
      foreignColumns: [table.organizationId, table.id],
    }),
    index().on(table.organizationId, table.issuedOn),
    // Numbers are unique per kind; invoices of both series share the kind but not the prefix
    uniqueIndex()
      .on(table.organizationId, table.kind, table.number)
      .where(sql`${table.number} is not null and ${table.deletedAt} is null`),
    check("sales_document_kind_check", sql`${table.kind} in ('invoice', 'draft', 'quote', 'deliveryNote')`),
    check(
      "sales_document_invoice_check",
      sql`${table.kind} <> 'invoice' or (${table.number} is not null and ${table.issuedAt} is not null)`,
    ),
  ],
);

/** Lines of a sales document, in order. */
export const salesLine = pgTable(
  "sales_line",
  {
    organizationId: uuid().notNull(),
    documentId: uuid().notNull(),
    position: integer().notNull(),
    ...lineColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.documentId, table.position] }),
    foreignKey({
      columns: [table.organizationId, table.documentId],
      foreignColumns: [salesDocument.organizationId, salesDocument.id],
    }).onDelete("cascade"),
  ],
);

/** Collections of an issued invoice, in order. A rectifying invoice's refunds are negative. */
export const salesPayment = pgTable(
  "sales_payment",
  {
    organizationId: uuid().notNull(),
    documentId: uuid().notNull(),
    position: integer().notNull(),
    /** The collection's own ID, from the client. */
    id: text().notNull(),
    date: day().notNull(),
    /** Cents. */
    amount: amount().notNull(),
    paymentMethodId: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.documentId, table.position] }),
    foreignKey({
      columns: [table.organizationId, table.documentId],
      foreignColumns: [salesDocument.organizationId, salesDocument.id],
    }).onDelete("cascade"),
  ],
);

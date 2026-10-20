import { z } from "zod";
import { attachmentSchema, cents, id, isoDate, rentalLocationSchema } from "./common";
import { contactSchema } from "./contacts";
import { invoiceLineSchema, invoiceTotalsSchema, operationTypeSchema, withholdingKindSchema } from "./core";

export const salesKindSchema = z.enum(["invoice", "draft", "quote", "deliveryNote"]);
export type SalesKind = z.infer<typeof salesKindSchema>;

/**
 * Stored status. Invoices are pending or paid ("overdue" is derived from the
 * due date); quotes and delivery notes follow their own workflow.
 */
export const salesStatusSchema = z.enum(["pending", "paid", "created", "sent", "accepted", "rejected", "invoiced"]);
export type SalesStatus = z.infer<typeof salesStatusSchema>;

export const invoiceSeriesSchema = z.enum(["normal", "rectifying"]);
export type InvoiceSeries = z.infer<typeof invoiceSeriesSchema>;

/** Income account in the Spanish chart of accounts (PGC), group 7. */
export const incomeTypeSchema = z.enum(["700", "705", "7098", "7099", "740", "746", "747", "752", "769"]);
export type IncomeType = z.infer<typeof incomeTypeSchema>;

export const salesLineSchema = invoiceLineSchema.extend({
  id,
  concept: z.string(),
  /** Longer description printed under the concept. */
  detail: z.string().optional(),
  /** Service period. */
  serviceFrom: isoDate.optional(),
  serviceTo: isoDate.optional(),
  /** Catalog product it was made from; moves its stock when the catalog settings say so. */
  productId: id.optional(),
  /** Unit of measure of that product, printed next to the quantity. */
  unit: z.string().optional(),
});
export type SalesLine = z.infer<typeof salesLineSchema>;

/**
 * What an invoice froze when it was issued: the client's fiscal data and the
 * totals. Editing the contact, or changing how core rounds, never alters an
 * issued invoice. Set by the server; the app never sends it.
 */
/**
 * Where the invoice's VERI*FACTU record stands with the AEAT: waiting to be
 * sent, accepted (maybe with errors to fix), or rejected.
 */
export const verifactuStatusSchema = z.enum(["pending", "accepted", "acceptedWithErrors", "rejected"]);
export type VerifactuStatus = z.infer<typeof verifactuStatusSchema>;

/** The invoice's VERI*FACTU record, when the business uses the system. */
export const verifactuRecordInfoSchema = z.object({
  status: verifactuStatusSchema,
  /** What the QR code printed on the invoice encodes. */
  qrUrl: z.url(),
  /** The AEAT's error, or why the record couldn't be sent yet. */
  error: z.string().optional(),
});
export type VerifactuRecordInfo = z.infer<typeof verifactuRecordInfoSchema>;

export const issuedSnapshotSchema = z.object({
  client: contactSchema.pick({
    name: true,
    taxId: true,
    address: true,
    postalCode: true,
    city: true,
    province: true,
    country: true,
  }),
  totals: invoiceTotalsSchema,
  verifactu: verifactuRecordInfoSchema.optional(),
});
export type IssuedSnapshot = z.infer<typeof issuedSnapshotSchema>;

export const salesDocumentSchema = z.object({
  id,
  kind: salesKindSchema,
  /** Drafts are numbered in their own series (BOR-); issuing one gives it an invoice number. Null on older drafts. */
  number: z.string().nullable(),
  series: invoiceSeriesSchema,
  /** Empty on drafts and quotes saved without a client. */
  clientId: id.or(z.literal("")),
  issuedOn: isoDate,
  /** Due date for invoices; "valid until" for quotes. */
  dueOn: isoDate.nullable(),
  incomeType: incomeTypeSchema,
  withholding: withholdingKindSchema,
  operationType: operationTypeSchema,
  /** Date of the supply when it differs from the issue date. */
  operationOn: isoDate.nullable(),
  /** VAT cash accounting (criterio de caja). */
  cashBasis: z.boolean(),
  /** Property rental, reported in form 115/180. */
  rental: z.boolean(),
  rentalLocation: rentalLocationSchema.optional(),
  cadastralRef: z.string().optional(),
  /** Invoice a rectifying invoice corrects. */
  rectifiesId: id.optional(),
  lines: z.array(salesLineSchema),
  /** Expenses paid on the client's behalf (suplidos), outside the taxable base. */
  supplies: cents.optional(),
  /** Collection date and method, for invoices marked as paid when created. */
  paidOn: isoDate.optional(),
  paymentMethodId: id.optional(),
  tags: z.array(id).optional(),
  /** Document language and number format; empty means the client's default. */
  language: z.string().optional(),
  numberFormat: z.string().optional(),
  status: salesStatusSchema,
  /** Printed on the document. */
  publicNotes: z.string(),
  /** Only visible in Fiscalia. */
  privateNotes: z.string(),
  /** Supporting files (contracts, delivery proofs…). */
  attachments: z.array(attachmentSchema).optional(),
  /** Issued invoices only. */
  issued: issuedSnapshotSchema.optional(),
});
export type SalesDocument = z.infer<typeof salesDocumentSchema>;

export const noteTemplateSchema = z.object({
  id,
  title: z.string(),
  text: z.string(),
});
export type NoteTemplate = z.infer<typeof noteTemplateSchema>;

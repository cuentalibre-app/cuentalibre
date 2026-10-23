import { z } from "zod";
import { sameSeriesFormat, seriesMaskProblem } from "@cuentalibre/core";
import { attachmentSchema, cents, id, isoDate, paymentSchema, rentalLocationSchema } from "./common";
import { contactSchema } from "./contacts";
import { invoiceLineSchema, invoiceTotalsSchema, operationTypeSchema, withholdingKindSchema } from "./core";

export const salesKindSchema = z.enum(["invoice", "draft", "quote", "deliveryNote"]);
export type SalesKind = z.infer<typeof salesKindSchema>;

/**
 * Stored status. Invoices are paid once their collections cover the total and
 * pending until then ("partial" and "overdue" are derived from the collections
 * and the due date); quotes and delivery notes follow their own workflow.
 */
export const salesStatusSchema = z.enum(["pending", "paid", "created", "sent", "accepted", "rejected", "invoiced"]);
export type SalesStatus = z.infer<typeof salesStatusSchema>;

/** Statuses each kind of document can be in. */
export const SALES_STATUSES_BY_KIND: Record<SalesKind, readonly SalesStatus[]> = {
  invoice: ["pending", "paid"],
  draft: ["pending", "paid"],
  quote: ["created", "sent", "accepted", "rejected", "invoiced"],
  deliveryNote: ["created", "sent", "accepted", "rejected", "invoiced"],
};

export const invoiceSeriesSchema = z.enum(["normal", "rectifying"]);
export type InvoiceSeries = z.infer<typeof invoiceSeriesSchema>;

/**
 * A numbering series of invoices. The mask writes the year as AAAA (or AA)
 * and the counter as a run of # as wide as it is: "AAAA-B-####" → "2026-B-0001".
 */
export const invoiceSeriesDefinitionSchema = z.object({
  id,
  type: invoiceSeriesSchema,
  name: z.string().trim().min(1),
  mask: z.string().refine((mask) => seriesMaskProblem(mask) === null, "Not a valid series mask."),
  /** An inactive series takes no new invoices. Absent means active. */
  active: z.boolean().optional(),
});
export type InvoiceSeriesDefinition = z.infer<typeof invoiceSeriesDefinitionSchema>;

/**
 * Series every organization has; their ids are the series types, and
 * documents without a `seriesId` are numbered in them. They can be renamed,
 * given another mask or deactivated (stored under their id), but not removed.
 */
export const BUILT_IN_INVOICE_SERIES: readonly InvoiceSeriesDefinition[] = [
  { id: "normal", type: "normal", name: "Facturas normales", mask: "AAAA-####" },
  { id: "rectifying", type: "rectifying", name: "Facturas rectificativas", mask: "R-AAAA-####" },
];

export const isBuiltInSeries = (seriesId: string) => BUILT_IN_INVOICE_SERIES.some((s) => s.id === seriesId);

/** Every series of an organization from the stored ones: the built-in series, as changed, then the created ones. */
export function invoiceSeriesList(stored: readonly InvoiceSeriesDefinition[] = []): InvoiceSeriesDefinition[] {
  return [
    ...BUILT_IN_INVOICE_SERIES.map((builtIn) => stored.find((s) => s.id === builtIn.id) ?? builtIn),
    ...stored.filter((s) => !isBuiltInSeries(s.id)),
  ];
}

/** Stored series: ids are unique, built-in ones keep their type, and no two series share a format. */
export const storedInvoiceSeriesSchema = z.array(invoiceSeriesDefinitionSchema).superRefine((list, ctx) => {
  list.forEach((series, i) => {
    if (list.slice(0, i).some((other) => other.id === series.id))
      ctx.addIssue({ code: "custom", path: [i, "id"], message: "Duplicate series id." });
    const builtIn = BUILT_IN_INVOICE_SERIES.find((s) => s.id === series.id);
    if (builtIn && builtIn.type !== series.type)
      ctx.addIssue({ code: "custom", path: [i, "type"], message: "A built-in series keeps its type." });
  });
  const all = invoiceSeriesList(list);
  all.forEach((series, i) => {
    if (all.slice(0, i).some((other) => sameSeriesFormat(other.mask, series.mask)))
      ctx.addIssue({ code: "custom", path: [], message: `Another series already numbers with ${series.mask}.` });
  });
});

/** The series a document is numbered in: its own `seriesId`, or the built-in one of its type. */
export function invoiceSeriesOf(
  doc: { series: InvoiceSeries; seriesId?: string },
  stored: readonly InvoiceSeriesDefinition[] = [],
): InvoiceSeriesDefinition | undefined {
  return invoiceSeriesList(stored).find((series) => series.id === (doc.seriesId ?? doc.series));
}

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
  /** Custom series (`invoiceSettings.series`) of an invoice or draft; absent means the built-in series of `series`. */
  seriesId: id.optional(),
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
  /** Collections of an invoice, oldest first. A rectifying invoice's refunds are negative. */
  payments: z.array(paymentSchema).optional(),
  tags: z.array(id).optional(),
  /** Document language and number format; empty means the client's default. */
  language: z.string().optional(),
  numberFormat: z.string().optional(),
  status: salesStatusSchema,
  /** Printed on the document. */
  publicNotes: z.string(),
  /** Only visible in cuentalibre. */
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

import { z } from "zod";
import { attachmentSchema, cents, id, isoDate, percentage, rentalLocationSchema } from "./common";
import { amortizationPlanSchema, purchaseOperationTypeSchema, withholdingKindSchema } from "./core";
import { salesLineSchema } from "./sales";

/** Expense account in the Spanish chart of accounts (PGC), group 6. */
export const expenseTypeSchema = z.enum([
  "600",
  "602",
  "607",
  "621",
  "622",
  "623",
  "6231",
  "624",
  "625",
  "626",
  "627",
  "628",
  "629",
  "6291",
  "6292",
  "6293",
  "6294",
  "6295",
  "6297",
  "631",
  "640",
  "641",
  "642",
  "6421",
  "6422",
  "649",
  "660",
  "662",
  "663",
  "680",
  "681",
  "682",
]);
export type ExpenseType = z.infer<typeof expenseTypeSchema>;

export const purchaseLineSchema = salesLineSchema;
export type PurchaseLine = z.infer<typeof purchaseLineSchema>;

export const paymentSchema = z.object({
  id,
  date: isoDate,
  /** A credit note has negative payments (refunds). */
  amount: cents,
  paymentMethodId: id,
});
export type Payment = z.infer<typeof paymentSchema>;

/** What turns a received invoice into an investment good: how it is amortized. */
export const investmentAssetSchema = amortizationPlanSchema.extend({
  /** Licence plate or cadastral reference, for vehicles and real estate. */
  identifier: z.string().optional(),
});
export type InvestmentAsset = z.infer<typeof investmentAssetSchema>;

export const purchaseInvoiceSchema = z.object({
  id,
  supplierId: id,
  /** The supplier's own number. */
  number: z.string(),
  /** Issue date printed on the invoice. */
  issuedOn: isoDate,
  /** Date it is booked on, which decides its quarter; later than `issuedOn` when it arrives late. */
  bookedOn: isoDate,
  dueOn: isoDate.nullable(),
  expenseType: expenseTypeSchema,
  /** Share that counts as an expense. */
  imputation: percentage,
  /** Share of VAT that can be deducted; null means the same as `imputation`. */
  vatImputation: percentage.nullable(),
  withholding: withholdingKindSchema,
  operationType: purchaseOperationTypeSchema,
  /** Date of the supply when it differs from the issue date. */
  operationOn: isoDate.nullable(),
  /** Customs document (DUA, or H7 under 150 €) of an import. */
  customsDocument: z.string().optional(),
  /** The supplier applies VAT cash accounting (criterio de caja). */
  cashBasis: z.boolean(),
  /** Property rental, reported in forms 115/180. */
  rental: z.boolean(),
  rentalLocation: rentalLocationSchema.optional(),
  cadastralRef: z.string().optional(),
  /** Invoice a credit note corrects. */
  rectifiesId: id.optional(),
  lines: z.array(purchaseLineSchema),
  payments: z.array(paymentSchema),
  privateNotes: z.string(),
  tags: z.array(id).optional(),
  attachments: z.array(attachmentSchema).optional(),
  /** Investment good: amortized over the years instead of an expense the day it is bought. */
  asset: investmentAssetSchema.optional(),
});
export type PurchaseInvoice = z.infer<typeof purchaseInvoiceSchema>;

export const expensePaymentSchema = z.object({
  date: isoDate,
  paymentMethodId: id,
});
export type ExpensePayment = z.infer<typeof expensePaymentSchema>;

/** Who was paid when they are not a saved supplier: the social security, a town hall, a car park… */
export const otherPayeeSchema = z.object({
  name: z.string().min(1),
  /** NIF; may be empty for a ticket without one. */
  taxId: z.string(),
});
export type OtherPayee = z.infer<typeof otherPayeeSchema>;

export const expenseSchema = z.object({
  id,
  /** Decides the quarter. */
  date: isoDate,
  /** Receipt or reference number; empty when there is none. */
  number: z.string(),
  concept: z.string(),
  /** Taxes included: without an invoice no VAT can be deducted. */
  amount: cents,
  expenseType: expenseTypeSchema,
  /** Share that counts as an expense. */
  imputation: percentage,
  supplierId: id.nullable(),
  otherPayee: otherPayeeSchema.optional(),
  /** Expenses are paid in one go; null while pending. */
  payment: expensePaymentSchema.nullable(),
  /** Property rental, reported in forms 115/180. */
  rental: z.boolean(),
  rentalLocation: rentalLocationSchema.optional(),
  cadastralRef: z.string().optional(),
  privateNotes: z.string(),
  tags: z.array(id).optional(),
  attachments: z.array(attachmentSchema).optional(),
});
export type Expense = z.infer<typeof expenseSchema>;

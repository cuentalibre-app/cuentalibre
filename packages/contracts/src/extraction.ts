import { z } from "zod";
import { cents, fraction, id, isoDate } from "./common";

/*
 * Reading a received invoice or receipt with an AI model. The server returns a
 * draft for the purchase form; nothing is saved until the user reviews it.
 */

/** One VAT rate of the document, with the equivalence surcharge that goes with it, if any. */
export const extractedVatLineSchema = z.object({
  rate: fraction,
  base: cents,
  vat: cents,
  /** 0 when the document carries no equivalence surcharge. */
  surchargeRate: fraction,
  surcharge: cents,
});
export type ExtractedVatLine = z.infer<typeof extractedVatLineSchema>;

export const extractedPurchaseSchema = z.object({
  /** "invoice" names the supplier and breaks VAT down; "ticket" is a simplified invoice or a plain receipt. */
  kind: z.enum(["invoice", "ticket"]),
  /** Unknown fields are empty. `country` is a Spanish name, as in contacts ("España", "Francia"…). */
  supplier: z.object({
    name: z.string(),
    taxId: z.string(),
    address: z.string(),
    postalCode: z.string(),
    city: z.string(),
    country: z.string(),
  }),
  /** The supplier's own number; empty when it has none. */
  number: z.string(),
  issuedOn: isoDate.nullable(),
  dueOn: isoDate.nullable(),
  /** A short description of what was bought. */
  concept: z.string(),
  /** ISO 4217 code; anything but EUR is flagged. */
  currency: z.string(),
  vatBreakdown: z.array(extractedVatLineSchema),
  withholding: z.object({ rate: fraction, amount: cents }).nullable(),
  /** What was paid or is owed, taxes included. */
  total: cents.nullable(),
});
export type ExtractedPurchase = z.infer<typeof extractedPurchaseSchema>;

/**
 * Why a field deserves a second look. `missing`: the document doesn't seem to have it.
 * `invalid`: it has an impossible value (a tax ID with a wrong check digit, a VAT rate
 * Spain doesn't use, a date that doesn't exist). `mismatch`: the amounts don't add up.
 */
export const extractionIssueCodeSchema = z.enum(["missing", "invalid", "mismatch"]);
export type ExtractionIssueCode = z.infer<typeof extractionIssueCodeSchema>;

export const extractionIssueSchema = z.object({
  /** Path in the draft, such as `supplier.taxId`, `vatBreakdown.0.vat` or `total`. */
  field: z.string(),
  code: extractionIssueCodeSchema,
});
export type ExtractionIssue = z.infer<typeof extractionIssueSchema>;

export const extractionRequestSchema = z.object({
  /** A PDF or a photo uploaded with `POST /v1/files`. */
  fileId: z.uuid(),
});
export type ExtractionRequest = z.infer<typeof extractionRequestSchema>;

export const purchaseExtractionSchema = z.object({
  draft: extractedPurchaseSchema,
  /** The saved supplier with the draft's tax ID, if there is one. */
  supplierId: id.nullable(),
  /** Fields that don't add up: flagged, not corrected. */
  issues: z.array(extractionIssueSchema),
  /** What the model read: the PDF's text layer, or the page itself as an image or document. */
  source: z.enum(["text", "image", "pdf"]),
});
export type PurchaseExtraction = z.infer<typeof purchaseExtractionSchema>;

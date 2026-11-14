import { z } from "zod";
import { attachmentSchema, id } from "./common";
import { withholdingKindSchema } from "./core";

export const contactRoleSchema = z.enum(["client", "supplier"]);
export type ContactRole = z.infer<typeof contactRoleSchema>;

export const bankAccountSchema = z.object({
  id,
  /** Without spaces. */
  iban: z.string().regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/),
  bic: z.string().optional(),
  notes: z.string().optional(),
  /** The account used for direct debits and printed on documents. */
  isDefault: z.boolean(),
});
export type BankAccount = z.infer<typeof bankAccountSchema>;

/** Codes of the public body that receives an electronic invoice through FACe (DIR3). */
export const eInvoiceCodesSchema = z.object({
  accountingOffice: z.string().optional(),
  managementBody: z.string().optional(),
  processingUnit: z.string().optional(),
  proposingBody: z.string().optional(),
});
export type EInvoiceCodes = z.infer<typeof eInvoiceCodesSchema>;

export const contactSchema = z.object({
  id,
  /** Name or company name. */
  name: z.string().min(1),
  /** NIF, or VAT number for EU contacts. Required unless `variousClients`. */
  taxId: z.string(),
  /**
   * Clients only: the "Clientes varios" client that groups sales to
   * unidentified clients. The only contact that may have no tax ID.
   */
  variousClients: z.boolean().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  /** Town (población). */
  city: z.string().optional(),
  province: z.string().optional(),
  /** Spanish name of the country, as in COUNTRIES; Spain when missing. */
  country: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  fax: z.string().optional(),
  website: z.string().optional(),
  /** Registered in the EU VAT information exchange system (VIES), for intra-EU operations. */
  vies: z.boolean().optional(),
  /** Default discount on document lines, as a whole percentage. */
  discount: z.number().min(0).max(100).optional(),
  /** Income-tax withholding applied by default on their documents. */
  withholding: withholdingKindSchema.optional(),
  paymentMethodId: id.optional(),
  /** Clients only: default language and number format of documents; empty uses the document's own. */
  language: z.string().optional(),
  numberFormat: z.string().optional(),
  bankAccounts: z.array(bankAccountSchema).optional(),
  eInvoice: eInvoiceCodesSchema.optional(),
  /** Free fields, named in the contacts settings. */
  custom1: z.string().optional(),
  custom2: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(id).optional(),
  attachments: z.array(attachmentSchema).optional(),
});
export type Contact = z.infer<typeof contactSchema>;

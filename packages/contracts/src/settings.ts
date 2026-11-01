import { z } from "zod";
import { cents, fraction, hexColor, id, isoDate, localDateTime } from "./common";
import { filedFormSchema, withholdingKindSchema } from "./core";

export const businessKindSchema = z.enum(["selfEmployed", "company"]);
export type BusinessKind = z.infer<typeof businessKindSchema>;

export const businessProfileSchema = z.object({
  kind: businessKindSchema,
  taxId: z.string(),
  /** Self-employed: first name and surnames. Companies use `legalName` instead. */
  firstName: z.string(),
  lastName: z.string(),
  secondLastName: z.string(),
  legalName: z.string(),
  /** Name printed on invoices; empty falls back to the full name or legal name. */
  tradeName: z.string(),
  address: z.string(),
  postalCode: z.string(),
  city: z.string(),
  province: z.string(),
  country: z.string(),
  email: z.string(),
  phone: z.string(),
  website: z.string(),
});
export type BusinessProfile = z.infer<typeof businessProfileSchema>;

export const fiscalRegionSchema = z.enum([
  "peninsula",
  "canarias",
  "ceutaMelilla",
  "navarra",
  "alava",
  "vizcaya",
  "guipuzcoa",
]);
export type FiscalRegion = z.infer<typeof fiscalRegionSchema>;

export const incomeTaxMethodSchema = z.enum(["simplified", "normal", "modules"]);
export type IncomeTaxMethod = z.infer<typeof incomeTaxMethodSchema>;

export const vatRegimeSchema = z.enum(["general", "cashBasis", "simplified", "surcharge"]);
export type VatRegime = z.infer<typeof vatRegimeSchema>;

export const economicActivitySchema = z.object({
  id,
  /** Activity type of forms 036/037: A01…A05, B01…B06 or C. */
  type: z.string(),
  /** IAE epígrafe ("763"); empty for activities outside the IAE. */
  code: z.string(),
  name: z.string(),
});
export type EconomicActivity = z.infer<typeof economicActivitySchema>;

export const taxSetupSchema = z.object({
  region: fiscalRegionSchema,
  incomeTaxMethod: incomeTaxMethodSchema,
  vatRegime: vatRegimeSchema,
  /** Ordered by volume: the first one is the main activity. */
  activities: z.array(economicActivitySchema),
  /** VAT rate proposed on new invoice lines. */
  defaultVatRate: fraction,
  /** IRPF withholding proposed on new invoices; a client's own default wins. */
  defaultWithholding: withholdingKindSchema,
  /** Monthly self-employed fee (RETA). */
  socialSecurityFee: cents,
  /** Client that groups sales to unidentified customers ("Clientes varios"). */
  variousClientsId: id.nullable(),
});
export type TaxSetup = z.infer<typeof taxSetupSchema>;

export const paymentMethodTypeSchema = z.enum(["cash", "card", "transfer", "directDebit", "promissory", "paypal"]);
export type PaymentMethodType = z.infer<typeof paymentMethodTypeSchema>;

export const paymentMethodSchema = z.object({
  id,
  type: paymentMethodTypeSchema,
  name: z.string().min(1),
  /** IBAN, card number or PayPal email the money goes through; may hold only the last four digits. */
  number: z.string(),
  active: z.boolean(),
});
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const tagSchema = z.object({
  id,
  name: z.string().min(1),
  /** Background color chosen by the user. */
  color: hexColor,
});
export type Tag = z.infer<typeof tagSchema>;

/** Period key of a quarter, "2026-T2". */
export const quarterKeySchema = z.string().regex(/^\d{4}-T[1-4]$/);

/** A closed quarter: its books are frozen until it is reopened. */
export const closedQuarterSchema = z.object({
  period: quarterKeySchema,
  closedOn: isoDate,
});
export type ClosedQuarter = z.infer<typeof closedQuarterSchema>;

/**
 * A return as it was filed, stored when its quarter is closed: later returns
 * start from it (form 130 subtracts the installments filed, form 303 offsets
 * what was left pending) and it stays as the record of what was declared.
 * Never changed: closing the quarter again after reopening it stores a new
 * version, and the latest one counts.
 */
export const filedReturnSchema = z.object({
  id,
  form: filedFormSchema,
  period: quarterKeySchema,
  /** Box number ("07", "110") to its value: cents, or a percentage for rate boxes. */
  boxes: z.record(z.string().regex(/^\d{2,4}$/), z.number()),
  /** The amount to pay (positive) or to offset or refund (negative). */
  result: cents,
  filedOn: isoDate,
});
export type FiledReturn = z.infer<typeof filedReturnSchema>;

export const ledgerAccountKeySchema = z.enum([
  "customers",
  "suppliers",
  "assetSuppliers",
  "creditors",
  "sales",
  "purchases",
  "outputVat",
  "inputVat",
  "salesWithholding",
  "purchasesWithholding",
  "cash",
  "bank",
  "nonDeductible",
]);
export type LedgerAccountKey = z.infer<typeof ledgerAccountKeySchema>;

export const ledgerAccountSettingsSchema = z.object({
  /** Company code in the accounting program the books are transferred to. */
  companyCode: z.string(),
  /** Length of every account number. */
  digits: z.int().min(6).max(12),
  prefixes: z.record(ledgerAccountKeySchema, z.string()),
  /** Code after the prefix used when a contact or method has none of its own. */
  defaults: z.record(ledgerAccountKeySchema, z.string()),
  /** Own codes by contact id; empty means the default. */
  contactCodes: z.record(id, z.string()),
  /** Own codes by payment method id. */
  methodCodes: z.record(id, z.string()),
});
export type LedgerAccountSettings = z.infer<typeof ledgerAccountSettingsSchema>;

export const invoicingSystemSchema = z.enum(["verifactu", "exempt"]);
export type InvoicingSystem = z.infer<typeof invoicingSystemSchema>;

export const verifactuSetupSchema = z.object({
  system: invoicingSystemSchema,
  /** Date the system applies from. */
  startDate: isoDate,
});
export type VerifactuSetup = z.infer<typeof verifactuSetupSchema>;

/**
 * What the AEAT's census answered about the issuer's NIF and name
 * (VNifV2): `identified`; `similar` when the name differs slightly from the
 * census's; `notIdentified`; or, for companies, `deregistered` and `revoked`
 * when the NIF is no longer active.
 */
export const taxIdCheckResultSchema = z.enum(["identified", "similar", "notIdentified", "deregistered", "revoked"]);
export type TaxIdCheckResult = z.infer<typeof taxIdCheckResultSchema>;

/**
 * The last check of the issuer's NIF and name with the AEAT. The server
 * writes it, after VERI*FACTU is switched on or the NIF or name change; it
 * holds the pair it checked, so a check of an earlier pair reads as pending.
 */
export const verifactuCheckSchema = z.object({
  taxId: z.string(),
  name: z.string(),
  /** Null until the AEAT has answered. */
  result: taxIdCheckResultSchema.nullable(),
  /** The name the census holds for the NIF, when the AEAT gives it. */
  censusName: z.string(),
  checkedAt: z.iso.datetime().nullable(),
});
export type VerifactuCheck = z.infer<typeof verifactuCheckSchema>;

/** People who work in the company, or an outside advisor (gestoría) who keeps its books. */
export const userKindSchema = z.enum(["member", "advisor"]);
export type UserKind = z.infer<typeof userKindSchema>;

export const userRoleSchema = z.enum(["admin", "standard", "readOnly"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const companyUserSchema = z.object({
  id,
  kind: userKindSchema,
  name: z.string(),
  email: z.email(),
  role: userRoleSchema,
  /** Access can be switched off without removing the user. */
  enabled: z.boolean(),
  /** Invited users haven't accepted yet and have never signed in. */
  invited: z.boolean(),
  lastAccessAt: localDateTime.nullable(),
  /** Last day with access; null never expires. */
  expiresOn: isoDate.nullable(),
  /** Who created the company: always an enabled admin, can't be removed. */
  owner: z.boolean().optional(),
});
export type CompanyUser = z.infer<typeof companyUserSchema>;

/*
 * Schemas for the types that core owns. Core stays free of dependencies, so its
 * types are declared there by hand and mirrored here; the assertions at the end
 * fail to compile if the two ever drift apart.
 */
import {
  ASSET_CATEGORIES,
  CATALOG_UNITS,
  WITHHOLDING_RATES,
  type AmortizationPlan,
  type CatalogFamily,
  type CatalogUnit,
  type FiledForm,
  type InvoiceLine,
  type InvoiceTotals,
  type OperationType,
  type PurchaseOperationType,
  type StockMovement,
  type StockRules,
  type TimeEntry,
  type WithholdingKind,
} from "@fiscalia/core";
import { z } from "zod";
import { cents, fraction, id, localDateTime } from "./common";

const keysOf = <K extends string>(record: Record<K, unknown>) => Object.keys(record) as [K, ...K[]];

export const withholdingKindSchema = z.enum(keysOf(WITHHOLDING_RATES));

/** Forms whose filed boxes later returns start from. */
export const filedFormSchema = z.enum(["303", "130"]);

export const operationTypeSchema = z.enum(["national", "exempt", "notSubject", "reverseCharge", "intraEu", "export"]);

export const purchaseOperationTypeSchema = z.enum([
  "national",
  "exempt",
  "notSubject",
  "reverseCharge",
  "intraEu",
  "import",
]);

export const invoiceLineSchema = z.object({
  /** In euros, with any number of decimals (see money.ts in core). */
  unitPrice: z.number(),
  quantity: z.number(),
  discount: fraction,
  vatRate: fraction,
  surchargeRate: fraction.optional(),
});

export const invoiceTotalsSchema = z.object({
  base: cents,
  vat: cents,
  surcharge: cents,
  withholding: cents,
  supplies: cents,
  total: cents,
  vatBreakdown: z.array(z.object({ rate: fraction, base: cents, vat: cents })),
});

export const amortizationPlanSchema = z.object({
  category: z.enum(keysOf(ASSET_CATEGORIES)),
  condition: z.enum(["new", "used", "accelerated", "lowValue", "free"]),
  method: z.enum(["rate", "years"]),
  /** Yearly percentage (method "rate") or number of years (method "years"). */
  value: z.number().positive(),
});

export const catalogUnitSchema = z.enum(CATALOG_UNITS.map(([code]) => code) as [CatalogUnit, ...CatalogUnit[]]);

export const catalogFamilySchema = z.object({
  id,
  name: z.string().min(1),
  parentId: id.nullable(),
});

export const stockMovementSchema = z.object({
  id,
  productId: id,
  quantity: z.number(),
  at: localDateTime,
  kind: z.enum(["invoice", "deliveryNote", "initial", "import", "settings", "deleted", "manual"]),
  reason: z.enum(["loss", "found", "purchase", "sale", "supplierReturn", "settings", "undefined"]).optional(),
  comments: z.string().optional(),
  documentId: id.optional(),
});

export const stockRulesSchema = z.object({
  invoices: z.enum(["never", "createEdit"]),
  deliveryNotes: z.enum(["never", "createEdit", "invoice"]),
  quotes: z.enum(["never", "deliveryNote", "invoice"]),
  drafts: z.enum(["never", "invoice"]),
});

export const timeEntrySchema = z.object({
  id,
  workerId: id,
  start: localDateTime,
  end: localDateTime.nullable(),
  comment: z.string(),
});

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Mirrors<Schema extends z.ZodType, Type> = Equal<z.infer<Schema>, Type>;
type Assert<T extends true> = T;

/** Fails to compile, on the offending line, when a schema no longer matches its core type. */
export type CoreTypesMatch = [
  Assert<Mirrors<typeof withholdingKindSchema, WithholdingKind>>,
  Assert<Mirrors<typeof filedFormSchema, FiledForm>>,
  Assert<Mirrors<typeof operationTypeSchema, OperationType>>,
  Assert<Mirrors<typeof purchaseOperationTypeSchema, PurchaseOperationType>>,
  Assert<Mirrors<typeof invoiceLineSchema, InvoiceLine>>,
  Assert<Mirrors<typeof invoiceTotalsSchema, InvoiceTotals>>,
  Assert<Mirrors<typeof amortizationPlanSchema, AmortizationPlan>>,
  Assert<Mirrors<typeof catalogUnitSchema, CatalogUnit>>,
  Assert<Mirrors<typeof catalogFamilySchema, CatalogFamily>>,
  Assert<Mirrors<typeof stockMovementSchema, StockMovement>>,
  Assert<Mirrors<typeof stockRulesSchema, StockRules>>,
  Assert<Mirrors<typeof timeEntrySchema, TimeEntry>>,
];

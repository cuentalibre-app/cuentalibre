import { z } from "zod";
import { fraction, id } from "./common";
import { catalogUnitSchema, stockRulesSchema } from "./core";

export const stockAlarmSettingsSchema = z.object({
  /** Warn when fewer units than this are left. */
  minUnits: z.number().nonnegative(),
  /** List the product on the home page. */
  dashboard: z.boolean(),
  notification: z.boolean(),
  email: z.boolean(),
});
export type StockAlarmSettings = z.infer<typeof stockAlarmSettingsSchema>;

export const stockControlSchema = z.object({
  allowWithoutStock: z.boolean(),
  /** Null when the alarm is off. */
  alarm: stockAlarmSettingsSchema.nullable(),
});
export type StockControl = z.infer<typeof stockControlSchema>;

const customFields = z.tuple([z.string(), z.string(), z.string(), z.string()]);

export const productSchema = z.object({
  id,
  familyId: id.nullable(),
  name: z.string().min(1),
  /** Printed on documents when the settings ask for it. */
  description: z.string(),
  /** Only visible in Fiscalia. */
  privateNotes: z.string(),
  unit: catalogUnitSchema.nullable(),
  tags: z.array(id),
  /** Inactive products stay in the catalog but can't be picked in documents. */
  active: z.boolean(),
  /** Own product code (SKU), unique in the catalog. */
  sku: z.string(),
  supplierRef: z.string(),
  /** Unit sale price in euros, before discount and taxes. */
  price: z.number(),
  discount: fraction,
  vatRate: fraction,
  surchargeRate: fraction,
  /** Unit acquisition cost in euros before taxes, with transport and customs; null when unknown. */
  cost: z.number().nullable(),
  costVatRate: fraction,
  costSurchargeRate: fraction,
  custom: customFields,
  /** Null when its stock isn't counted. */
  stock: stockControlSchema.nullable(),
});
export type Product = z.infer<typeof productSchema>;

export const catalogSettingsSchema = z.object({
  customFieldNames: customFields,
  /** What a document's concept gets when a product is picked. */
  conceptText: z.enum(["name", "codeAndName"]),
  /** Copy the product description into the concept's detailed description. */
  copyDescription: z.boolean(),
  /** Where stock alarms are emailed. */
  alarmEmail: z.string(),
  rules: stockRulesSchema,
  /** Put the stock back when an invoice or delivery note that took it is deleted. */
  restoreOnDeleteInvoice: z.boolean(),
  restoreOnDeleteDeliveryNote: z.boolean(),
  /** Stock options a new product starts with, and imports fall back to. */
  defaults: stockControlSchema.extend({ enabled: z.boolean(), alarmOn: z.boolean() }),
});
export type CatalogSettings = z.infer<typeof catalogSettingsSchema>;

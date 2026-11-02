import { z } from "zod";
import { productSchema } from "./catalog";
import { attachmentSchema, isoDate, paymentSchema } from "./common";
import { contactRoleSchema, contactSchema } from "./contacts";
import { catalogFamilySchema, stockMovementSchema } from "./core";
import { organizationSettingsSchema, settingsSectionSchema } from "./organization-settings";
import { expenseSchema, purchaseInvoiceSchema, purchaseLineSchema } from "./purchases";
import { issuedSnapshotSchema, salesDocumentSchema, salesLineSchema } from "./sales";
import {
  closedQuarterSchema,
  filedReturnSchema,
  paymentMethodSchema,
  quarterKeySchema,
  tagSchema,
  clientTaxIdCheckSchema,
} from "./settings";
import { manualPaymentSchema } from "./treasury";

/*
 * What the web app and the API exchange to keep the client's copy of the data
 * in step with the server: the workspace downloaded at boot, the commands that
 * change it, and the feed of changes since a cursor.
 */

/** Collections the server stores so far, named like the client's collections. */
export const syncedEntitySchema = z.enum([
  "clients",
  "suppliers",
  "salesDocuments",
  "purchaseInvoices",
  "expenses",
  "closedQuarters",
  "filedReturns",
  "tags",
  "paymentMethods",
  "manualPayments",
  "catalogFamilies",
  "products",
  "stockMovements",
  "taxIdChecks",
]);
export type SyncedEntity = z.infer<typeof syncedEntitySchema>;

export const contactEntitySchema = z.enum(["clients", "suppliers"]);
export type ContactEntity = z.infer<typeof contactEntitySchema>;

export const ENTITY_ROLES = { clients: "client", suppliers: "supplier" } as const satisfies Record<
  ContactEntity,
  z.infer<typeof contactRoleSchema>
>;

/** Records whose entity the client may create, update and delete. */
export const recordEntitySchema = syncedEntitySchema.exclude(["closedQuarters", "filedReturns", "taxIdChecks"]);
export type RecordEntity = z.infer<typeof recordEntitySchema>;

/**
 * An attachment as the server stores it: its ID is the uploaded file's
 * (`POST /v1/files`). The browser's object URL is dropped.
 */
export const storedAttachmentSchema = attachmentSchema.omit({ url: true }).extend({ id: z.uuid() });
const storedAttachments = z.array(storedAttachmentSchema).max(100).optional();

/** A record as the server stores it: IDs are UUIDs, created on the client. */
export const storedContactSchema = contactSchema.extend({ id: z.uuid(), attachments: storedAttachments });

export const storedSalesDocumentSchema = salesDocumentSchema.extend({
  id: z.uuid(),
  clientId: z.uuid().or(z.literal("")),
  rectifiesId: z.uuid().optional(),
  seriesId: z.uuid().optional(),
  lines: z.array(salesLineSchema).max(1000),
  payments: z.array(paymentSchema).max(1000).optional(),
  attachments: storedAttachments,
});

export const storedPurchaseInvoiceSchema = purchaseInvoiceSchema.extend({
  id: z.uuid(),
  supplierId: z.uuid(),
  rectifiesId: z.uuid().optional(),
  lines: z.array(purchaseLineSchema).max(1000),
  payments: z.array(paymentSchema).max(1000),
  attachments: storedAttachments,
});

export const storedExpenseSchema = expenseSchema.extend({
  id: z.uuid(),
  supplierId: z.uuid().nullable(),
  attachments: storedAttachments,
});

/*
 * Plain records: no legal effects and no quarter, so the server only checks
 * their shape and that what they name belongs to the organization.
 */

export const storedTagSchema = tagSchema.extend({ id: z.uuid() });

export const storedPaymentMethodSchema = paymentMethodSchema.extend({ id: z.uuid() });

export const storedManualPaymentSchema = manualPaymentSchema.extend({ id: z.uuid(), paymentMethodId: z.uuid() });

export const storedCatalogFamilySchema = catalogFamilySchema.extend({ id: z.uuid(), parentId: z.uuid().nullable() });

export const storedProductSchema = productSchema.extend({ id: z.uuid(), familyId: z.uuid().nullable() });

export const storedStockMovementSchema = stockMovementSchema.extend({
  id: z.uuid(),
  productId: z.uuid(),
  documentId: z.uuid().optional(),
});

export const storedFiledReturnSchema = filedReturnSchema.extend({ id: z.uuid() });

/** Each plain record's schema, by entity. */
export const plainRecordSchemas = {
  tags: storedTagSchema,
  paymentMethods: storedPaymentMethodSchema,
  manualPayments: storedManualPaymentSchema,
  catalogFamilies: storedCatalogFamilySchema,
  products: storedProductSchema,
  stockMovements: storedStockMovementSchema,
} as const;
export type PlainEntity = keyof typeof plainRecordSchemas;

const plainCreate = <E extends PlainEntity>(entity: E) =>
  z.object({ type: z.literal("create"), entity: z.literal(entity), data: plainRecordSchemas[entity] });
const plainUpsert = <E extends PlainEntity>(entity: E) =>
  z.object({ op: z.literal("upsert"), entity: z.literal(entity), data: plainRecordSchemas[entity] });

/** A settings section as saved: its name and the whole document. */
export const settingsChangeSchema = z.object({ section: settingsSectionSchema, data: z.unknown() });

/** Position in an organization's change feed. 0 is before the first change. */
export const cursorSchema = z.int().nonnegative();

/** Discriminated by `type`, and creates by `entity`, so a wrong command reports only its own problem. */
export const commandSchema = z.discriminatedUnion("type", [
  z.discriminatedUnion("entity", [
    z.object({ type: z.literal("create"), entity: contactEntitySchema, data: storedContactSchema }),
    z.object({
      type: z.literal("create"),
      entity: z.literal("salesDocuments"),
      /** Drafts, quotes and delivery notes. Invoices come into being by issuing them. */
      data: storedSalesDocumentSchema,
    }),
    z.object({ type: z.literal("create"), entity: z.literal("purchaseInvoices"), data: storedPurchaseInvoiceSchema }),
    z.object({ type: z.literal("create"), entity: z.literal("expenses"), data: storedExpenseSchema }),
    plainCreate("tags"),
    plainCreate("paymentMethods"),
    plainCreate("manualPayments"),
    plainCreate("catalogFamilies"),
    plainCreate("products"),
    plainCreate("stockMovements"),
  ]),
  z.object({
    type: z.literal("update"),
    entity: recordEntitySchema,
    id: z.uuid(),
    /** Fields to change. `null` clears an optional field. */
    changes: z.record(z.string(), z.unknown()),
  }),
  z.object({ type: z.literal("delete"), entity: recordEntitySchema, id: z.uuid() }),
  z.object({
    type: z.literal("issue"),
    /**
     * The invoice to issue: a new one, or a draft with the same ID. The server
     * gives it the next number of its series and freezes its client data and
     * totals; from then on it can't be edited or deleted.
     */
    data: storedSalesDocumentSchema,
    /** Only for invoices issued elsewhere and imported: keep this number instead of taking the next one. */
    number: z.string().trim().min(1).optional(),
  }),
  /**
   * Corrects the VERI*FACTU record of an issued invoice that the AEAT
   * rejected or accepted with errors (subsanación): `client` is the client's
   * fiscal data as it should have been, which the invoice takes. A new record
   * is made and sent; the invoice's number, date and amounts stay, since
   * changing those takes a rectifying invoice.
   */
  z.object({ type: z.literal("correctRecord"), id: z.uuid(), client: issuedSnapshotSchema.shape.client }),
  /**
   * Freezes the books of a quarter: its invoices can't be issued or changed
   * until it is reopened. `returns` are the quarter's returns as filed.
   */
  z.object({
    type: z.literal("closeQuarter"),
    period: quarterKeySchema,
    closedOn: isoDate,
    returns: z.array(storedFiledReturnSchema).max(10).optional(),
  }),
  z.object({ type: z.literal("reopenQuarter"), period: quarterKeySchema }),
  /** Replaces a section of the organization's settings; `data` is the whole section. */
  z.object({ type: z.literal("saveSettings"), section: settingsSectionSchema, data: z.unknown() }),
]);
export type SyncCommand = z.infer<typeof commandSchema>;

/** The latest state of a record that changed: its data, or that it was deleted. */
export const changeSchema = z.union([
  z.object({ op: z.literal("upsert"), entity: contactEntitySchema, data: storedContactSchema }),
  z.object({ op: z.literal("upsert"), entity: z.literal("salesDocuments"), data: storedSalesDocumentSchema }),
  z.object({ op: z.literal("upsert"), entity: z.literal("purchaseInvoices"), data: storedPurchaseInvoiceSchema }),
  z.object({ op: z.literal("upsert"), entity: z.literal("expenses"), data: storedExpenseSchema }),
  z.object({ op: z.literal("upsert"), entity: z.literal("closedQuarters"), data: closedQuarterSchema }),
  z.object({ op: z.literal("upsert"), entity: z.literal("filedReturns"), data: storedFiledReturnSchema }),
  plainUpsert("tags"),
  plainUpsert("paymentMethods"),
  plainUpsert("manualPayments"),
  plainUpsert("catalogFamilies"),
  plainUpsert("products"),
  plainUpsert("stockMovements"),
  z.object({ op: z.literal("upsert"), entity: z.literal("settings"), data: settingsChangeSchema }),
  z.object({ op: z.literal("upsert"), entity: z.literal("taxIdChecks"), data: clientTaxIdCheckSchema }),
  z.object({
    op: z.literal("delete"),
    entity: syncedEntitySchema,
    /** The record's ID; for closed quarters, the period that was reopened. */
    id: z.string(),
  }),
]);
export type Change = z.infer<typeof changeSchema>;

export const workspaceSchema = z.object({
  /** Pass it to the change feed to get what changed after this snapshot. */
  cursor: cursorSchema,
  clients: z.array(storedContactSchema),
  suppliers: z.array(storedContactSchema),
  salesDocuments: z.array(storedSalesDocumentSchema),
  purchaseInvoices: z.array(storedPurchaseInvoiceSchema),
  expenses: z.array(storedExpenseSchema),
  closedQuarters: z.array(closedQuarterSchema),
  /** Every version, oldest first. */
  filedReturns: z.array(storedFiledReturnSchema),
  tags: z.array(storedTagSchema),
  paymentMethods: z.array(storedPaymentMethodSchema),
  manualPayments: z.array(storedManualPaymentSchema),
  catalogFamilies: z.array(storedCatalogFamilySchema),
  products: z.array(storedProductSchema),
  stockMovements: z.array(storedStockMovementSchema),
  /** Written by the server only: what the AEAT's census answered about clients' NIFs. */
  taxIdChecks: z.array(clientTaxIdCheckSchema),
  /** Every section, the ones never saved with their defaults. */
  settings: organizationSettingsSchema,
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const changesSchema = z.object({
  cursor: cursorSchema,
  changes: z.array(changeSchema),
  /** There are more changes after `cursor`: ask again with it. */
  hasMore: z.boolean(),
});
export type Changes = z.infer<typeof changesSchema>;

/** A file uploaded to `POST /v1/files`, which attachments name by its ID. */
export const storedFileSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** Bytes. */
  size: z.int().nonnegative(),
  contentType: z.string(),
});
export type StoredFile = z.infer<typeof storedFileSchema>;

import { z } from "zod";
import { isoDate } from "./common";
import { contactRoleSchema, contactSchema } from "./contacts";
import { salesDocumentSchema, salesLineSchema } from "./sales";
import { closedQuarterSchema } from "./settings";

/*
 * What the web app and the API exchange to keep the client's copy of the data
 * in step with the server: the workspace downloaded at boot, the commands that
 * change it, and the feed of changes since a cursor.
 */

/** Collections the server stores so far, named like the client's collections. */
export const syncedEntitySchema = z.enum(["clients", "suppliers", "salesDocuments", "closedQuarters"]);
export type SyncedEntity = z.infer<typeof syncedEntitySchema>;

export const contactEntitySchema = z.enum(["clients", "suppliers"]);
export type ContactEntity = z.infer<typeof contactEntitySchema>;

export const ENTITY_ROLES = { clients: "client", suppliers: "supplier" } as const satisfies Record<
  ContactEntity,
  z.infer<typeof contactRoleSchema>
>;

/** A record as the server stores it: IDs are UUIDs, created on the client. */
export const storedContactSchema = contactSchema.extend({ id: z.uuid() });

export const storedSalesDocumentSchema = salesDocumentSchema.extend({
  id: z.uuid(),
  clientId: z.uuid().or(z.literal("")),
  rectifiesId: z.uuid().optional(),
  lines: z.array(salesLineSchema).max(1000),
});

/** Position in an organization's change feed. 0 is before the first change. */
export const cursorSchema = z.int().nonnegative();

/** Period key of a quarter, "2026-T2". */
const periodSchema = closedQuarterSchema.shape.period;

export const commandSchema = z.union([
  z.object({ type: z.literal("create"), entity: contactEntitySchema, data: storedContactSchema }),
  z.object({
    type: z.literal("create"),
    entity: z.literal("salesDocuments"),
    /** Drafts, quotes and delivery notes. Invoices come into being by issuing them. */
    data: storedSalesDocumentSchema,
  }),
  z.object({
    type: z.literal("update"),
    entity: z.enum(["clients", "suppliers", "salesDocuments"]),
    id: z.uuid(),
    /** Fields to change. `null` clears an optional field. */
    changes: z.record(z.string(), z.unknown()),
  }),
  z.object({ type: z.literal("delete"), entity: z.enum(["clients", "suppliers", "salesDocuments"]), id: z.uuid() }),
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
  /** Freezes the books of a quarter: its invoices can't be issued or changed until it is reopened. */
  z.object({ type: z.literal("closeQuarter"), period: periodSchema, closedOn: isoDate }),
  z.object({ type: z.literal("reopenQuarter"), period: periodSchema }),
]);
export type SyncCommand = z.infer<typeof commandSchema>;

/** The latest state of a record that changed: its data, or that it was deleted. */
export const changeSchema = z.union([
  z.object({ op: z.literal("upsert"), entity: contactEntitySchema, data: storedContactSchema }),
  z.object({ op: z.literal("upsert"), entity: z.literal("salesDocuments"), data: storedSalesDocumentSchema }),
  z.object({ op: z.literal("upsert"), entity: z.literal("closedQuarters"), data: closedQuarterSchema }),
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
  closedQuarters: z.array(closedQuarterSchema),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const changesSchema = z.object({
  cursor: cursorSchema,
  changes: z.array(changeSchema),
  /** There are more changes after `cursor`: ask again with it. */
  hasMore: z.boolean(),
});
export type Changes = z.infer<typeof changesSchema>;

import { z } from "zod";
import { contactRoleSchema, contactSchema } from "./contacts";

/*
 * What the web app and the API exchange to keep the client's copy of the data
 * in step with the server: the workspace downloaded at boot, the commands that
 * change it, and the feed of changes since a cursor.
 */

/** Collections the server stores so far, named like the client's collections. */
export const syncedEntitySchema = z.enum(["clients", "suppliers"]);
export type SyncedEntity = z.infer<typeof syncedEntitySchema>;

export const ENTITY_ROLES = { clients: "client", suppliers: "supplier" } as const satisfies Record<
  SyncedEntity,
  z.infer<typeof contactRoleSchema>
>;

/** A record as the server stores it: IDs are UUIDs, created on the client. */
export const storedContactSchema = contactSchema.extend({ id: z.uuid() });

/** Position in an organization's change feed. 0 is before the first change. */
export const cursorSchema = z.int().nonnegative();

export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create"), entity: syncedEntitySchema, data: storedContactSchema }),
  z.object({
    type: z.literal("update"),
    entity: syncedEntitySchema,
    id: z.uuid(),
    /** Fields to change. `null` clears an optional field. */
    changes: z.record(z.string(), z.unknown()),
  }),
  z.object({ type: z.literal("delete"), entity: syncedEntitySchema, id: z.uuid() }),
]);
export type SyncCommand = z.infer<typeof commandSchema>;

/** The latest state of a record that changed: its data, or that it was deleted. */
export const changeSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("upsert"), entity: syncedEntitySchema, data: storedContactSchema }),
  z.object({ op: z.literal("delete"), entity: syncedEntitySchema, id: z.uuid() }),
]);
export type Change = z.infer<typeof changeSchema>;

export const workspaceSchema = z.object({
  /** Pass it to the change feed to get what changed after this snapshot. */
  cursor: cursorSchema,
  clients: z.array(storedContactSchema),
  suppliers: z.array(storedContactSchema),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const changesSchema = z.object({
  cursor: cursorSchema,
  changes: z.array(changeSchema),
  /** There are more changes after `cursor`: ask again with it. */
  hasMore: z.boolean(),
});
export type Changes = z.infer<typeof changesSchema>;

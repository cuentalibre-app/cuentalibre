import { storedContactSchema, type ContactRole } from "@fiscalia/contracts";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import { contact } from "../db/schema";
import { ApiError } from "../errors";
import type { Tx } from "../db/client";

export type StoredContact = z.infer<typeof storedContactSchema>;
export type ContactRow = typeof contact.$inferSelect;

const FIELDS = Object.keys(storedContactSchema.shape) as (keyof StoredContact)[];

/** The record as the API returns it: optional fields that are empty are left out. */
export function toContact(row: ContactRow): StoredContact {
  const out: Record<string, unknown> = {};
  for (const field of FIELDS) if (row[field] != null) out[field] = row[field];
  return out as StoredContact;
}

/** Every contact column, so writing a record also clears the fields it no longer has. */
function toColumns(record: StoredContact) {
  return Object.fromEntries(FIELDS.map((field) => [field, record[field] ?? null])) as {
    [K in keyof StoredContact]-?: undefined extends StoredContact[K]
      ? Exclude<StoredContact[K], undefined> | null
      : StoredContact[K];
  };
}

function invalid(error: z.ZodError): never {
  const issue = error.issues[0];
  const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  throw new ApiError(400, "invalid_contact", `${where}${issue?.message ?? "Invalid contact."}`);
}

function notFound(): never {
  throw new ApiError(404, "not_found", "Contact not found.");
}

export async function createContact(tx: Tx, organizationId: string, role: ContactRole, data: StoredContact) {
  const parsed = storedContactSchema.safeParse(data);
  if (!parsed.success) invalid(parsed.error);
  const [row] = await tx
    .insert(contact)
    .values({ ...toColumns(parsed.data), organizationId, role })
    .onConflictDoNothing()
    .returning({ id: contact.id });
  if (!row) throw new ApiError(409, "already_exists", "A record with this ID already exists.");
}

/** Applies the changes over the stored record and validates the result as a whole. */
export async function updateContact(
  tx: Tx,
  organizationId: string,
  role: ContactRole,
  id: string,
  changes: Record<string, unknown>,
) {
  if ("id" in changes && changes.id !== id) throw new ApiError(400, "invalid_contact", "id: can't be changed.");
  const [row] = await tx
    .select()
    .from(contact)
    .where(live(organizationId, role, id))
    .for("update");
  if (!row) notFound();

  const merged: Record<string, unknown> = { ...toContact(row) };
  for (const [field, value] of Object.entries(changes)) {
    if (value === null) delete merged[field];
    else merged[field] = value;
  }
  const parsed = storedContactSchema.safeParse(merged);
  if (!parsed.success) invalid(parsed.error);
  await tx
    .update(contact)
    .set(toColumns(parsed.data))
    .where(live(organizationId, role, id));
}

export async function deleteContact(tx: Tx, organizationId: string, role: ContactRole, id: string) {
  const [row] = await tx
    .update(contact)
    .set({ deletedAt: new Date() })
    .where(live(organizationId, role, id))
    .returning({ id: contact.id });
  if (!row) notFound();
}

/** Contacts of the organization that aren't deleted, oldest first. */
export function liveContacts(tx: Tx, organizationId: string, role?: ContactRole) {
  return tx
    .select()
    .from(contact)
    .where(
      and(
        eq(contact.organizationId, organizationId),
        isNull(contact.deletedAt),
        role ? eq(contact.role, role) : undefined,
      ),
    )
    .orderBy(contact.id);
}

/** Current rows, tombstones included, for the given IDs. */
export function contactsById(tx: Tx, organizationId: string, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return tx
    .select()
    .from(contact)
    .where(and(eq(contact.organizationId, organizationId), inArray(contact.id, ids)));
}

function live(organizationId: string, role: ContactRole, id: string) {
  return and(
    eq(contact.organizationId, organizationId),
    eq(contact.id, id),
    eq(contact.role, role),
    isNull(contact.deletedAt),
  );
}

/** A contact that isn't deleted, of any role. */
export async function findContact(tx: Tx, organizationId: string, id: string) {
  const [row] = await tx
    .select()
    .from(contact)
    .where(and(eq(contact.organizationId, organizationId), eq(contact.id, id), isNull(contact.deletedAt)));
  return row;
}

import { storedContactSchema, type ContactRole } from "@cuentalibre/contracts";
import { contactTaxIdProblem, countryOf, storedTaxId } from "@cuentalibre/core";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import { contact, expense, purchaseInvoice } from "../db/schema";
import { ApiError } from "../errors";
import type { Tx } from "../db/client";

import { checkAttachments } from "./files";
import { alreadyExists } from "./records";

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

const TAX_ID_PROBLEMS = {
  empty: "taxId: required.",
  format: "taxId: not a valid tax ID for the contact's country.",
  checksum: "taxId: the control character is wrong.",
};

/**
 * Checks what parsing can't: a valid tax ID for the contact's country, and
 * the "Clientes varios" mark only on clients. Returns the record with its tax
 * ID normalized, as the web app stores it.
 */
function checked(role: ContactRole, record: StoredContact): StoredContact {
  if (record.variousClients && role !== "client")
    throw new ApiError(400, "invalid_contact", "variousClients: only clients can have it.");
  const problem = contactTaxIdProblem(record);
  if (problem) throw new ApiError(400, "invalid_tax_id", TAX_ID_PROBLEMS[problem]);
  return {
    ...record,
    taxId: storedTaxId(record.taxId, countryOf(record)),
    variousClients: record.variousClients || undefined,
  };
}

function notFound(): never {
  throw new ApiError(404, "not_found", "Contact not found.");
}

export async function createContact(tx: Tx, organizationId: string, role: ContactRole, data: StoredContact) {
  const parsed = storedContactSchema.safeParse(data);
  if (!parsed.success) invalid(parsed.error);
  const record = checked(role, parsed.data);
  await checkAttachments(tx, organizationId, record.attachments);
  const [row] = await tx
    .insert(contact)
    .values({ ...toColumns(record), organizationId, role })
    .onConflictDoNothing()
    .returning({ id: contact.id });
  if (!row) alreadyExists();
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
  const record = checked(role, parsed.data);
  await checkAttachments(tx, organizationId, record.attachments, row.attachments ?? []);
  await tx
    .update(contact)
    .set(toColumns(record))
    .where(live(organizationId, role, id));
}

export async function deleteContact(tx: Tx, organizationId: string, role: ContactRole, id: string) {
  const [row] = await tx
    .select({ id: contact.id })
    .from(contact)
    .where(live(organizationId, role, id))
    .for("update");
  if (!row) notFound();
  if (role === "supplier") {
    const use = await supplierUse(tx, organizationId, id);
    if (use) throw new ApiError(409, "in_use", `Still named by ${use}.`);
  }
  await tx
    .update(contact)
    .set({ deletedAt: new Date() })
    .where(live(organizationId, role, id));
}

/**
 * The first live received invoice or expense that names the supplier. They
 * don't keep a copy of its fiscal data, which the books need.
 */
async function supplierUse(tx: Tx, organizationId: string, id: string) {
  for (const [name, table] of [
    ["purchaseInvoices.supplierId", purchaseInvoice],
    ["expenses.supplierId", expense],
  ] as const) {
    const [found] = await tx
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.organizationId, organizationId), eq(table.supplierId, id), isNull(table.deletedAt)))
      .limit(1);
    if (found) return name;
  }
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

/** A supplier the record names must be one of the organization's suppliers that isn't deleted. */
export async function checkSupplier(tx: Tx, organizationId: string, supplierId: string, code: string) {
  const [row] = await tx
    .select({ id: contact.id })
    .from(contact)
    .where(live(organizationId, "supplier", supplierId));
  if (!row) throw new ApiError(400, code, "supplierId: no such supplier.");
}

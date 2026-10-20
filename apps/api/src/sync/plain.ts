import { plainRecordSchemas, type PlainEntity } from "@fiscalia/contracts";
import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { z } from "zod";
import type { Tx } from "../db/client";
import {
  bankMovement,
  catalogFamily,
  manualPayment,
  paymentMethod,
  product,
  stockMovement,
  tag,
  treasuryAccount,
  type LoggedEntity,
} from "../db/schema";
import { ApiError } from "../errors";
import { alreadyExists, mergeChanges, parseOr } from "./records";

/*
 * Plain records: tags, treasury, catalog. They have no legal effects and no
 * quarter, so storing one only takes checking its shape and that the records
 * it names are the organization's. Each table has a column per field, named
 * like it, and is deleted with a tombstone.
 */

type RecordTable = PgTable & { organizationId: PgColumn; id: PgColumn; deletedAt: PgColumn };

/** A field that names another record of the organization. */
interface Reference {
  field: string;
  table: RecordTable;
  /** Whether a deleted record still counts: a stock movement may follow its product's deletion. */
  orDeleted?: boolean;
}

interface PlainKind {
  table: RecordTable;
  logged: LoggedEntity;
  references?: Reference[];
  /** Further checks on the record about to be stored. */
  check?: (tx: Tx, organizationId: string, record: Record<string, unknown>) => Promise<void>;
  /** Live records that name this one and keep it from being deleted. */
  usedBy?: { entity: PlainEntity; field: string }[];
}

const KINDS: Record<PlainEntity, PlainKind> = {
  tags: { table: tag, logged: "tag" },
  treasuryAccounts: {
    table: treasuryAccount,
    logged: "treasury_account",
    usedBy: [
      { entity: "paymentMethods", field: "accountId" },
      { entity: "bankMovements", field: "accountId" },
    ],
  },
  paymentMethods: {
    table: paymentMethod,
    logged: "payment_method",
    references: [{ field: "accountId", table: treasuryAccount }],
    usedBy: [{ entity: "manualPayments", field: "paymentMethodId" }],
  },
  manualPayments: {
    table: manualPayment,
    logged: "manual_payment",
    references: [{ field: "paymentMethodId", table: paymentMethod }],
  },
  bankMovements: {
    table: bankMovement,
    logged: "bank_movement",
    references: [{ field: "accountId", table: treasuryAccount }],
  },
  catalogFamilies: {
    table: catalogFamily,
    logged: "catalog_family",
    references: [{ field: "parentId", table: catalogFamily }],
    check: checkFamilyTree,
  },
  products: {
    table: product,
    logged: "product",
    references: [{ field: "familyId", table: catalogFamily }],
  },
  stockMovements: {
    table: stockMovement,
    logged: "stock_movement",
    references: [{ field: "productId", table: product, orDeleted: true }],
  },
};

export const PLAIN_ENTITIES = Object.keys(KINDS) as PlainEntity[];

export const loggedAs = (entity: PlainEntity) => KINDS[entity].logged;

const code = (kind: PlainKind) => `invalid_${kind.logged}`;

function notFound(): never {
  throw new ApiError(404, "not_found", "Record not found.");
}

/** The record as the API returns it: empty optional fields are left out, nullable ones stay null. */
function toRecord(entity: PlainEntity, row: Record<string, unknown>) {
  const shape = plainRecordSchemas[entity].shape as Record<string, z.ZodType>;
  const out: Record<string, unknown> = {};
  for (const [field, schema] of Object.entries(shape)) {
    const value = row[field];
    if (value != null) out[field] = value;
    else if (schema.safeParse(null).success) out[field] = null;
  }
  return out;
}

/** Every column, so writing a record also clears the fields it no longer has. */
function toColumns(entity: PlainEntity, record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.keys(plainRecordSchemas[entity].shape).map((field) => [field, record[field] ?? null]),
  );
}

const byId = (table: RecordTable, organizationId: string, id: string) =>
  and(eq(table.organizationId, organizationId), eq(table.id, id));

async function liveRow(tx: Tx, kind: PlainKind, organizationId: string, id: string) {
  const [row] = await tx
    .select()
    .from(kind.table)
    .where(and(byId(kind.table, organizationId, id), isNull(kind.table.deletedAt)))
    .for("update");
  return row as Record<string, unknown> | undefined;
}

/** The records a record names must be the organization's, and not deleted. Unchanged ones are left alone. */
async function checkReferences(
  tx: Tx,
  kind: PlainKind,
  organizationId: string,
  record: Record<string, unknown>,
  current?: Record<string, unknown>,
) {
  for (const reference of kind.references ?? []) {
    const id = record[reference.field];
    if (typeof id !== "string" || id === current?.[reference.field]) continue;
    const conditions: (SQL | undefined)[] = [byId(reference.table, organizationId, id)];
    if (!reference.orDeleted) conditions.push(isNull(reference.table.deletedAt));
    const [found] = await tx
      .select({ id: reference.table.id })
      .from(reference.table)
      .where(and(...conditions));
    if (!found) throw new ApiError(400, code(kind), `${reference.field}: no such record.`);
  }
  await kind.check?.(tx, organizationId, record);
}

/** A family can't be its own ancestor. */
async function checkFamilyTree(tx: Tx, organizationId: string, record: Record<string, unknown>) {
  const seen = new Set([record.id as string]);
  let parentId = record.parentId as string | null;
  while (parentId) {
    if (seen.has(parentId)) throw new ApiError(400, "invalid_catalog_family", "parentId: would make a cycle.");
    seen.add(parentId);
    const [parent] = await tx
      .select({ parentId: catalogFamily.parentId })
      .from(catalogFamily)
      .where(and(eq(catalogFamily.organizationId, organizationId), eq(catalogFamily.id, parentId)));
    parentId = parent?.parentId ?? null;
  }
}

export async function createPlain(tx: Tx, organizationId: string, entity: PlainEntity, data: unknown) {
  const kind = KINDS[entity];
  const record = parseOr(plainRecordSchemas[entity], data, code(kind)) as Record<string, unknown>;
  await checkReferences(tx, kind, organizationId, record);
  const [row] = await tx
    .insert(kind.table)
    .values({ ...toColumns(entity, record), organizationId })
    .onConflictDoNothing()
    .returning({ id: kind.table.id });
  if (!row) alreadyExists();
}

/** Applies the changes over the stored record and validates the result as a whole. */
export async function updatePlain(
  tx: Tx,
  organizationId: string,
  entity: PlainEntity,
  id: string,
  changes: Record<string, unknown>,
) {
  const kind = KINDS[entity];
  if ("id" in changes && changes.id !== id) throw new ApiError(400, code(kind), "id: can't be changed.");
  const row = await liveRow(tx, kind, organizationId, id);
  if (!row) notFound();
  const schema = plainRecordSchemas[entity];
  const current = toRecord(entity, row);
  const record = parseOr(schema, mergeChanges(schema, current, changes), code(kind)) as Record<string, unknown>;
  await checkReferences(tx, kind, organizationId, record, current);
  await tx
    .update(kind.table)
    .set(toColumns(entity, record))
    .where(byId(kind.table, organizationId, id));
}

export async function deletePlain(tx: Tx, organizationId: string, entity: PlainEntity, id: string) {
  const kind = KINDS[entity];
  if (!(await liveRow(tx, kind, organizationId, id))) notFound();
  for (const use of kind.usedBy ?? []) {
    const { table } = KINDS[use.entity];
    const column = (table as unknown as Record<string, PgColumn>)[use.field]!;
    const [found] = await tx
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.organizationId, organizationId), eq(column, id), isNull(table.deletedAt)))
      .limit(1);
    if (found) throw new ApiError(409, "in_use", `Still named by ${use.entity}.${use.field}.`);
  }
  await tx
    .update(kind.table)
    .set({ deletedAt: new Date() })
    .where(byId(kind.table, organizationId, id));
}

/** Records of the organization that aren't deleted, oldest first. */
export async function livePlain(tx: Tx, organizationId: string, entity: PlainEntity) {
  const { table } = KINDS[entity];
  const rows = await tx
    .select()
    .from(table)
    .where(and(eq(table.organizationId, organizationId), isNull(table.deletedAt)))
    .orderBy(table.id);
  return rows.map((row) => toRecord(entity, row as Record<string, unknown>));
}

/** Current state of the given records: their data, or null for the deleted ones. */
export async function plainById(tx: Tx, organizationId: string, entity: PlainEntity, ids: string[]) {
  if (ids.length === 0) return [];
  const { table } = KINDS[entity];
  const rows = (await tx
    .select()
    .from(table)
    .where(and(eq(table.organizationId, organizationId), inArray(table.id, ids)))) as Record<string, unknown>[];
  return rows.map((row) => ({ id: row.id as string, record: row.deletedAt ? null : toRecord(entity, row) }));
}

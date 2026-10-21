import { storedExpenseSchema } from "@cuentalibre/contracts";
import type { Cents } from "@cuentalibre/core";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import type { Tx } from "../db/client";
import { expense } from "../db/schema";
import { ApiError } from "../errors";
import { checkQuarterOpen } from "./closing";
import { checkSupplier } from "./contacts";
import { checkAttachments } from "./files";
import { alreadyExists, mergeChanges, parseOr, touchedFields } from "./records";

export type StoredExpense = z.infer<typeof storedExpenseSchema>;
type ExpenseRow = typeof expense.$inferSelect;

/** What can still change while the expense's quarter is closed: nothing that alters the books. */
const OPEN_WHEN_CLOSED = new Set<string>(["payment", "tags", "attachments", "privateNotes"]);

const parse = (data: unknown): StoredExpense => parseOr(storedExpenseSchema, data, "invalid_expense");

function notFound(): never {
  throw new ApiError(404, "not_found", "Expense not found.");
}

/** The record as the API returns it: optional fields that are empty are left out. */
export function toExpense(row: ExpenseRow): StoredExpense {
  return {
    id: row.id,
    date: row.date,
    number: row.number,
    concept: row.concept,
    amount: row.amount as Cents,
    expenseType: row.expenseType,
    imputation: row.imputation,
    supplierId: row.supplierId,
    ...(row.otherPayee && { otherPayee: row.otherPayee }),
    payment: row.paidOn && row.paymentMethodId ? { date: row.paidOn, paymentMethodId: row.paymentMethodId } : null,
    rental: row.rental,
    ...(row.rentalLocation && { rentalLocation: row.rentalLocation }),
    ...(row.cadastralRef != null && { cadastralRef: row.cadastralRef }),
    privateNotes: row.privateNotes,
    ...(row.tags && { tags: row.tags }),
    ...(row.attachments && { attachments: row.attachments }),
  };
}

/** Every expense column, so writing a record also clears the fields it no longer has. */
function toColumns(record: StoredExpense) {
  return {
    date: record.date,
    number: record.number,
    concept: record.concept,
    amount: record.amount,
    expenseType: record.expenseType,
    imputation: record.imputation,
    supplierId: record.supplierId,
    otherPayee: record.otherPayee ?? null,
    paidOn: record.payment?.date ?? null,
    paymentMethodId: record.payment?.paymentMethodId ?? null,
    rental: record.rental,
    rentalLocation: record.rentalLocation ?? null,
    cadastralRef: record.cadastralRef ?? null,
    privateNotes: record.privateNotes,
    tags: record.tags ?? null,
    attachments: record.attachments ?? null,
  } satisfies Omit<typeof expense.$inferInsert, "organizationId" | "id">;
}

const where = (organizationId: string, id: string) =>
  and(eq(expense.organizationId, organizationId), eq(expense.id, id));

async function liveRow(tx: Tx, organizationId: string, id: string) {
  const [row] = await tx
    .select()
    .from(expense)
    .where(and(where(organizationId, id), isNull(expense.deletedAt)))
    .for("update");
  return row;
}

export async function createExpense(tx: Tx, organizationId: string, data: unknown) {
  const record = parse(data);
  if (record.supplierId) await checkSupplier(tx, organizationId, record.supplierId, "invalid_expense");
  await checkQuarterOpen(tx, organizationId, record.date);
  await checkAttachments(tx, organizationId, record.attachments);
  const [row] = await tx
    .insert(expense)
    .values({ ...toColumns(record), id: record.id, organizationId })
    .onConflictDoNothing()
    .returning({ id: expense.id });
  if (!row) alreadyExists();
}

/**
 * Applies the changes over the stored record and validates the result as a
 * whole. While its quarter is closed, an expense only takes changes to its
 * payment, tags, attachments and private notes; nor can one move into a
 * closed quarter.
 */
export async function updateExpense(tx: Tx, organizationId: string, id: string, changes: Record<string, unknown>) {
  if ("id" in changes && changes.id !== id) throw new ApiError(400, "invalid_expense", "id: can't be changed.");
  const row = await liveRow(tx, organizationId, id);
  if (!row) notFound();
  const current = toExpense(row);
  const record = parse(mergeChanges(storedExpenseSchema, current, changes));

  if (touchedFields<StoredExpense>(current, record, changes).some((field) => !OPEN_WHEN_CLOSED.has(field))) {
    await checkQuarterOpen(tx, organizationId, current.date);
    if (record.date !== current.date) await checkQuarterOpen(tx, organizationId, record.date);
  }
  if (record.supplierId && record.supplierId !== current.supplierId)
    await checkSupplier(tx, organizationId, record.supplierId, "invalid_expense");
  await checkAttachments(tx, organizationId, record.attachments, current.attachments);
  await tx.update(expense).set(toColumns(record)).where(where(organizationId, id));
}

export async function deleteExpense(tx: Tx, organizationId: string, id: string) {
  const row = await liveRow(tx, organizationId, id);
  if (!row) notFound();
  await checkQuarterOpen(tx, organizationId, row.date);
  await tx.update(expense).set({ deletedAt: new Date() }).where(where(organizationId, id));
}

/** Expenses of the organization that aren't deleted, oldest first. */
export async function liveExpenses(tx: Tx, organizationId: string) {
  const rows = await tx
    .select()
    .from(expense)
    .where(and(eq(expense.organizationId, organizationId), isNull(expense.deletedAt)))
    .orderBy(expense.id);
  return rows.map(toExpense);
}

/** Current rows, tombstones included, for the given IDs. */
export function expensesById(tx: Tx, organizationId: string, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return tx
    .select()
    .from(expense)
    .where(and(eq(expense.organizationId, organizationId), inArray(expense.id, ids)));
}

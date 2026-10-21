import { storedPurchaseInvoiceSchema } from "@cuentalibre/contracts";
import type { Cents } from "@cuentalibre/core";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import type { Tx } from "../db/client";
import { purchaseInvoice, purchaseLine, purchasePayment } from "../db/schema";
import { ApiError } from "../errors";
import { checkQuarterOpen } from "./closing";
import { checkSupplier } from "./contacts";
import { checkAttachments } from "./files";
import { alreadyExists, mergeChanges, parseOr, touchedFields } from "./records";
import { LINE_FIELDS } from "./sales";

export type StoredPurchaseInvoice = z.infer<typeof storedPurchaseInvoiceSchema>;
type InvoiceRow = typeof purchaseInvoice.$inferSelect;
type LineRow = typeof purchaseLine.$inferSelect;
type PaymentRow = typeof purchasePayment.$inferSelect;

/** Fields stored as columns of `purchase_invoice`, as the record names them. */
const FIELDS = (Object.keys(storedPurchaseInvoiceSchema.shape) as (keyof StoredPurchaseInvoice)[]).filter(
  (field) => field !== "lines" && field !== "payments",
);

/** What can still change while the invoice's quarter is closed: nothing that alters the books. */
const OPEN_WHEN_CLOSED = new Set<string>(["payments", "tags", "attachments", "privateNotes"]);

const parse = (data: unknown): StoredPurchaseInvoice => parseOr(storedPurchaseInvoiceSchema, data, "invalid_invoice");

function invalid(message: string): never {
  throw new ApiError(400, "invalid_invoice", message);
}

function notFound(): never {
  throw new ApiError(404, "not_found", "Received invoice not found.");
}

/** The record as the API returns it: optional fields that are empty are left out. */
export function toPurchaseInvoice(row: InvoiceRow, lines: LineRow[], payments: PaymentRow[]): StoredPurchaseInvoice {
  const out: Record<string, unknown> = {};
  for (const field of FIELDS) {
    const value = row[field as keyof InvoiceRow];
    if (value != null) out[field] = value;
  }
  // Nullable in the record itself: present even when empty
  out.dueOn = row.dueOn;
  out.vatImputation = row.vatImputation;
  out.operationOn = row.operationOn;
  out.lines = lines.map((line) => {
    const record: Record<string, unknown> = {};
    for (const field of LINE_FIELDS) if (line[field] != null) record[field] = line[field];
    return record;
  });
  out.payments = payments.map((payment) => ({
    id: payment.id,
    date: payment.date,
    amount: payment.amount as Cents,
    paymentMethodId: payment.paymentMethodId,
  }));
  return out as StoredPurchaseInvoice;
}

/** Every invoice column, so writing a record also clears the fields it no longer has. */
function toColumns(record: StoredPurchaseInvoice) {
  return Object.fromEntries(FIELDS.map((field) => [field, record[field] ?? null])) as unknown as Omit<
    typeof purchaseInvoice.$inferInsert,
    "organizationId"
  >;
}

const where = (organizationId: string, id: string) =>
  and(eq(purchaseInvoice.organizationId, organizationId), eq(purchaseInvoice.id, id));

async function liveRow(tx: Tx, organizationId: string, id: string) {
  const [row] = await tx
    .select()
    .from(purchaseInvoice)
    .where(and(where(organizationId, id), isNull(purchaseInvoice.deletedAt)))
    .for("update");
  return row;
}

/** Lines and payments of the given invoices, or of every invoice when no IDs are given, by invoice. */
async function detailsOf(tx: Tx, organizationId: string, invoiceIds?: string[]) {
  const lines = new Map<string, LineRow[]>();
  const payments = new Map<string, PaymentRow[]>();
  if (invoiceIds?.length === 0) return { lines, payments };
  const lineRows = await tx
    .select()
    .from(purchaseLine)
    .where(
      and(
        eq(purchaseLine.organizationId, organizationId),
        invoiceIds ? inArray(purchaseLine.invoiceId, invoiceIds) : undefined,
      ),
    )
    .orderBy(asc(purchaseLine.invoiceId), asc(purchaseLine.position));
  for (const row of lineRows) lines.set(row.invoiceId, [...(lines.get(row.invoiceId) ?? []), row]);
  const paymentRows = await tx
    .select()
    .from(purchasePayment)
    .where(
      and(
        eq(purchasePayment.organizationId, organizationId),
        invoiceIds ? inArray(purchasePayment.invoiceId, invoiceIds) : undefined,
      ),
    )
    .orderBy(asc(purchasePayment.invoiceId), asc(purchasePayment.position));
  for (const row of paymentRows) payments.set(row.invoiceId, [...(payments.get(row.invoiceId) ?? []), row]);
  return { lines, payments };
}

async function writeLines(tx: Tx, organizationId: string, record: StoredPurchaseInvoice) {
  await tx
    .delete(purchaseLine)
    .where(and(eq(purchaseLine.organizationId, organizationId), eq(purchaseLine.invoiceId, record.id)));
  if (record.lines.length === 0) return;
  await tx.insert(purchaseLine).values(
    record.lines.map((line, position) => ({
      organizationId,
      invoiceId: record.id,
      position,
      ...Object.fromEntries(LINE_FIELDS.map((field) => [field, line[field] ?? null])),
    })) as (typeof purchaseLine.$inferInsert)[],
  );
}

async function writePayments(tx: Tx, organizationId: string, record: StoredPurchaseInvoice) {
  await tx
    .delete(purchasePayment)
    .where(and(eq(purchasePayment.organizationId, organizationId), eq(purchasePayment.invoiceId, record.id)));
  if (record.payments.length === 0) return;
  await tx
    .insert(purchasePayment)
    .values(
      record.payments.map((payment, position) => ({ organizationId, invoiceId: record.id, position, ...payment })),
    );
}

/** A credit note names another received invoice of the organization that isn't deleted. */
async function checkRectified(tx: Tx, organizationId: string, record: StoredPurchaseInvoice) {
  if (!record.rectifiesId) return;
  if (record.rectifiesId === record.id) invalid("rectifiesId: an invoice can't correct itself.");
  const [original] = await tx
    .select({ id: purchaseInvoice.id })
    .from(purchaseInvoice)
    .where(and(where(organizationId, record.rectifiesId), isNull(purchaseInvoice.deletedAt)));
  if (!original) invalid("rectifiesId: no such received invoice.");
}

export async function createPurchaseInvoice(tx: Tx, organizationId: string, data: unknown) {
  const record = parse(data);
  await checkSupplier(tx, organizationId, record.supplierId, "invalid_invoice");
  await checkRectified(tx, organizationId, record);
  await checkQuarterOpen(tx, organizationId, record.bookedOn);
  await checkAttachments(tx, organizationId, record.attachments);
  const [row] = await tx
    .insert(purchaseInvoice)
    .values({ ...toColumns(record), organizationId })
    .onConflictDoNothing()
    .returning({ id: purchaseInvoice.id });
  if (!row) alreadyExists();
  await writeLines(tx, organizationId, record);
  await writePayments(tx, organizationId, record);
}

/**
 * Applies the changes over the stored record and validates the result as a
 * whole. While its quarter is closed, an invoice only takes changes to its
 * payments, tags, attachments and private notes, and can't move to another
 * date; nor can an invoice move into a closed quarter.
 */
export async function updatePurchaseInvoice(
  tx: Tx,
  organizationId: string,
  id: string,
  changes: Record<string, unknown>,
) {
  if ("id" in changes && changes.id !== id) invalid("id: can't be changed.");
  const row = await liveRow(tx, organizationId, id);
  if (!row) notFound();
  const { lines, payments } = await detailsOf(tx, organizationId, [id]);
  const current = toPurchaseInvoice(row, lines.get(id) ?? [], payments.get(id) ?? []);
  const record = parse(mergeChanges(storedPurchaseInvoiceSchema, current, changes));

  const touched = touchedFields<StoredPurchaseInvoice>(current, record, changes);
  if (touched.some((field) => !OPEN_WHEN_CLOSED.has(field))) {
    await checkQuarterOpen(tx, organizationId, current.bookedOn);
    if (record.bookedOn !== current.bookedOn) await checkQuarterOpen(tx, organizationId, record.bookedOn);
  }
  if (record.supplierId !== current.supplierId)
    await checkSupplier(tx, organizationId, record.supplierId, "invalid_invoice");
  if (record.rectifiesId !== current.rectifiesId) await checkRectified(tx, organizationId, record);
  await checkAttachments(tx, organizationId, record.attachments, current.attachments);

  await tx.update(purchaseInvoice).set(toColumns(record)).where(where(organizationId, id));
  if (touched.includes("lines")) await writeLines(tx, organizationId, record);
  if (touched.includes("payments")) await writePayments(tx, organizationId, record);
}

export async function deletePurchaseInvoice(tx: Tx, organizationId: string, id: string) {
  const row = await liveRow(tx, organizationId, id);
  if (!row) notFound();
  await checkQuarterOpen(tx, organizationId, row.bookedOn);
  await tx.update(purchaseInvoice).set({ deletedAt: new Date() }).where(where(organizationId, id));
}

/** Received invoices of the organization that aren't deleted, with their lines and payments, oldest first. */
export async function livePurchaseInvoices(tx: Tx, organizationId: string) {
  const rows = await tx
    .select()
    .from(purchaseInvoice)
    .where(and(eq(purchaseInvoice.organizationId, organizationId), isNull(purchaseInvoice.deletedAt)))
    .orderBy(purchaseInvoice.id);
  const { lines, payments } = await detailsOf(tx, organizationId);
  return rows.map((row) => toPurchaseInvoice(row, lines.get(row.id) ?? [], payments.get(row.id) ?? []));
}

/** Current rows, tombstones included, for the given IDs. */
export async function purchaseInvoicesById(tx: Tx, organizationId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await tx
    .select()
    .from(purchaseInvoice)
    .where(and(eq(purchaseInvoice.organizationId, organizationId), inArray(purchaseInvoice.id, ids)));
  const { lines, payments } = await detailsOf(
    tx,
    organizationId,
    rows.filter((row) => !row.deletedAt).map((row) => row.id),
  );
  return rows.map((row) => ({
    id: row.id,
    deleted: row.deletedAt !== null,
    record: toPurchaseInvoice(row, lines.get(row.id) ?? [], payments.get(row.id) ?? []),
  }));
}

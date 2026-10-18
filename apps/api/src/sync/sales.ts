import { storedSalesDocumentSchema, type IssuedSnapshot } from "@fiscalia/contracts";
import {
  INVOICE_SERIES_PREFIX,
  WITHHOLDING_RATES,
  invoiceTotals,
  laterInvoiceInSeries,
  nextInvoiceNumber,
  type Cents,
} from "@fiscalia/core";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import type { Tx } from "../db/client";
import { contact, salesDocument, salesLine } from "../db/schema";
import { ApiError } from "../errors";
import { checkQuarterOpen } from "./closing";
import { checkAttachments } from "./files";
import { alreadyExists, mergeChanges, parseOr, touchedFields } from "./records";

export type StoredSalesDocument = z.infer<typeof storedSalesDocumentSchema>;
type DocumentRow = typeof salesDocument.$inferSelect;
type LineRow = typeof salesLine.$inferSelect;

/** Fields stored as columns of `sales_document`, as the record names them. */
const FIELDS = (Object.keys(storedSalesDocumentSchema.shape) as (keyof StoredSalesDocument)[]).filter(
  (field) => field !== "lines" && field !== "issued",
);
/** Columns of a line, as the record names them. */
export const LINE_FIELDS = [
  "id",
  "concept",
  "detail",
  "unitPrice",
  "quantity",
  "discount",
  "vatRate",
  "surchargeRate",
  "serviceFrom",
  "serviceTo",
  "productId",
  "unit",
] as const;

/** What can still change once an invoice is issued: its collection and the app's own bookkeeping. */
const MUTABLE_WHEN_ISSUED = new Set<string>([
  "status",
  "paidOn",
  "paymentMethodId",
  "tags",
  "attachments",
  "privateNotes",
]);

/** The record as the API returns it: optional fields that are empty are left out. */
export function toSalesDocument(row: DocumentRow, lines: LineRow[]): StoredSalesDocument {
  const out: Record<string, unknown> = {};
  for (const field of FIELDS) {
    const value = row[field as keyof DocumentRow];
    if (value != null) out[field] = value;
  }
  // Nullable in the record itself: present even when empty
  out.number = row.number;
  out.dueOn = row.dueOn;
  out.operationOn = row.operationOn;
  out.clientId = row.clientId ?? "";
  out.lines = lines.map((line) => {
    const record: Record<string, unknown> = {};
    for (const field of LINE_FIELDS) if (line[field] != null) record[field] = line[field];
    return record;
  });
  if (row.issuedAt) {
    out.issued = {
      client: row.clientSnapshot!,
      totals: {
        base: row.totalBase as Cents,
        vat: row.totalVat as Cents,
        surcharge: row.totalSurcharge as Cents,
        withholding: row.totalWithholding as Cents,
        supplies: (row.supplies ?? 0) as Cents,
        total: row.total as Cents,
        vatBreakdown: row.vatBreakdown!,
      },
    } satisfies IssuedSnapshot;
  }
  return out as StoredSalesDocument;
}

/** Every document column, so writing a record also clears the fields it no longer has. */
function toColumns(record: StoredSalesDocument) {
  const columns = Object.fromEntries(FIELDS.map((field) => [field, record[field] ?? null]));
  return { ...columns, clientId: record.clientId || null } as Omit<typeof salesDocument.$inferInsert, "organizationId">;
}

function invalid(message: string): never {
  throw new ApiError(400, "invalid_document", message);
}

const parse = (data: unknown): StoredSalesDocument => parseOr(storedSalesDocumentSchema, data, "invalid_document");

function notFound(): never {
  throw new ApiError(404, "not_found", "Sales document not found.");
}

function issuedError(): never {
  throw new ApiError(409, "invoice_issued", "Issued invoices can't be changed or deleted; rectify them instead.");
}

async function liveRow(tx: Tx, organizationId: string, id: string) {
  const [row] = await tx
    .select()
    .from(salesDocument)
    .where(
      and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.id, id), isNull(salesDocument.deletedAt)),
    )
    .for("update");
  return row;
}

/** Lines of the given documents, or of every document when no IDs are given, by document. */
async function linesOf(tx: Tx, organizationId: string, documentIds?: string[]) {
  if (documentIds?.length === 0) return new Map<string, LineRow[]>();
  const rows = await tx
    .select()
    .from(salesLine)
    .where(
      and(
        eq(salesLine.organizationId, organizationId),
        documentIds ? inArray(salesLine.documentId, documentIds) : undefined,
      ),
    )
    .orderBy(asc(salesLine.documentId), asc(salesLine.position));
  const byDocument = new Map<string, LineRow[]>();
  for (const row of rows) byDocument.set(row.documentId, [...(byDocument.get(row.documentId) ?? []), row]);
  return byDocument;
}

async function writeLines(tx: Tx, organizationId: string, record: StoredSalesDocument) {
  await tx
    .delete(salesLine)
    .where(and(eq(salesLine.organizationId, organizationId), eq(salesLine.documentId, record.id)));
  if (record.lines.length === 0) return;
  await tx.insert(salesLine).values(
    record.lines.map((line, position) => ({
      organizationId,
      documentId: record.id,
      position,
      ...Object.fromEntries(LINE_FIELDS.map((field) => [field, line[field] ?? null])),
    })) as (typeof salesLine.$inferInsert)[],
  );
}

/** The client must be one of the organization's clients that isn't deleted. */
async function checkClient(tx: Tx, organizationId: string, clientId: string) {
  if (!clientId) return undefined;
  const [row] = await tx
    .select()
    .from(contact)
    .where(
      and(
        eq(contact.organizationId, organizationId),
        eq(contact.id, clientId),
        eq(contact.role, "client"),
        isNull(contact.deletedAt),
      ),
    );
  if (!row) invalid("clientId: no such client.");
  return row;
}

/** Drafts, quotes and delivery notes. Invoices are only created by issuing them. */
export async function createSalesDocument(tx: Tx, organizationId: string, data: unknown) {
  const { issued: _, ...record } = parse(data);
  if (record.kind === "invoice") invalid("kind: invoices are created by issuing them.");
  await checkClient(tx, organizationId, record.clientId);
  await checkAttachments(tx, organizationId, record.attachments);
  const [row] = await tx
    .insert(salesDocument)
    .values({ ...toColumns(record), organizationId })
    .onConflictDoNothing()
    .returning({ id: salesDocument.id });
  if (!row) alreadyExists();
  await writeLines(tx, organizationId, record);
}

/**
 * Applies the changes over the stored record and validates the result as a
 * whole. An issued invoice only takes changes to its collection, tags,
 * attachments and private notes.
 */
export async function updateSalesDocument(
  tx: Tx,
  organizationId: string,
  id: string,
  changes: Record<string, unknown>,
) {
  if ("id" in changes && changes.id !== id) invalid("id: can't be changed.");
  const row = await liveRow(tx, organizationId, id);
  if (!row) notFound();
  const current = toSalesDocument(row, (await linesOf(tx, organizationId, [id])).get(id) ?? []);

  const { issued: _, ...record } = parse(mergeChanges(storedSalesDocumentSchema, current, changes));
  await checkAttachments(tx, organizationId, record.attachments, current.attachments);

  if (current.kind === "invoice") {
    if (touchedFields<StoredSalesDocument>(current, record, changes).some((field) => !MUTABLE_WHEN_ISSUED.has(field)))
      issuedError();
    if (record.status !== "pending" && record.status !== "paid") invalid("status: an invoice is pending or paid.");
    await tx
      .update(salesDocument)
      .set({
        status: record.status,
        paidOn: record.paidOn ?? null,
        paymentMethodId: record.paymentMethodId ?? null,
        tags: record.tags ?? null,
        attachments: record.attachments ?? null,
        privateNotes: record.privateNotes,
      })
      .where(and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.id, id)));
    return;
  }

  if (record.kind !== current.kind) invalid("kind: can't be changed; issue the draft to make it an invoice.");
  if (record.clientId !== current.clientId) await checkClient(tx, organizationId, record.clientId);
  await tx
    .update(salesDocument)
    .set(toColumns(record))
    .where(and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.id, id)));
  if ("lines" in changes) await writeLines(tx, organizationId, record);
}

export async function deleteSalesDocument(tx: Tx, organizationId: string, id: string) {
  const row = await liveRow(tx, organizationId, id);
  if (!row) notFound();
  if (row.kind === "invoice") issuedError();
  await tx
    .update(salesDocument)
    .set({ deletedAt: new Date() })
    .where(and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.id, id)));
}

/**
 * Issues an invoice: a new one, or the draft with the same ID. It takes the
 * next number of its series (or `number`, for an imported invoice), and its
 * client data and totals are frozen.
 */
export async function issueInvoice(tx: Tx, organizationId: string, data: unknown, number?: string) {
  const { issued: _, ...record } = parse(data);
  const existing = await liveRow(tx, organizationId, record.id);
  if (existing?.kind === "invoice") throw new ApiError(409, "already_issued", "This invoice is already issued.");
  if (existing && existing.kind !== "draft")
    invalid("id: only drafts can be issued; quotes and delivery notes are invoiced with a new document.");
  if (!existing) {
    const [deleted] = await tx
      .select({ id: salesDocument.id })
      .from(salesDocument)
      .where(and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.id, record.id)));
    if (deleted) alreadyExists();
  }
  await checkAttachments(tx, organizationId, record.attachments, existing ? (existing.attachments ?? []) : []);

  if (!record.clientId) invalid("clientId: an invoice needs a client.");
  const client = (await checkClient(tx, organizationId, record.clientId))!;
  if (record.lines.length === 0) invalid("lines: an invoice needs at least one line.");
  if (record.status !== "pending" && record.status !== "paid") record.status = "pending";
  await checkQuarterOpen(tx, organizationId, record.issuedOn);
  await checkRectified(tx, organizationId, record, number !== undefined);

  const issued = await issuedInvoices(tx, organizationId);
  if (number !== undefined) {
    // Rectifying numbers carry their prefix; anything else belongs to the normal series
    const series = number.startsWith(INVOICE_SERIES_PREFIX.rectifying) ? "rectifying" : "normal";
    if (series !== record.series) invalid(`number: ${number} isn't a number of the ${record.series} series.`);
    if (issued.some((invoice) => invoice.number === number))
      throw new ApiError(409, "number_taken", `Invoice ${number} already exists.`);
  } else {
    const later = laterInvoiceInSeries(record.series, record.issuedOn, issued);
    if (later)
      throw new ApiError(
        409,
        "date_out_of_order",
        `Invoice ${later.number} of this series is dated ${later.issuedOn}; a new one can't be dated earlier.`,
      );
  }

  const invoice = {
    ...record,
    kind: "invoice" as const,
    number: number ?? nextInvoiceNumber(record.series, record.issuedOn, issued),
  };
  const values = { ...toColumns(invoice), organizationId, issuedAt: new Date() };
  if (existing)
    await tx
      .update(salesDocument)
      .set(values)
      .where(and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.id, invoice.id)));
  else await tx.insert(salesDocument).values(values);
  await writeLines(tx, organizationId, invoice);

  // Totals from the lines as stored, so they match what the record returns
  const lines = (await linesOf(tx, organizationId, [invoice.id])).get(invoice.id) ?? [];
  const totals = invoiceTotals(
    lines.map((line) => ({ ...line, surchargeRate: line.surchargeRate ?? undefined })),
    WITHHOLDING_RATES[invoice.withholding],
    (invoice.supplies ?? 0) as Cents,
  );
  await tx
    .update(salesDocument)
    .set({
      clientSnapshot: {
        name: client.name,
        taxId: client.taxId,
        ...(client.address != null && { address: client.address }),
        ...(client.postalCode != null && { postalCode: client.postalCode }),
        ...(client.city != null && { city: client.city }),
        ...(client.province != null && { province: client.province }),
        ...(client.country != null && { country: client.country }),
      },
      totalBase: totals.base,
      totalVat: totals.vat,
      totalSurcharge: totals.surcharge,
      totalWithholding: totals.withholding,
      total: totals.total,
      vatBreakdown: totals.vatBreakdown,
    })
    .where(and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.id, invoice.id)));
}

/** A rectifying invoice names an issued invoice of the normal series; imported ones may predate the app. */
async function checkRectified(tx: Tx, organizationId: string, record: StoredSalesDocument, imported: boolean) {
  if (record.series === "normal") {
    if (record.rectifiesId) invalid("rectifiesId: only rectifying invoices rectify another one.");
    return;
  }
  if (!record.rectifiesId) {
    if (imported) return;
    invalid("rectifiesId: a rectifying invoice must name the invoice it corrects.");
  }
  const [original] = await tx
    .select({ kind: salesDocument.kind, series: salesDocument.series })
    .from(salesDocument)
    .where(and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.id, record.rectifiesId)));
  if (original?.kind !== "invoice" || original.series !== "normal")
    invalid("rectifiesId: must be an issued invoice of the normal series.");
}

async function issuedInvoices(tx: Tx, organizationId: string) {
  const rows = await tx
    .select({ number: salesDocument.number, series: salesDocument.series, issuedOn: salesDocument.issuedOn })
    .from(salesDocument)
    .where(and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.kind, "invoice")));
  return rows.map((row) => ({ ...row, number: row.number! }));
}

/** Documents of the organization that aren't deleted, with their lines, oldest first. */
export async function liveSalesDocuments(tx: Tx, organizationId: string) {
  const rows = await tx
    .select()
    .from(salesDocument)
    .where(and(eq(salesDocument.organizationId, organizationId), isNull(salesDocument.deletedAt)))
    .orderBy(salesDocument.id);
  const lines = await linesOf(tx, organizationId);
  return rows.map((row) => toSalesDocument(row, lines.get(row.id) ?? []));
}

/** Current rows, tombstones included, for the given IDs, with their lines. */
export async function salesDocumentsById(tx: Tx, organizationId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await tx
    .select()
    .from(salesDocument)
    .where(and(eq(salesDocument.organizationId, organizationId), inArray(salesDocument.id, ids)));
  const lines = await linesOf(
    tx,
    organizationId,
    rows.filter((row) => !row.deletedAt).map((row) => row.id),
  );
  return rows.map((row) => ({
    id: row.id,
    deleted: row.deletedAt !== null,
    record: toSalesDocument(row, lines.get(row.id) ?? []),
  }));
}

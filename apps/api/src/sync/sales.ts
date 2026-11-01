import {
  SALES_STATUSES_BY_KIND,
  invoiceSeriesOf,
  storedSalesDocumentSchema,
  type IssuedSnapshot,
  type VerifactuRecordInfo,
} from "@cuentalibre/contracts";
import {
  DEFAULT_RECTIFICATION,
  WITHHOLDING_RATES,
  correctedLines,
  invoiceTotals,
  laterInvoiceInSeries,
  laterNumberInSeries,
  missingIssuerFields,
  nextInvoiceNumber,
  outOfOrderInSeries,
  parseSeriesNumber,
  paymentStatus,
  type Cents,
  type VerifactuEnvironment,
} from "@cuentalibre/core";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import type { z } from "zod";
import type { Tx } from "../db/client";
import { contact, salesDocument, salesLine, salesPayment } from "../db/schema";
import { ApiError } from "../errors";
import { recordInfoByInvoice, registerInvoice, usesVerifactu } from "../verifactu/record";
import { checkQuarterOpen } from "./closing";
import { checkAttachments } from "./files";
import { alreadyExists, mergeChanges, parseOr, repeatedId, touchedFields } from "./records";
import { readSettings } from "./settings";

export type StoredSalesDocument = z.infer<typeof storedSalesDocumentSchema>;
type DocumentRow = typeof salesDocument.$inferSelect;
type LineRow = typeof salesLine.$inferSelect;
type PaymentRow = typeof salesPayment.$inferSelect;

/** Fields stored as columns of `sales_document`, as the record names them. */
const FIELDS = (Object.keys(storedSalesDocumentSchema.shape) as (keyof StoredSalesDocument)[]).filter(
  (field) => field !== "lines" && field !== "payments" && field !== "issued",
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

/** What can still change once an invoice is issued: its collections and the app's own bookkeeping. */
const MUTABLE_WHEN_ISSUED = new Set<string>(["status", "payments", "tags", "attachments", "privateNotes"]);
/** What never changes on an issued invoice, even where it can be revised: its place in the numbering. */
const FIXED_WHEN_REVISED = new Set<string>(["kind", "number", "series", "seriesId", "rectifiesId", "rectification"]);

/** The record as the API returns it: optional fields that are empty are left out. */
export function toSalesDocument(
  row: DocumentRow,
  lines: LineRow[],
  payments: PaymentRow[],
  verifactu?: VerifactuRecordInfo,
): StoredSalesDocument {
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
  if (payments.length > 0)
    out.payments = payments.map((payment) => ({
      id: payment.id,
      date: payment.date,
      amount: payment.amount as Cents,
      paymentMethodId: payment.paymentMethodId,
    }));
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
      ...(verifactu && { verifactu }),
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

/** Parses a document and checks what its shape can't: a status of its kind and lines and payments with their own IDs. */
function parse(data: unknown): StoredSalesDocument {
  const record = parseOr(storedSalesDocumentSchema, data, "invalid_document");
  const statuses = SALES_STATUSES_BY_KIND[record.kind];
  if (!statuses.includes(record.status))
    invalid(`status: ${record.kind === "invoice" ? "an" : "a"} ${record.kind} can only be ${statuses.join(", ")}.`);
  const line = repeatedId(record.lines);
  if (line !== undefined) invalid(`lines: the ID ${line} is repeated.`);
  const payment = repeatedId(record.payments);
  if (payment !== undefined) invalid(`payments: the ID ${payment} is repeated.`);
  if (record.rectification && record.series !== "rectifying")
    invalid("rectification: only rectifying invoices say how they rectify.");
  return record;
}

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

/** Lines and collections of the given documents, or of every document when no IDs are given, by document. */
async function detailsOf(tx: Tx, organizationId: string, documentIds?: string[]) {
  const lines = new Map<string, LineRow[]>();
  const payments = new Map<string, PaymentRow[]>();
  if (documentIds?.length === 0) return { lines, payments };
  const lineRows = await tx
    .select()
    .from(salesLine)
    .where(
      and(
        eq(salesLine.organizationId, organizationId),
        documentIds ? inArray(salesLine.documentId, documentIds) : undefined,
      ),
    )
    .orderBy(asc(salesLine.documentId), asc(salesLine.position));
  for (const row of lineRows) lines.set(row.documentId, [...(lines.get(row.documentId) ?? []), row]);
  const paymentRows = await tx
    .select()
    .from(salesPayment)
    .where(
      and(
        eq(salesPayment.organizationId, organizationId),
        documentIds ? inArray(salesPayment.documentId, documentIds) : undefined,
      ),
    )
    .orderBy(asc(salesPayment.documentId), asc(salesPayment.position));
  for (const row of paymentRows) payments.set(row.documentId, [...(payments.get(row.documentId) ?? []), row]);
  return { lines, payments };
}

async function writePayments(tx: Tx, organizationId: string, record: StoredSalesDocument) {
  await tx
    .delete(salesPayment)
    .where(and(eq(salesPayment.organizationId, organizationId), eq(salesPayment.documentId, record.id)));
  if (!record.payments?.length) return;
  await tx
    .insert(salesPayment)
    .values(
      record.payments.map((payment, position) => ({ organizationId, documentId: record.id, position, ...payment })),
    );
}

/** An invoice is paid once its collections cover the total, and pending until then. */
const collectionStatus = (total: number, payments: StoredSalesDocument["payments"]) =>
  paymentStatus(
    total as Cents,
    (payments ?? []).map((p) => p.amount),
  ) === "paid"
    ? "paid"
    : "pending";

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
  if (record.payments?.length) invalid("payments: only invoices are collected.");
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
 * attachments and private notes, unless it can be revised (see `reviseInvoice`).
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
  const { lines, payments } = await detailsOf(tx, organizationId, [id]);
  const current = toSalesDocument(row, lines.get(id) ?? [], payments.get(id) ?? []);

  const { issued: _, ...record } = parse(mergeChanges(storedSalesDocumentSchema, current, changes));
  await checkAttachments(tx, organizationId, record.attachments, current.attachments);

  if (current.kind === "invoice") {
    const touched = touchedFields<StoredSalesDocument>(current, record, changes);
    if (touched.some((field) => !MUTABLE_WHEN_ISSUED.has(field))) {
      await reviseInvoice(tx, organizationId, current, record, touched);
      return;
    }
    await tx
      .update(salesDocument)
      .set({
        // Follows the collections, whatever status was sent
        status: collectionStatus(row.total!, record.payments),
        tags: record.tags ?? null,
        attachments: record.attachments ?? null,
        privateNotes: record.privateNotes,
      })
      .where(and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.id, id)));
    if ("payments" in changes) await writePayments(tx, organizationId, record);
    return;
  }

  if (record.payments?.length) invalid("payments: only invoices are collected.");
  if (record.kind !== current.kind) invalid("kind: can't be changed; issue the draft to make it an invoice.");
  if (record.clientId !== current.clientId) await checkClient(tx, organizationId, record.clientId);
  await tx
    .update(salesDocument)
    .set(toColumns(record))
    .where(and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.id, id)));
  if ("lines" in changes) await writeLines(tx, organizationId, record);
}

/**
 * Rewrites an issued invoice, as a business exempt from VERI*FACTU may while
 * the invoice has no record and its quarter is open, like deleting it. Its
 * number and series stay; a new date must keep it in order within them.
 */
async function reviseInvoice(
  tx: Tx,
  organizationId: string,
  current: StoredSalesDocument,
  record: StoredSalesDocument,
  touched: string[],
) {
  const settings = await readSettings(tx, organizationId);
  if (settings.verifactu.system !== "exempt" || (await recordInfoByInvoice(tx, organizationId, [current.id])).size > 0)
    issuedError();
  const fixed = touched.find((field) => FIXED_WHEN_REVISED.has(field));
  if (fixed) invalid(`${fixed}: can't be changed on an issued invoice.`);
  await checkQuarterOpen(tx, organizationId, current.issuedOn);
  if (!record.clientId) invalid("clientId: an invoice needs a client.");
  const client = (await checkClient(tx, organizationId, record.clientId))!;
  if (record.lines.length === 0) invalid("lines: an invoice needs at least one line.");
  await checkRectified(tx, organizationId, record, false);

  if (record.issuedOn !== current.issuedOn) {
    await checkQuarterOpen(tx, organizationId, record.issuedOn);
    if (record.issuedOn.slice(0, 4) !== current.issuedOn.slice(0, 4))
      invalid("issuedOn: can't move to another year, which is part of the number.");
    const series = invoiceSeriesOf(record, settings.invoiceSettings.series ?? []);
    const jumped =
      series &&
      outOfOrderInSeries(
        series.mask,
        { number: record.number!, issuedOn: record.issuedOn },
        await issuedInvoices(tx, organizationId),
      );
    if (jumped)
      throw new ApiError(
        409,
        "date_out_of_order",
        `Invoice ${jumped.number} of this series is dated ${jumped.issuedOn}; this one would be out of order.`,
      );
  }

  await tx
    .update(salesDocument)
    .set(toColumns(record))
    .where(and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.id, record.id)));
  await writeLines(tx, organizationId, record);
  await writePayments(tx, organizationId, record);
  await freezeInvoice(tx, organizationId, record, client);
}

/**
 * Deletes a document. An issued invoice can only be deleted by a business
 * exempt from VERI*FACTU, never once it has a record, while its quarter is
 * open, if it is the last of its series (numbering stays gapless) and no
 * rectifying invoice corrects it.
 */
export async function deleteSalesDocument(tx: Tx, organizationId: string, id: string) {
  const row = await liveRow(tx, organizationId, id);
  if (!row) notFound();
  if (row.kind === "invoice") {
    const settings = await readSettings(tx, organizationId);
    if (settings.verifactu.system !== "exempt" || (await recordInfoByInvoice(tx, organizationId, [id])).size > 0)
      issuedError();
    await checkQuarterOpen(tx, organizationId, row.issuedOn);
    const series = invoiceSeriesOf(
      { series: row.series, seriesId: row.seriesId ?? undefined },
      settings.invoiceSettings.series ?? [],
    );
    const later = series && laterNumberInSeries(series.mask, row.number!, await issuedInvoices(tx, organizationId));
    if (later)
      throw new ApiError(
        409,
        "not_last_in_series",
        `Invoice ${later.number} follows this one in its series; only the last invoice can be deleted. Rectify it instead.`,
      );
    const [rectifying] = await tx
      .select({ number: salesDocument.number })
      .from(salesDocument)
      .where(
        and(
          eq(salesDocument.organizationId, organizationId),
          eq(salesDocument.rectifiesId, id),
          eq(salesDocument.kind, "invoice"),
          isNull(salesDocument.deletedAt),
        ),
      )
      .limit(1);
    if (rectifying) throw new ApiError(409, "in_use", `Rectifying invoice ${rectifying.number} corrects this one.`);
  }
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
export async function issueInvoice(
  tx: Tx,
  organizationId: string,
  data: unknown,
  number: string | undefined,
  verifactuEnvironment: VerifactuEnvironment,
) {
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
  await checkQuarterOpen(tx, organizationId, record.issuedOn);
  const original = await checkRectified(tx, organizationId, record, number !== undefined);

  const settings = await readSettings(tx, organizationId);
  const missing = missingIssuerFields(settings.businessProfile);
  if (missing.length > 0)
    throw new ApiError(
      400,
      "issuer_missing",
      `Every invoice names its issuer: the business profile lacks ${missing.join(", ")}.`,
    );
  const series = invoiceSeriesOf(record, settings.invoiceSettings.series ?? []);
  if (!series) invalid("seriesId: no such series in the invoice settings.");
  if (series.type !== record.series) invalid(`seriesId: ${series.name} isn't a series of ${record.series} invoices.`);
  // Invoices issued elsewhere may still be imported into a series that takes no new ones
  if (series.active === false && number === undefined)
    throw new ApiError(409, "series_inactive", `${series.name} is inactive and takes no new invoices.`);

  const issued = await issuedInvoices(tx, organizationId);
  if (number !== undefined) {
    // Imported numbers of a custom series follow its mask; the built-in series only tell rectifying ones by "R-"
    const fits =
      record.seriesId !== undefined
        ? parseSeriesNumber(series.mask, number) !== null
        : number.startsWith("R-") === (record.series === "rectifying");
    if (!fits) invalid(`number: ${number} isn't a number of the ${series.name} series.`);
    if (issued.some((invoice) => invoice.number === number))
      throw new ApiError(409, "number_taken", `Invoice ${number} already exists.`);
  } else {
    const later = laterInvoiceInSeries(series.mask, record.issuedOn, issued);
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
    number: number ?? nextInvoiceNumber(series.mask, record.issuedOn, issued),
    // Stated on the invoice, so its record and any later read agree on it
    ...(record.series === "rectifying" && { rectification: record.rectification ?? DEFAULT_RECTIFICATION }),
  };
  const values = { ...toColumns(invoice), organizationId, issuedAt: new Date() };
  if (existing)
    await tx
      .update(salesDocument)
      .set(values)
      .where(and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.id, invoice.id)));
  else await tx.insert(salesDocument).values(values);
  await writeLines(tx, organizationId, invoice);
  await writePayments(tx, organizationId, invoice);

  const lines = await freezeInvoice(tx, organizationId, invoice, client);

  // Invoices issued elsewhere and imported were recorded by the software that issued them
  if (number === undefined && usesVerifactu(settings, invoice.issuedOn))
    await registerInvoice(
      tx,
      organizationId,
      settings,
      {
        ...invoice,
        number: invoice.number,
        lines: lines.map((line) => ({ ...line, surchargeRate: line.surchargeRate ?? undefined })),
        ...(original && { original }),
      },
      client,
      verifactuEnvironment,
    );
}

/**
 * Stores what an issued invoice keeps as it was: its client's fiscal data and
 * its totals, from the lines as stored so they match what the record returns.
 * Answers the stored lines.
 */
async function freezeInvoice(
  tx: Tx,
  organizationId: string,
  invoice: StoredSalesDocument,
  client: NonNullable<Awaited<ReturnType<typeof checkClient>>>,
) {
  const lines = (await detailsOf(tx, organizationId, [invoice.id])).lines.get(invoice.id) ?? [];
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
      status: collectionStatus(totals.total, invoice.payments),
    })
    .where(and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.id, invoice.id)));
  return lines;
}

/**
 * A rectifying invoice names an issued invoice of the normal series; imported
 * ones may predate the app. One by substitution keeps the original's
 * withholding and kind of operation, so its lines add up to the change, and
 * starts by reversing every line of the original (`substitutionLines`). It
 * replaces an invoice no other rectifying invoice has corrected yet. Answers
 * the original of a substitution, which its record names.
 */
async function checkRectified(tx: Tx, organizationId: string, record: StoredSalesDocument, imported: boolean) {
  if (record.series === "normal") {
    if (record.rectifiesId) invalid("rectifiesId: only rectifying invoices rectify another one.");
    return undefined;
  }
  if (!record.rectifiesId) {
    if (imported) return undefined;
    invalid("rectifiesId: a rectifying invoice must name the invoice it corrects.");
  }
  const [original] = await tx
    .select()
    .from(salesDocument)
    .where(and(eq(salesDocument.organizationId, organizationId), eq(salesDocument.id, record.rectifiesId)));
  if (original?.kind !== "invoice" || original.series !== "normal")
    invalid("rectifiesId: must be an issued invoice of the normal series.");
  if (record.rectification?.method !== "substitution") return undefined;

  if (record.withholding !== original.withholding || record.operationType !== original.operationType)
    invalid("A rectifying invoice by substitution keeps the original's withholding and kind of operation.");
  const lines = (await detailsOf(tx, organizationId, [original.id])).lines.get(original.id) ?? [];
  const corrected = correctedLines(
    record.lines,
    lines.map((line) => ({ ...line, surchargeRate: line.surchargeRate ?? undefined })),
  );
  if (!corrected?.length)
    invalid("lines: a substitution reverses every line of the original first, then lists the corrected ones.");
  const [other] = await tx
    .select({ number: salesDocument.number })
    .from(salesDocument)
    .where(
      and(
        eq(salesDocument.organizationId, organizationId),
        eq(salesDocument.rectifiesId, original.id),
        eq(salesDocument.kind, "invoice"),
        ne(salesDocument.id, record.id),
        isNull(salesDocument.deletedAt),
      ),
    )
    .limit(1);
  if (other)
    throw new ApiError(
      409,
      "already_rectified",
      `Rectifying invoice ${other.number} already corrects this one; rectify by differences instead.`,
    );
  return {
    number: original.number!,
    issuedOn: original.issuedOn,
    lineCount: lines.length,
    base: original.totalBase! as Cents,
    vat: original.totalVat! as Cents,
    surcharge: original.totalSurcharge! as Cents,
  };
}

/** Invoices that aren't deleted: a deleted invoice frees its number for the next one. */
async function issuedInvoices(tx: Tx, organizationId: string) {
  const rows = await tx
    .select({ number: salesDocument.number, issuedOn: salesDocument.issuedOn })
    .from(salesDocument)
    .where(
      and(
        eq(salesDocument.organizationId, organizationId),
        eq(salesDocument.kind, "invoice"),
        isNull(salesDocument.deletedAt),
      ),
    );
  return rows.map((row) => ({ ...row, number: row.number! }));
}

/** Documents of the organization that aren't deleted, with their lines, oldest first. */
export async function liveSalesDocuments(tx: Tx, organizationId: string) {
  const rows = await tx
    .select()
    .from(salesDocument)
    .where(and(eq(salesDocument.organizationId, organizationId), isNull(salesDocument.deletedAt)))
    .orderBy(salesDocument.id);
  const { lines, payments } = await detailsOf(tx, organizationId);
  const records = await recordInfoByInvoice(tx, organizationId);
  return rows.map((row) =>
    toSalesDocument(row, lines.get(row.id) ?? [], payments.get(row.id) ?? [], records.get(row.id)),
  );
}

/** Current rows, tombstones included, for the given IDs, with their lines. */
export async function salesDocumentsById(tx: Tx, organizationId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await tx
    .select()
    .from(salesDocument)
    .where(and(eq(salesDocument.organizationId, organizationId), inArray(salesDocument.id, ids)));
  const { lines, payments } = await detailsOf(
    tx,
    organizationId,
    rows.filter((row) => !row.deletedAt).map((row) => row.id),
  );
  const records = await recordInfoByInvoice(
    tx,
    organizationId,
    rows.filter((row) => row.issuedAt).map((row) => row.id),
  );
  return rows.map((row) => ({
    id: row.id,
    deleted: row.deletedAt !== null,
    record: toSalesDocument(row, lines.get(row.id) ?? [], payments.get(row.id) ?? [], records.get(row.id)),
  }));
}

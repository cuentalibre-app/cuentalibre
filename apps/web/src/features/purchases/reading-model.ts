import { WITHHOLDING_RATES, cents, sumBy, type Cents, type WithholdingKind } from "@cuentalibre/core";
import type { ExtractedPurchase, ExtractionIssue } from "@cuentalibre/contracts";
import type { ContactDraft } from "@/features/contacts/contact-draft";
import { emptyLine, type LineDraft } from "@/features/sales/document-editor";
import { formatDecimalInput } from "@/lib/format";

/*
 * What a document read with AI puts in the purchase forms, and which of their
 * fields to check before saving. The server's checks say what doesn't add up;
 * here they become messages next to the fields the user will correct.
 */

/** Files the model can read, by their name: PDFs and photos. */
export const isReadable = (name: string) => /\.(pdf|jpe?g|png|heic|heif|webp|gif)$/i.test(name);

/** The withholding kind with this rate, or none when no kind has it. */
export function withholdingKindOf(rate: number): WithholdingKind {
  const match = Object.entries(WITHHOLDING_RATES).find(([, r]) => Math.abs(r - rate) < 0.00005);
  return (match?.[0] as WithholdingKind | undefined) ?? "none";
}

/** One concept per VAT rate, at the base the document gives it. Empty when it has no breakdown. */
export function linesFromDraft(draft: ExtractedPurchase): LineDraft[] {
  const concept = draft.concept.trim();
  return draft.vatBreakdown.map((line) => ({
    ...emptyLine(line.rate),
    concept,
    unitPrice: formatDecimalInput(line.base / 100),
    surchargeRate: line.surchargeRate,
  }));
}

/** What was paid: the document's total or, without one, its breakdown's. */
export function draftTotal(draft: ExtractedPurchase): Cents | null {
  if (draft.total !== null) return draft.total;
  if (draft.vatBreakdown.length === 0) return null;
  return cents(
    sumBy(draft.vatBreakdown, (line) => cents(line.base + line.vat + line.surcharge)) -
      (draft.withholding?.amount ?? 0),
  );
}

/** Fields of the received invoice form a reading can flag. */
export type InvoiceFlag = "supplierId" | "number" | "issuedOn" | "lines" | "withholding";

/** Fields of the expense form a reading can flag. */
export type ExpenseFlag = "date" | "amount" | "payee";

const INVOICE_MESSAGES: Record<InvoiceFlag, Partial<Record<ExtractionIssue["code"], string>>> = {
  supplierId: {
    missing: "No se ha podido leer el proveedor.",
    invalid: "El NIF leído no es válido: compáralo con el documento.",
  },
  number: { missing: "No se ha podido leer el número." },
  issuedOn: { missing: "No se ha podido leer la fecha." },
  lines: {
    missing: "No se ha podido leer el desglose de IVA.",
    invalid: "Hay un tipo de IVA o recargo que no existe en España.",
    mismatch: "El IVA leído no cuadra con la base.",
  },
  withholding: {
    invalid: "La retención leída no es un tipo habitual.",
    mismatch: "La retención leída no cuadra con la base.",
  },
};

function invoiceFlagOf(field: string): InvoiceFlag | null {
  if (field.startsWith("supplier.")) return "supplierId";
  if (field.startsWith("vatBreakdown")) return "lines";
  if (field.startsWith("withholding")) return "withholding";
  if (field === "number" || field === "issuedOn") return field;
  return null;
}

/**
 * The received invoice form's fields to check, with why. A supplier matched by its tax ID
 * is already right; the total is compared live with the form's, so it isn't here.
 */
export function invoiceFlags(
  issues: ExtractionIssue[],
  supplierMatched: boolean,
): Partial<Record<InvoiceFlag, string>> {
  const flags: Partial<Record<InvoiceFlag, string>> = {};
  for (const { field, code } of issues) {
    const flag = invoiceFlagOf(field);
    if (!flag || flags[flag] || (flag === "supplierId" && supplierMatched)) continue;
    const message = INVOICE_MESSAGES[flag][code];
    if (message) flags[flag] = message;
  }
  return flags;
}

/** The expense form's fields to check: a receipt needs only its date and amount. */
export function expenseFlags(
  issues: ExtractionIssue[],
  draft: ExtractedPurchase,
  supplierMatched: boolean,
): Partial<Record<ExpenseFlag, string>> {
  const flags: Partial<Record<ExpenseFlag, string>> = {};
  const has = (field: string, code?: ExtractionIssue["code"]) =>
    issues.some((i) => i.field === field && (!code || i.code === code));
  if (has("issuedOn")) flags.date = "No se ha podido leer la fecha.";
  if (draftTotal(draft) === null) flags.amount = "No se ha podido leer el importe.";
  else if (issues.some((i) => i.code === "mismatch")) flags.amount = "Los importes del documento no cuadran: revísalo.";
  if (!supplierMatched && has("supplier.taxId", "invalid"))
    flags.payee = "El NIF leído no es válido: compáralo con el documento.";
  return flags;
}

/**
 * The form that suits the document better, if it isn't the one open: a receipt
 * without the supplier's tax ID or VAT breakdown is an expense; an invoice that
 * has both, a received invoice, so its VAT can be deducted.
 */
export function betterForm(draft: ExtractedPurchase, open: "invoice" | "expense"): "invoice" | "expense" | null {
  const fullInvoice = draft.supplier.taxId.trim() !== "" && draft.vatBreakdown.some((line) => line.vat !== 0);
  if (open === "invoice" && draft.kind === "ticket" && !fullInvoice) return "expense";
  if (open === "expense" && draft.kind === "invoice" && fullInvoice) return "invoice";
  return null;
}

/** A new contact's sheet from the supplier read on the document, leaving out what wasn't read. */
export function contactFromDraft(supplier: ExtractedPurchase["supplier"]): Partial<ContactDraft> {
  return Object.fromEntries(Object.entries(supplier).filter(([, value]) => value.trim() !== ""));
}

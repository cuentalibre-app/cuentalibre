import { surchargeFitsVat } from "./catalog";
import { SPAIN, checkTaxId, countryFromVatPrefix, sameTaxId } from "./contacts";
import { INVOICE_VAT_RATES, WITHHOLDING_RATES } from "./invoices";
import { applyRate, sumBy, type Cents } from "./money";

/*
 * Deterministic checks on what an AI model read from a received invoice or
 * receipt. The model can misread a digit or invent a field; these checks don't
 * correct it, they flag what the user should look at before saving.
 */

/** The parts of a purchase draft the checks look at (`ExtractedPurchase` in contracts). */
export interface PurchaseDraft {
  kind: "invoice" | "ticket";
  supplier: { name: string; taxId: string; country: string };
  number: string;
  issuedOn: string | null;
  currency: string;
  vatBreakdown: { rate: number; base: Cents; vat: Cents; surchargeRate: number; surcharge: Cents }[];
  withholding: { rate: number; amount: Cents } | null;
  total: Cents | null;
}

export interface DraftIssue {
  /** Path in the draft: `supplier.taxId`, `vatBreakdown.0.vat`, `total`… */
  field: string;
  code: "missing" | "invalid" | "mismatch";
}

/** Printed amounts are rounded per line, so each line may be a cent off. */
const TOLERANCE = 1;

const isAmong = (rates: readonly number[], rate: number) => rates.some((r) => Math.abs(r - rate) < 0.00005);
const differs = (a: number, b: number, tolerance = TOLERANCE) => Math.abs(a - b) > tolerance;

/**
 * Whether a tax ID is well formed: Spanish ones by their check character, foreign
 * ones only by shape. Without a country, a VAT prefix from another EU country makes
 * it foreign; anything else is taken as Spanish.
 */
function taxIdIsValid(taxId: string, country: string): boolean {
  const effective = country || countryFromVatPrefix(taxId) || SPAIN;
  return checkTaxId(taxId, effective).valid;
}

/**
 * What doesn't add up in a draft: fields an invoice needs and the model didn't
 * find, impossible values, and amounts that disagree. A ticket (simplified
 * invoice) needs neither the supplier's tax ID nor a VAT breakdown.
 */
export function checkPurchaseDraft(draft: PurchaseDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const flag = (field: string, code: DraftIssue["code"]) => issues.push({ field, code });
  const invoice = draft.kind === "invoice";

  if (!draft.supplier.name.trim()) flag("supplier.name", "missing");
  if (draft.supplier.taxId.trim()) {
    if (!taxIdIsValid(draft.supplier.taxId, draft.supplier.country)) flag("supplier.taxId", "invalid");
  } else if (invoice) flag("supplier.taxId", "missing");
  if (invoice && !draft.number.trim()) flag("number", "missing");
  if (!draft.issuedOn) flag("issuedOn", "missing");
  if (draft.currency.toUpperCase() !== "EUR") flag("currency", "invalid");

  if (invoice && draft.vatBreakdown.length === 0) flag("vatBreakdown", "missing");
  draft.vatBreakdown.forEach((line, index) => {
    const at = `vatBreakdown.${index}`;
    if (!isAmong(INVOICE_VAT_RATES, line.rate)) flag(`${at}.rate`, "invalid");
    else if (differs(line.vat, applyRate(line.base, line.rate))) flag(`${at}.vat`, "mismatch");
    if (!surchargeFitsVat(line.rate, line.surchargeRate)) flag(`${at}.surchargeRate`, "invalid");
    else if (differs(line.surcharge, applyRate(line.base, line.surchargeRate))) flag(`${at}.surcharge`, "mismatch");
  });

  const base = sumBy(draft.vatBreakdown, (line) => line.base);
  const withholding = draft.withholding;
  if (withholding) {
    if (!isAmong(Object.values(WITHHOLDING_RATES), withholding.rate)) flag("withholding.rate", "invalid");
    else if (differs(withholding.amount, applyRate(base, withholding.rate), draft.vatBreakdown.length))
      flag("withholding.amount", "mismatch");
  }

  if (draft.total === null) flag("total", "missing");
  else if (draft.vatBreakdown.length > 0) {
    const computed =
      base +
      sumBy(draft.vatBreakdown, (line) => line.vat) +
      sumBy(draft.vatBreakdown, (line) => line.surcharge) -
      (withholding?.amount ?? 0);
    if (differs(draft.total, computed, draft.vatBreakdown.length)) flag("total", "mismatch");
  }

  return issues;
}

/** The supplier with this tax ID, however either is typed. An empty tax ID matches none. */
export function findSupplierByTaxId<T extends { taxId: string }>(taxId: string, suppliers: T[]): T | undefined {
  return suppliers.find((supplier) => sameTaxId(supplier.taxId, taxId));
}

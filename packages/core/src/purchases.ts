import { roundCents } from "./invoices";

/**
 * How a received invoice is treated for VAT. Unlike sales there are imports
 * (VAT paid at customs, backed by a DUA) and no exports.
 */
export type PurchaseOperationType = "national" | "exempt" | "notSubject" | "reverseCharge" | "intraEu" | "import";

/**
 * Whether the supplier's invoice itself carries VAT. Exempt and non-subject
 * operations have none; in reverse-charge and intra-EU purchases the supplier
 * invoices without VAT and the buyer self-assesses it. Imports carry the VAT
 * paid at customs.
 */
export function purchaseCarriesVat(type: PurchaseOperationType): boolean {
  return type === "national" || type === "import";
}

/** Whole percentage between 0 and 100, as the imputation fields accept. */
export function isValidImputation(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

export interface DeductibleAmounts {
  /** Part of the taxable base that counts as an expense for income tax. */
  base: number;
  /** Part of the input VAT that can be deducted in the VAT returns. */
  vat: number;
}

/**
 * The deductible part of a received invoice. `imputation` is the share (0–100)
 * that counts for income tax; `vatImputation` the share of VAT that can be
 * deducted, which defaults to the same. They differ, for instance, for a car:
 * 0 % as an expense (it is amortized) but 50 % of its VAT.
 */
export function deductibleAmounts(
  totals: { base: number; vat: number },
  imputation: number,
  vatImputation: number | null = null,
): DeductibleAmounts {
  return {
    base: roundCents((totals.base * imputation) / 100),
    vat: roundCents((totals.vat * (vatImputation ?? imputation)) / 100),
  };
}

/** Pending (nothing paid), partial (some payments) or paid (payments cover the total). */
export type PaymentStatus = "pending" | "partial" | "paid";

export function paymentStatus(total: number, payments: number[]): PaymentStatus {
  const paid = roundCents(payments.reduce((acc, p) => acc + p, 0));
  if (paid === 0) return "pending";
  // Credit notes have a negative total: compare magnitudes
  return Math.abs(paid) >= Math.abs(roundCents(total)) ? "paid" : "partial";
}

/** What is still to be paid; never negative (overpayments leave nothing pending). */
export function amountOutstanding(total: number, payments: number[]): number {
  const outstanding = roundCents(total - payments.reduce((acc, p) => acc + p, 0));
  return Math.sign(outstanding) === Math.sign(total) ? outstanding : 0;
}

/** Spanish quarter an ISO date falls in, keyed as "2026-T3". */
function quarterKey(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return `${year}-T${Math.floor((month! - 1) / 3) + 1}`;
}

/**
 * A received invoice is booked on its issue date or later (when it arrives
 * late), but never before it was issued. VAT can be deducted up to four years
 * after; the UI only checks the order.
 */
export function isValidBookingDate(issuedOn: string, bookedOn: string): boolean {
  return bookedOn >= issuedOn;
}

/** Whether a received invoice is booked in a later quarter than it was issued. */
export function isBookedLate(issuedOn: string, bookedOn: string): boolean {
  return quarterKey(bookedOn) !== quarterKey(issuedOn);
}

/**
 * Supplier invoice numbers are unique per supplier and year: the same number
 * from another supplier, or from the same one in another year, is fine.
 */
export function isDuplicatePurchase(
  candidate: { id?: string; supplierId: string; number: string; issuedOn: string },
  existing: { id: string; supplierId: string; number: string; issuedOn: string }[],
): boolean {
  const normalize = (n: string) => n.trim().toUpperCase();
  const year = candidate.issuedOn.slice(0, 4);
  return existing.some(
    (e) =>
      e.id !== candidate.id &&
      e.supplierId === candidate.supplierId &&
      e.issuedOn.slice(0, 4) === year &&
      normalize(e.number) === normalize(candidate.number),
  );
}

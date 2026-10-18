import { applyRate, cents, eurosToCents, sumBy, type Cents } from "./money";

/** Spanish VAT rates: general, reduced, super-reduced and exempt. */
export const VAT_RATES = [0.21, 0.1, 0.04, 0] as const;

/**
 * Every VAT rate an invoice line can carry: the current ones plus the special
 * (2 %, 5 %, 7,5 %) and historical (7 %, 8 %, 16 %, 18 %) rates, ascending.
 */
export const INVOICE_VAT_RATES = [0, 0.02, 0.04, 0.05, 0.07, 0.075, 0.08, 0.1, 0.16, 0.18, 0.21] as const;

/**
 * Equivalence surcharge (recargo de equivalencia) rates, charged on top of VAT
 * to retailers under that regime. Each one pairs with a VAT rate: 5,2 % with
 * 21 %, 1,4 % with 10 %, 0,5 % with 4 %… and 1,75 % for tobacco.
 */
export const SURCHARGE_RATES = [0, 0.0026, 0.005, 0.0062, 0.01, 0.014, 0.0175, 0.052] as const;

/** IRPF withholding rates a self-employed worker can apply on an invoice. */
export const WITHHOLDING_RATES = {
  none: 0,
  /** Business activities under the module system, and livestock farming. */
  modules: 0.01,
  /** Farming. */
  farming: 0.02,
  /** Professionals in the year they start and the two following years. */
  newProfessional: 0.07,
  professional: 0.15,
  /** Rentals and returns on capital. */
  rental: 0.19,
  /** Image rights. */
  imageRights: 0.24,
  /** Reduced rates for Ceuta and Melilla. */
  ceutaNewProfessional: 0.028,
  ceutaProfessional: 0.06,
  ceutaRental: 0.076,
  /** Historical rates, for invoices issued before each change. */
  legacyCeutaNewProfessional2018: 0.035,
  legacyCeutaNewProfessional2015: 0.045,
  legacyCeutaProfessional2018: 0.075,
  legacyNewProfessional2015: 0.09,
  legacyCeutaProfessional2015: 0.095,
  legacyCeutaProfessional2014: 0.105,
  legacyRental2009: 0.18,
  legacyRental2015: 0.195,
  legacyRentalJuly2015: 0.2,
  legacyProfessional2014: 0.21,
} as const;

export type WithholdingKind = keyof typeof WITHHOLDING_RATES;

/** One line of an invoice, quote or delivery note, before VAT. */
export interface InvoiceLine {
  /** In euros, with any number of decimals (see money.ts). */
  unitPrice: number;
  quantity: number;
  /** Discount as a fraction: 0.1 is 10%. */
  discount: number;
  /** VAT rate as a fraction: 0.21 is 21%. */
  vatRate: number;
  /** Equivalence surcharge rate as a fraction; 0 when it doesn't apply. */
  surchargeRate?: number;
}

export interface VatBreakdown {
  rate: number;
  base: Cents;
  vat: Cents;
}

export interface InvoiceTotals {
  /** Taxable base (base imponible). */
  base: Cents;
  vat: Cents;
  /** Equivalence surcharge. */
  surcharge: Cents;
  /** IRPF withheld by the client. */
  withholding: Cents;
  /** Expenses paid on the client's behalf (suplidos): outside the taxable base. */
  supplies: Cents;
  /** What the client pays: base + VAT + surcharge − withholding + supplies. */
  total: Cents;
  /** Base and VAT per rate, highest rate first. Only rates in use appear. */
  vatBreakdown: VatBreakdown[];
}

/** Price times quantity, less the discount, rounded to cents. */
export function lineBase(line: InvoiceLine): Cents {
  return eurosToCents(line.unitPrice * line.quantity * (1 - line.discount));
}

/** Sums line bases per rate: VAT or surcharge are then applied on the grouped bases. */
function baseByRate(lines: InvoiceLine[], rateOf: (line: InvoiceLine) => number): Map<number, Cents> {
  const byRate = new Map<number, Cents>();
  for (const line of lines) byRate.set(rateOf(line), cents((byRate.get(rateOf(line)) ?? 0) + lineBase(line)));
  return byRate;
}

/**
 * Invoice totals. VAT and surcharge are computed per rate on the summed bases
 * (not line by line) and withholding on the whole taxable base, as the invoice
 * shows them. Supplies are added to the total without tax.
 */
export function invoiceTotals(lines: InvoiceLine[], withholdingRate = 0, supplies = cents(0)): InvoiceTotals {
  const vatBreakdown = [...baseByRate(lines, (l) => l.vatRate)]
    .sort(([a], [b]) => b - a)
    .map(([rate, base]) => ({ rate, base, vat: applyRate(base, rate) }));

  const base = sumBy(vatBreakdown, (r) => r.base);
  const vat = sumBy(vatBreakdown, (r) => r.vat);
  const surcharge = sumBy(
    baseByRate(lines, (l) => l.surchargeRate ?? 0),
    ([rate, b]) => applyRate(b, rate),
  );
  const withholding = applyRate(base, withholdingRate);
  return {
    base,
    vat,
    surcharge,
    withholding,
    supplies,
    total: cents(base + vat + surcharge - withholding + supplies),
    vatBreakdown,
  };
}

/** Adds days to an ISO date (YYYY-MM-DD), in calendar days. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + days));
  return date.toISOString().slice(0, 10);
}

/** Local calendar date as ISO (YYYY-MM-DD). */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** An unpaid invoice is overdue the day after its due date. */
export function isOverdue(dueOn: string | null, paid: boolean, today: Date): boolean {
  return !paid && dueOn !== null && dueOn < toIsoDate(today);
}

/**
 * Next number in a series: "2026-0047" → "2026-0048". The numeric suffix keeps
 * its width; a different year (or no previous number) starts the series again.
 */
export function nextDocumentNumber(prefix: string, year: number, previous: string[]): string {
  const head = `${prefix}${year}-`;
  const last = previous
    .filter((n) => n.startsWith(head) && /^\d+$/.test(n.slice(head.length)))
    .map((n) => Number(n.slice(head.length)))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${head}${String(last + 1).padStart(4, "0")}`;
}

/** How an operation is treated for VAT, which decides whether the invoice charges it. */
export type OperationType = "national" | "exempt" | "notSubject" | "reverseCharge" | "intraEu" | "export";

/**
 * Only national operations charge VAT. Exempt and non-subject ones don't; in
 * reverse-charge and intra-EU operations the client self-assesses it, and
 * exports are exempt.
 */
export function operationChargesVat(type: OperationType): boolean {
  return type === "national";
}

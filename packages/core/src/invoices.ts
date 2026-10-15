/** Spanish VAT rates: general, reduced, super-reduced and exempt. */
export const VAT_RATES = [0.21, 0.1, 0.04, 0] as const;

/** IRPF withholding rates a self-employed worker can apply on an invoice. */
export const WITHHOLDING_RATES = {
  none: 0,
  /** Professionals in the year they start and the two following years. */
  newProfessional: 0.07,
  professional: 0.15,
  /** Rentals and returns on capital. */
  rental: 0.19,
  /** Image rights. */
  imageRights: 0.24,
  /** Business activities under the module system. */
  modules: 0.01,
  /** Farming and livestock. */
  farming: 0.02,
} as const;

export type WithholdingKind = keyof typeof WITHHOLDING_RATES;

/** One line of an invoice, quote or delivery note. Amounts are in euros, before VAT. */
export interface InvoiceLine {
  unitPrice: number;
  quantity: number;
  /** Discount as a fraction: 0.1 is 10%. */
  discount: number;
  /** VAT rate as a fraction: 0.21 is 21%. */
  vatRate: number;
}

export interface VatBreakdown {
  rate: number;
  base: number;
  vat: number;
}

export interface InvoiceTotals {
  /** Taxable base (base imponible). */
  base: number;
  vat: number;
  /** IRPF withheld by the client. */
  withholding: number;
  /** What the client pays: base + VAT − withholding. */
  total: number;
  /** Base and VAT per rate, highest rate first. Only rates in use appear. */
  vatBreakdown: VatBreakdown[];
}

/** Rounds to whole cents, half away from zero. */
export function roundCents(value: number): number {
  // toPrecision drops float noise first: 1.005 * 100 is 100.49999999999999
  const cents = Math.round(Number((Math.abs(value) * 100).toPrecision(12)));
  return (Math.sign(value) * cents) / 100 || 0;
}

export function lineBase(line: InvoiceLine): number {
  return roundCents(line.unitPrice * line.quantity * (1 - line.discount));
}

/**
 * Invoice totals. VAT is computed per rate on the summed bases (not line by
 * line) and withholding on the whole taxable base, as the invoice shows them.
 */
export function invoiceTotals(lines: InvoiceLine[], withholdingRate = 0): InvoiceTotals {
  const byRate = new Map<number, number>();
  for (const line of lines) byRate.set(line.vatRate, (byRate.get(line.vatRate) ?? 0) + lineBase(line));

  const vatBreakdown = [...byRate]
    .sort(([a], [b]) => b - a)
    .map(([rate, base]) => ({ rate, base: roundCents(base), vat: roundCents(base * rate) }));

  const base = roundCents(vatBreakdown.reduce((acc, r) => acc + r.base, 0));
  const vat = roundCents(vatBreakdown.reduce((acc, r) => acc + r.vat, 0));
  const withholding = roundCents(base * withholdingRate);
  return { base, vat, withholding, total: roundCents(base + vat - withholding), vatBreakdown };
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

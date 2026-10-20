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

/** The range of dates the app accepts; date inputs use it as their min and max. */
export const MIN_DATE = "1900-01-01";
export const MAX_DATE = "2100-12-31";

/** Whether a value is a real calendar date (YYYY-MM-DD) within MIN_DATE and MAX_DATE. */
export function isSupportedDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < MIN_DATE || value > MAX_DATE) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
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

/** Invoices are numbered in normal series or, apart from them, in rectifying series. */
export type InvoiceSeriesKey = "normal" | "rectifying";

/** Characters a series mask may print besides the year and the counter; digits would blur the counter. */
const MASK_LITERAL = /^[A-Za-z/._-]+$/;

/** What makes a series mask unusable, or null when it is valid. */
export type SeriesMaskProblem = "year" | "counter" | "characters";

/**
 * Parts of a series mask: AAAA is the year, a run of # the counter with its
 * width, and anything else is printed as is ("AAAA-B-####" → "2026-B-0001").
 */
function maskParts(mask: string): {
  parts: (string | { year: true } | { counter: number })[];
  problem: SeriesMaskProblem | null;
} {
  const parts: (string | { year: true } | { counter: number })[] = [];
  let years = 0;
  let counters = 0;
  let badLiteral = false;
  for (const [run] of mask.matchAll(/A+|#+|[^A#]+/g)) {
    if (run[0] === "#") {
      counters++;
      parts.push({ counter: run.length });
    } else if (run[0] === "A" && run.length >= 4) {
      // Exactly AAAA is the year; a longer run of A's can't be read either way
      years += run.length === 4 ? 1 : 2;
      parts.push({ year: true });
    } else {
      if (!MASK_LITERAL.test(run)) badLiteral = true;
      parts.push(run);
    }
  }
  const problem =
    years !== 1 ? "year" : counters !== 1 ? "counter" : badLiteral || mask.length > 30 ? "characters" : null;
  return { parts, problem };
}

/**
 * Whether a series mask can number invoices: it holds the year (AAAA) once,
 * one counter (####), and only letters and the separators - / . _ besides.
 */
export function seriesMaskProblem(mask: string): SeriesMaskProblem | null {
  return maskParts(mask).problem;
}

/**
 * Two masks that only differ in the width of their counter number the same
 * invoices, so a series can't share the format of another one.
 */
export function sameSeriesFormat(a: string, b: string): boolean {
  return a.replace(/#+/g, "#") === b.replace(/#+/g, "#");
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

/** Year and counter of a number written with `mask`, or null when it isn't one of its numbers. */
export function parseSeriesNumber(mask: string, number: string): { year: number; counter: number } | null {
  const { parts, problem } = maskParts(mask);
  if (problem) return null;
  const groups: ("year" | "counter")[] = [];
  const source = parts
    .map((part) => {
      if (typeof part === "string") return escapeRegExp(part);
      groups.push("year" in part ? "year" : "counter");
      return "year" in part ? "(\\d{4})" : "(\\d+)";
    })
    .join("");
  const match = new RegExp(`^${source}$`).exec(number);
  if (!match) return null;
  const value = (group: "year" | "counter") => Number(match[groups.indexOf(group) + 1]);
  return { year: value("year"), counter: value("counter") };
}

/** The number `counter` of `year` in a series: ("AAAA-B-####", 2026, 1) → "2026-B-0001". */
export function formatSeriesNumber(mask: string, year: number, counter: number): string {
  return maskParts(mask)
    .parts.map((part) =>
      typeof part === "string" ? part : "year" in part ? String(year) : String(counter).padStart(part.counter, "0"),
    )
    .join("");
}

/** An invoice already issued, as numbering needs it. */
export interface IssuedInvoiceRef {
  number: string;
  issuedOn: string;
}

/**
 * Number of the next invoice of a series, from the year of its date. Invoice
 * numbers are correlative and gapless within a series and year, so only the
 * server assigns them; the app shows this one as a forecast. Every invoice
 * written with the series' mask counts, whichever series it was filed under.
 */
export function nextInvoiceNumber(mask: string, issuedOn: string, issued: IssuedInvoiceRef[]): string {
  const year = Number(issuedOn.slice(0, 4));
  const last = issued
    .map((invoice) => parseSeriesNumber(mask, invoice.number))
    .filter((parsed) => parsed?.year === year)
    .reduce((max, parsed) => Math.max(max, parsed!.counter), 0);
  return formatSeriesNumber(mask, year, last + 1);
}

/**
 * The latest invoice of the same series and year dated after `issuedOn`, if
 * any. Numbers must follow the dates, so a new invoice can't be issued with an
 * earlier date than one that already has a lower number.
 */
export function laterInvoiceInSeries<T extends IssuedInvoiceRef>(
  mask: string,
  issuedOn: string,
  issued: T[],
): T | undefined {
  const year = issuedOn.slice(0, 4);
  return issued
    .filter((invoice) => invoice.issuedOn.slice(0, 4) === year && parseSeriesNumber(mask, invoice.number))
    .filter((invoice) => invoice.issuedOn > issuedOn)
    .reduce<T | undefined>(
      (latest, invoice) => (!latest || invoice.issuedOn > latest.issuedOn ? invoice : latest),
      undefined,
    );
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

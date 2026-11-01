import { invoiceTotals, type InvoiceLine } from "./invoices";
import { cents, sumBy, type Cents } from "./money";

/*
 * Rectifying invoices (facturas rectificativas) of art. 15 RD 1619/2012 and
 * art. 80 LIVA, with the causes and methods the VERI*FACTU record names
 * (Orden HAC/1177/2024 and SuministroInformacion.xsd: ClaveTipoFacturaType,
 * ClaveTipoRectificativaType).
 */

/**
 * Why an invoice is rectified, as the record's TipoFactura names it. R1: an
 * error founded in law or the causes of art. 80.1, 80.2 and 80.6 LIVA (returns,
 * discounts after the sale, price changes). R2: the client's insolvency
 * proceedings (art. 80.3). R3: unpaid debts (art. 80.4). R4: any other cause.
 * R5, for simplified invoices, isn't used: cuentalibre only issues full ones.
 */
export const RECTIFICATION_REASONS = ["R1", "R2", "R3", "R4"] as const;
export type RectificationReason = (typeof RECTIFICATION_REASONS)[number];

/**
 * How a rectifying invoice corrects the original: by differences (TipoRectificativa
 * I), recording only the change, or by substitution (S), replacing it with the
 * corrected invoice.
 */
export const RECTIFICATION_METHODS = ["differences", "substitution"] as const;
export type RectificationMethod = (typeof RECTIFICATION_METHODS)[number];

export interface Rectification {
  reason: RectificationReason;
  method: RectificationMethod;
}

/** What a rectifying invoice issued without saying how was taken to be: R1 by differences. */
export const DEFAULT_RECTIFICATION: Rectification = { reason: "R1", method: "differences" };

/*
 * cuentalibre books every rectifying invoice as the change it makes, so taxes,
 * books and collections add it up like any other. One by substitution stores
 * the original's lines reversed, then the corrected lines: together they are
 * the change, and the corrected lines alone are the invoice that replaces the
 * original, as printed and as recorded.
 */

/** A line with its quantity reversed, so it cancels the original. */
export function reversedLine<L extends InvoiceLine>(line: L): L {
  return { ...line, quantity: -line.quantity };
}

const sameLine = (a: InvoiceLine, b: InvoiceLine) =>
  a.unitPrice === b.unitPrice &&
  a.quantity === b.quantity &&
  a.discount === b.discount &&
  a.vatRate === b.vatRate &&
  (a.surchargeRate ?? 0) === (b.surchargeRate ?? 0);

/** The lines of a substitution: the original's reversed, then the corrected ones. */
export function substitutionLines<L extends InvoiceLine>(original: readonly L[], corrected: readonly L[]): L[] {
  return [...original.map(reversedLine), ...corrected];
}

/**
 * The corrected lines of a substitution, or null when its lines don't start
 * by reversing every line of the original.
 */
export function correctedLines<L extends InvoiceLine>(
  lines: readonly L[],
  original: readonly InvoiceLine[],
): L[] | null {
  if (lines.length < original.length) return null;
  const reverses = original.every((line, i) => sameLine(lines[i]!, reversedLine(line)));
  return reverses ? lines.slice(original.length) : null;
}

/*
 * One original may have several rectifying invoices by differences (a partial
 * return, a later discount…), but never rectified past zero. Rectifying
 * invoices always correct the original: undoing one is another rectifying
 * invoice of the original, with its lines reversed.
 */

/** A line as rectifications net it: with a positive price, so a reversed price and a reversed quantity match. */
const netted = <L extends InvoiceLine>(line: L): L =>
  line.unitPrice < 0 ? { ...line, unitPrice: -line.unitPrice, quantity: -line.quantity } : line;

const nettingKey = (line: InvoiceLine & { concept?: string }) =>
  JSON.stringify([line.concept ?? "", line.unitPrice, line.discount, line.vatRate, line.surchargeRate ?? 0]);

/**
 * What's left of the original once its rectifying invoices are added in, line
 * by line: lines with the same concept, price, discount and rates add their
 * quantities, and those that come to zero drop out.
 */
export function unrectifiedLines<L extends InvoiceLine & { concept?: string }>(
  original: readonly L[],
  rectifying: readonly (readonly L[])[],
): L[] {
  const byKey = new Map<string, L>();
  for (const line of [...original, ...rectifying.flat()].map(netted)) {
    const key = nettingKey(line);
    const seen = byKey.get(key);
    // Quantities take up to a few decimals; rounding keeps 0,1 + 0,2 − 0,3 at zero
    const quantity = Math.round(((seen?.quantity ?? 0) + line.quantity) * 1e6) / 1e6;
    byKey.set(key, { ...(seen ?? line), quantity });
  }
  return [...byKey.values()].filter((line) => line.quantity !== 0);
}

/** Base, VAT and surcharge left of an original per VAT rate, as each invoice books them. */
interface NetByRate {
  rate: number;
  base: Cents;
  vat: Cents;
  surcharge: Cents;
}

function netByRate(invoices: readonly (readonly InvoiceLine[])[]): NetByRate[] {
  const byRate = new Map<number, NetByRate>();
  for (const lines of invoices)
    for (const rate of new Set(lines.map((l) => l.vatRate))) {
      const atRate = lines.filter((l) => l.vatRate === rate);
      const totals = invoiceTotals(atRate);
      const net = byRate.get(rate) ?? { rate, base: cents(0), vat: cents(0), surcharge: cents(0) };
      byRate.set(rate, {
        rate,
        base: cents(net.base + totals.base),
        vat: cents(net.vat + totals.vat),
        surcharge: cents(net.surcharge + totals.surcharge),
      });
    }
  return [...byRate.values()];
}

/** The sign each VAT rate of an original keeps: its own, or that of the whole base for a rate it doesn't use. */
function signOf(original: readonly InvoiceLine[]) {
  const own = netByRate([original]);
  const overall = sumBy(own, (n) => n.base) < 0 ? -1 : 1;
  return (rate: number) => {
    const base = own.find((n) => n.rate === rate)?.base;
    return base ? Math.sign(base) : overall;
  };
}

/**
 * Whether the rectifying invoices leave nothing of the original: no base at
 * any rate, or less than nothing where earlier ones already took it past zero.
 * Its VAT and surcharge follow, up to each invoice's rounding.
 */
export function fullyRectified(original: readonly InvoiceLine[], rectifying: readonly (readonly InvoiceLine[])[]) {
  const sign = signOf(original);
  return netByRate([original, ...rectifying]).every((n) => n.base * sign(n.rate) <= 0);
}

/**
 * Whether the rectifying invoices take the original past zero: at some VAT
 * rate its base, VAT or surcharge changes sign. A rate the original doesn't
 * use takes the sign of its whole base, so a negative original goes up to zero.
 * Each invoice rounds its own VAT and surcharge, so they may overshoot by a
 * cent per rectifying invoice once the base is back to zero.
 */
export function rectifiedPastZero(original: readonly InvoiceLine[], rectifying: readonly (readonly InvoiceLine[])[]) {
  const sign = signOf(original);
  const rounding = rectifying.length;
  return netByRate([original, ...rectifying]).some(
    (n) => n.base * sign(n.rate) < 0 || n.vat * sign(n.rate) < -rounding || n.surcharge * sign(n.rate) < -rounding,
  );
}

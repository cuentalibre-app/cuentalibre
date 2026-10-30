import type { InvoiceLine } from "./invoices";

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

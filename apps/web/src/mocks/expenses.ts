import { GENERAL_VAT_RATE, roundCents } from "@fiscalia/core";

/**
 * Sample expenses until there is a purchases section. Every expense is
 * assumed to carry 21% deductible VAT.
 */
export interface Expense {
  id: string;
  supplier: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Taxable base, before VAT. */
  base: number;
  vat: number;
}

/** Monthly expense bases (January first); null for months not booked yet. */
const MONTHLY: Record<number, (number | null)[]> = {
  2025: [1200, 600, 650, 900, 700, 800, 850, 600, 1000, 900, 750, 1100],
  2026: [1400, 700, 750, 1100, 800, 1020, 900, 650, 1350, 310, null, null],
};

/** Share of each month's expenses per supplier. */
const SUPPLIER_SHARES: Record<string, number> = {
  "Coworking La Nave S.L.": 0.34,
  "Adobe Systems Software Ireland": 0.16,
  "Amazon Web Services EMEA": 0.13,
  "Gestoría Arce": 0.12,
  "Telefónica de España": 0.1,
  "Apple Distribution International": 0.08,
  "Correos y Telégrafos": 0.04,
  "Papelería Central": 0.03,
};

export const expenses: Expense[] = Object.entries(MONTHLY).flatMap(([year, months]) =>
  months.flatMap((total, m) => {
    if (total == null) return [];
    const date = `${year}-${String(m + 1).padStart(2, "0")}-05`;
    return Object.entries(SUPPLIER_SHARES).map(([supplier, share], i): Expense => {
      const base = roundCents(total * share);
      return { id: `e-${date}-${i}`, supplier, date, base, vat: roundCents(base * GENERAL_VAT_RATE) };
    });
  }),
);

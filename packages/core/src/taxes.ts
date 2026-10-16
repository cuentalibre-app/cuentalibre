import { periodMonths, type Period } from "./period";

/** General Spanish VAT rate. */
export const GENERAL_VAT_RATE = 0.21;

/** Rate applied to cumulative net income in form 130 (direct estimation). */
export const IRPF_INSTALLMENT_RATE = 0.2;

/**
 * Flat rate used for the "how much is yours" estimate. Real IRPF is
 * progressive and settled yearly (form 100); this is only a rough guide.
 */
export const ROUGH_INCOME_TAX_RATE = 0.2;

/** Bookkeeping totals for one month. Amounts are in euros, before VAT. */
export interface MonthTotals {
  income: number;
  expenses: number;
  /** VAT charged on issued invoices (IVA repercutido). */
  outputVat: number;
  /** Deductible VAT paid on expenses (IVA soportado). */
  inputVat: number;
  /** IRPF withheld by clients on issued invoices. */
  withholdings: number;
}

/** Twelve months of a year; null for months without data yet. */
export type YearTotals = (MonthTotals | null)[];

export const EMPTY_TOTALS: MonthTotals = { income: 0, expenses: 0, outputVat: 0, inputVat: 0, withholdings: 0 };

export function sumTotals(months: (MonthTotals | null | undefined)[]): MonthTotals {
  return months.reduce<MonthTotals>(
    (acc, m) =>
      m
        ? {
            income: acc.income + m.income,
            expenses: acc.expenses + m.expenses,
            outputVat: acc.outputVat + m.outputVat,
            inputVat: acc.inputVat + m.inputVat,
            withholdings: acc.withholdings + m.withholdings,
          }
        : acc,
    EMPTY_TOTALS,
  );
}

export function periodTotals(year: YearTotals, period: Period): MonthTotals {
  return sumTotals(periodMonths(period).map((m) => year[m]));
}

/** Rough split of what was invoiced (before VAT) into take-home, income tax and expenses. */
export function takeHomeEstimate(totals: MonthTotals) {
  const profit = totals.income - totals.expenses;
  const incomeTax = Math.max(0, ROUGH_INCOME_TAX_RATE * profit);
  return { profit, incomeTax, takeHome: profit - incomeTax };
}

import { applyRate, cents, type Cents } from "./money";
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

/** Bookkeeping totals for one month, before VAT. */
export interface MonthTotals {
  income: Cents;
  expenses: Cents;
  /** VAT charged on issued invoices (IVA repercutido). */
  outputVat: Cents;
  /** Deductible VAT paid on expenses (IVA soportado). */
  inputVat: Cents;
  /** IRPF withheld by clients on issued invoices. */
  withholdings: Cents;
}

/** Twelve months of a year; null for months without data yet. */
export type YearTotals = (MonthTotals | null)[];

export const EMPTY_TOTALS: MonthTotals = {
  income: cents(0),
  expenses: cents(0),
  outputVat: cents(0),
  inputVat: cents(0),
  withholdings: cents(0),
};

export function sumTotals(months: (MonthTotals | null | undefined)[]): MonthTotals {
  return months.reduce<MonthTotals>(
    (acc, m) =>
      m
        ? {
            income: cents(acc.income + m.income),
            expenses: cents(acc.expenses + m.expenses),
            outputVat: cents(acc.outputVat + m.outputVat),
            inputVat: cents(acc.inputVat + m.inputVat),
            withholdings: cents(acc.withholdings + m.withholdings),
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
  const profit = cents(totals.income - totals.expenses);
  const incomeTax = applyRate(cents(Math.max(0, profit)), ROUGH_INCOME_TAX_RATE);
  return { profit, incomeTax, takeHome: cents(profit - incomeTax) };
}

import { periodMonths, type Period, type Quarter } from "./period";

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

/** Form 303 result: positive to pay, negative to offset in later quarters. */
export function vatSettlement(totals: MonthTotals): number {
  return totals.outputVat - totals.inputVat;
}

/**
 * Form 130 installment for each quarter of a year.
 *
 * Each installment is 20% of the net income accumulated since January, minus
 * withholdings accumulated since January, minus the installments already paid
 * that year. It can't be negative.
 */
export function irpfInstallments(year: YearTotals): Record<Quarter, number> {
  const result = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<Quarter, number>;
  let paid = 0;
  for (const quarter of [1, 2, 3, 4] as const) {
    const ytd = sumTotals(year.slice(0, quarter * 3));
    const due = IRPF_INSTALLMENT_RATE * (ytd.income - ytd.expenses) - ytd.withholdings - paid;
    result[quarter] = Math.max(0, due);
    paid += result[quarter];
  }
  return result;
}

/** Form 130 amount for a period: one installment, or the sum of the year's four. */
export function irpfInstallmentForPeriod(year: YearTotals, period: Period): number {
  const installments = irpfInstallments(year);
  if (period.quarter !== null) return installments[period.quarter];
  return installments[1] + installments[2] + installments[3] + installments[4];
}

/** Rough split of what was invoiced (before VAT) into take-home, income tax and expenses. */
export function takeHomeEstimate(totals: MonthTotals) {
  const profit = totals.income - totals.expenses;
  const incomeTax = Math.max(0, ROUGH_INCOME_TAX_RATE * profit);
  return { profit, incomeTax, takeHome: profit - incomeTax };
}

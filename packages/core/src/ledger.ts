import { periodMonths, type Period } from "./period";
import { EMPTY_TOTALS, type MonthTotals, type YearTotals } from "./taxes";

/** One booked document: an issued invoice (income) or an expense. Amounts are in euros. */
export interface LedgerEntry {
  /** ISO date (YYYY-MM-DD) the entry is booked on. */
  date: string;
  /** Taxable base, before VAT. */
  base: number;
  vat: number;
  /** IRPF withheld by the client; only issued invoices carry it. */
  withholding: number;
}

function yearAndMonth(isoDate: string): [year: number, month: number] {
  const [year, month] = isoDate.split("-").map(Number);
  return [year!, month! - 1];
}

/** Whether an ISO date falls inside the period. */
export function isInPeriod(isoDate: string, period: Period): boolean {
  const [year, month] = yearAndMonth(isoDate);
  return year === period.year && periodMonths(period).includes(month);
}

/**
 * Monthly totals of a year, built from issued invoices and expenses. Months
 * after `today` with nothing booked are null (no data yet); earlier months
 * without entries are zero.
 */
export function ledgerYearTotals(
  year: number,
  income: LedgerEntry[],
  expenses: LedgerEntry[],
  today: Date,
): YearTotals {
  const currentMonth = today.getFullYear() * 12 + today.getMonth();
  const months: (MonthTotals | null)[] = Array.from({ length: 12 }, (_, m) =>
    year * 12 + m > currentMonth ? null : { ...EMPTY_TOTALS },
  );

  const book = (entries: LedgerEntry[], apply: (month: MonthTotals, entry: LedgerEntry) => void) => {
    for (const entry of entries) {
      const [y, m] = yearAndMonth(entry.date);
      if (y !== year) continue;
      apply((months[m] ??= { ...EMPTY_TOTALS }), entry);
    }
  };

  book(income, (month, e) => {
    month.income += e.base;
    month.outputVat += e.vat;
    month.withholdings += e.withholding;
  });
  book(expenses, (month, e) => {
    month.expenses += e.base;
    month.inputVat += e.vat;
  });

  return months;
}

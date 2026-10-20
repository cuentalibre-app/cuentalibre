import { applyRate, cents, type Cents } from "./money";
import { hardToJustify } from "./tax-returns";
import { sumTotals, type YearTotals } from "./taxes";

/*
 * Rough estimate of the yearly income tax (IRPF) owed on the activity, to tell
 * how much of the profit is really yours. It is not the yearly return: it uses
 * the state scale doubled as a stand-in for state + regional scales (regions
 * stay within a point or two of it) and ignores personal and regional
 * deductions, other income and the reduction for low incomes.
 */

export interface TaxBracket {
  /** Upper limit of the bracket; null for the last one. */
  upTo: Cents | null;
  rate: number;
}

/** General state scale (art. 63 LIRPF) doubled: state + an average regional scale. */
export const INCOME_TAX_BRACKETS: readonly TaxBracket[] = [
  { upTo: cents(1_245_000), rate: 0.19 },
  { upTo: cents(2_020_000), rate: 0.24 },
  { upTo: cents(3_520_000), rate: 0.3 },
  { upTo: cents(6_000_000), rate: 0.37 },
  { upTo: cents(30_000_000), rate: 0.45 },
  { upTo: null, rate: 0.47 },
];

/** General personal allowance (mínimo personal, art. 57 LIRPF): taxed at 0 %. */
export const PERSONAL_ALLOWANCE = cents(555_000);

/** Tax of a base on the progressive scale. */
export function scaleTax(base: Cents): Cents {
  let tax = 0;
  let from = 0;
  for (const { upTo, rate } of INCOME_TAX_BRACKETS) {
    if (base <= from) break;
    const top = upTo === null ? base : Math.min(base, upTo);
    tax += (top - from) * rate;
    from = upTo ?? base;
  }
  return cents(Math.round(tax));
}

/** Yearly income tax on a net income: the scale on it minus the scale on the personal allowance. */
export function incomeTaxOn(netIncome: Cents): Cents {
  if (netIncome <= 0) return cents(0);
  return cents(scaleTax(netIncome) - scaleTax(cents(Math.min(netIncome, PERSONAL_ALLOWANCE))));
}

export interface IncomeTaxEstimate {
  /** Profit of the year (income − expenses), projected to twelve months. */
  projectedProfit: Cents;
  /** Net income of the activity: the projected profit minus the hard-to-justify expenses. */
  projectedNet: Cents;
  /** Estimated income tax of the whole year. */
  tax: Cents;
  /** Tax over profit, to apply to any period of the year. */
  rate: number;
}

/**
 * The year's income tax, projected from the months elapsed (the non-null ones) when the year is
 * still going. Its rate over the profit spreads it over a quarter or a month.
 */
export function estimateIncomeTax(year: YearTotals, calendarYear: number, simplified: boolean): IncomeTaxEstimate {
  const elapsed = year.filter((m) => m !== null).length;
  const totals = sumTotals(year);
  const profit = totals.income - totals.expenses;
  const projectedProfit = cents(elapsed ? Math.round((profit * 12) / elapsed) : 0);
  const extra = simplified ? hardToJustify(projectedProfit, calendarYear) : cents(0);
  const projectedNet = cents(projectedProfit - extra);
  const tax = incomeTaxOn(projectedNet);
  return { projectedProfit, projectedNet, tax, rate: projectedProfit > 0 ? tax / projectedProfit : 0 };
}

/** Split of what was invoiced (before VAT) into take-home, income tax and expenses, at a tax rate over profit. */
export function takeHomeEstimate(totals: { income: Cents; expenses: Cents }, rate: number) {
  const profit = cents(totals.income - totals.expenses);
  const incomeTax = applyRate(cents(Math.max(0, profit)), rate);
  return { profit, incomeTax, takeHome: cents(profit - incomeTax) };
}

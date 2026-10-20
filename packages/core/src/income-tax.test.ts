import { describe, expect, it } from "vitest";
import { estimateIncomeTax, incomeTaxOn, scaleTax, takeHomeEstimate } from "./income-tax";
import { eurosToCents as eur } from "./money";
import { EMPTY_TOTALS, type MonthTotals, type YearTotals } from "./taxes";

const month = (income: number, expenses: number): MonthTotals => ({
  ...EMPTY_TOTALS,
  income: eur(income),
  expenses: eur(expenses),
});

describe("scaleTax", () => {
  it("taxes each bracket at its own rate", () => {
    expect(scaleTax(eur(10_000))).toBe(eur(1_900));
    // 12.450 × 19 % + 7.750 × 24 % + 4.800 × 30 %
    expect(scaleTax(eur(25_000))).toBe(eur(2_365.5 + 1_860 + 1_440));
  });

  it("keeps the top rate above the last limit", () => {
    expect(scaleTax(eur(400_000)) - scaleTax(eur(300_000))).toBe(eur(47_000));
  });
});

describe("incomeTaxOn", () => {
  it("leaves the personal allowance untaxed", () => {
    expect(incomeTaxOn(eur(5_000))).toBe(0);
    expect(incomeTaxOn(eur(10_000))).toBe(eur(1_900 - 1_054.5));
  });

  it("grows faster than income", () => {
    const rate = (net: number) => incomeTaxOn(eur(net)) / eur(net);
    expect(rate(20_000)).toBeLessThan(rate(50_000));
    expect(rate(50_000)).toBeCloseTo(0.263, 3);
    expect(rate(100_000)).toBeLessThan(0.47);
  });

  it("is zero for losses", () => {
    expect(incomeTaxOn(eur(-1_000))).toBe(0);
  });
});

describe("estimateIncomeTax", () => {
  const year = (months: (MonthTotals | null)[]): YearTotals => [
    ...months,
    ...Array<null>(12 - months.length).fill(null),
  ];

  it("projects a year still going to twelve months", () => {
    const estimate = estimateIncomeTax(year(Array(6).fill(month(2_500, 0))), 2026, false);
    expect(estimate.projectedProfit).toBe(eur(30_000));
    expect(estimate.tax).toBe(incomeTaxOn(eur(30_000)));
  });

  it("subtracts the hard-to-justify expenses in simplified direct estimation", () => {
    const estimate = estimateIncomeTax(year(Array(12).fill(month(5_000, 0))), 2026, true);
    expect(estimate.projectedNet).toBe(eur(58_000));
    expect(estimate.rate).toBeCloseTo(incomeTaxOn(eur(58_000)) / eur(60_000));
  });

  it("has no rate without profit", () => {
    expect(estimateIncomeTax(year([month(100, 500)]), 2026, true)).toMatchObject({ tax: 0, rate: 0 });
    expect(estimateIncomeTax(year([]), 2026, true).rate).toBe(0);
  });
});

describe("takeHomeEstimate", () => {
  it("applies the rate to the profit", () => {
    expect(takeHomeEstimate(month(3_000, 1_000), 0.25)).toEqual({
      profit: eur(2_000),
      incomeTax: eur(500),
      takeHome: eur(1_500),
    });
  });

  it("doesn't apply income tax to losses", () => {
    expect(takeHomeEstimate(month(1_000, 3_000), 0.25)).toEqual({
      profit: eur(-2_000),
      incomeTax: 0,
      takeHome: eur(-2_000),
    });
  });
});

import { describe, expect, it } from "vitest";
import { periodTotals, takeHomeEstimate, type MonthTotals, type YearTotals } from "./taxes";
import { applyRate, eurosToCents as eur } from "./money";

const month = (income: number, expenses: number, withholdings = 0): MonthTotals => ({
  income: eur(income),
  expenses: eur(expenses),
  outputVat: applyRate(eur(income), 0.21),
  inputVat: applyRate(eur(expenses), 0.21),
  withholdings: eur(withholdings),
});

describe("periodTotals", () => {
  it("ignores months without data", () => {
    const year: YearTotals = [
      month(100, 10),
      null,
      month(200, 20),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ];
    expect(periodTotals(year, { year: 2026, quarter: 1 }).income).toBe(eur(300));
  });
});

describe("takeHomeEstimate", () => {
  it("applies the rough income tax rate to the profit", () => {
    expect(takeHomeEstimate(month(3_000, 1_000))).toEqual({
      profit: eur(2_000),
      incomeTax: eur(400),
      takeHome: eur(1_600),
    });
  });

  it("doesn't apply income tax to losses", () => {
    expect(takeHomeEstimate(month(1_000, 3_000))).toEqual({ profit: eur(-2_000), incomeTax: 0, takeHome: eur(-2_000) });
  });
});

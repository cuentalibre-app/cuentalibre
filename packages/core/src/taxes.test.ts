import { describe, expect, it } from "vitest";
import { periodTotals, type MonthTotals, type YearTotals } from "./taxes";
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

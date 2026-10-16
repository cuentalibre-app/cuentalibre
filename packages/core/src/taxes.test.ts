import { describe, expect, it } from "vitest";
import {
  periodTotals,
  takeHomeEstimate,
  type MonthTotals,
  type YearTotals,
} from "./taxes";

const month = (income: number, expenses: number, withholdings = 0): MonthTotals => ({
  income,
  expenses,
  outputVat: income * 0.21,
  inputVat: expenses * 0.21,
  withholdings,
});

describe("periodTotals", () => {
  it("ignores months without data", () => {
    const year: YearTotals = [month(100, 10), null, month(200, 20), null, null, null, null, null, null, null, null, null];
    expect(periodTotals(year, { year: 2026, quarter: 1 }).income).toBe(300);
  });
});

describe("takeHomeEstimate", () => {
  it("doesn't apply income tax to losses", () => {
    expect(takeHomeEstimate(month(1_000, 3_000))).toEqual({ profit: -2_000, incomeTax: 0, takeHome: -2_000 });
  });
});

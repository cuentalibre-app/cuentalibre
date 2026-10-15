import { describe, expect, it } from "vitest";
import {
  irpfInstallmentForPeriod,
  irpfInstallments,
  periodTotals,
  takeHomeEstimate,
  vatSettlement,
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

describe("vatSettlement", () => {
  it("is output VAT minus input VAT", () => {
    expect(vatSettlement(month(10_000, 2_000))).toBeCloseTo(1_680);
  });

  it("is negative when there is VAT to offset", () => {
    expect(vatSettlement(month(1_000, 3_000))).toBeCloseTo(-420);
  });
});

describe("irpfInstallments", () => {
  it("applies 20% to cumulative net income minus what was already paid", () => {
    // 4,000 € net income per quarter
    const year: YearTotals = Array.from({ length: 12 }, () => month(2_000, 666.666_666_666_666_7));
    const result = irpfInstallments(year);
    expect(result[1]).toBeCloseTo(800);
    expect(result[2]).toBeCloseTo(800);
    expect(result[3]).toBeCloseTo(800);
    expect(result[4]).toBeCloseTo(800);
  });

  it("never returns a negative installment and recovers losses later in the year", () => {
    const year: YearTotals = [
      ...Array.from({ length: 3 }, () => month(5_000, 0)), // Q1: +15,000 → 3,000
      ...Array.from({ length: 3 }, () => month(0, 5_000)), // Q2: −15,000 → 0
      ...Array.from({ length: 3 }, () => month(10_000, 0)), // Q3: YTD 30,000 → 6,000 − 3,000 paid
      null,
      null,
      null,
    ];
    const result = irpfInstallments(year);
    expect(result[1]).toBeCloseTo(3_000);
    expect(result[2]).toBe(0);
    expect(result[3]).toBeCloseTo(3_000);
    expect(result[4]).toBeCloseTo(0);
  });

  it("subtracts withholdings", () => {
    const year: YearTotals = [month(10_000, 0, 1_500), null, null, null, null, null, null, null, null, null, null, null];
    expect(irpfInstallments(year)[1]).toBeCloseTo(500);
  });

  it("sums the four installments for a whole year", () => {
    const year: YearTotals = Array.from({ length: 12 }, () => month(1_000, 0));
    expect(irpfInstallmentForPeriod(year, { year: 2026, quarter: null })).toBeCloseTo(2_400);
  });
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

import { describe, expect, it } from "vitest";
import { isInPeriod, ledgerYearTotals, type LedgerEntry } from "./ledger";
import { applyRate, eurosToCents as eur } from "./money";

const entry = (date: string, base: number, vat = applyRate(eur(base), 0.21) / 100, withholding = 0): LedgerEntry => ({
  date,
  base: eur(base),
  vat: eur(vat),
  withholding: eur(withholding),
});

describe("isInPeriod", () => {
  it("matches dates inside the quarter", () => {
    expect(isInPeriod("2026-07-01", { year: 2026, quarter: 3 })).toBe(true);
    expect(isInPeriod("2026-09-30", { year: 2026, quarter: 3 })).toBe(true);
    expect(isInPeriod("2026-10-01", { year: 2026, quarter: 3 })).toBe(false);
  });

  it("matches the whole year when there is no quarter", () => {
    expect(isInPeriod("2026-12-31", { year: 2026, quarter: null })).toBe(true);
    expect(isInPeriod("2025-12-31", { year: 2026, quarter: null })).toBe(false);
  });
});

describe("ledgerYearTotals", () => {
  const today = new Date(2026, 9, 15);

  it("adds income and expenses into their month", () => {
    const year = ledgerYearTotals(
      2026,
      [entry("2026-03-02", 1000, 210, 150), entry("2026-03-20", 500, 0, 0)],
      [entry("2026-03-10", 200, 42)],
      today,
    );
    expect(year[2]).toEqual({
      income: eur(1500),
      expenses: eur(200),
      outputVat: eur(210),
      inputVat: eur(42),
      withholdings: eur(150),
    });
  });

  it("ignores entries from other years", () => {
    const year = ledgerYearTotals(2026, [entry("2025-03-02", 1000)], [], today);
    expect(year[2]?.income).toBe(0);
  });

  it("leaves future months without entries empty and past ones at zero", () => {
    const year = ledgerYearTotals(2026, [], [], today);
    expect(year[0]).toEqual({ income: 0, expenses: 0, outputVat: 0, inputVat: 0, withholdings: 0 });
    expect(year[9]).not.toBeNull();
    expect(year[10]).toBeNull();
    expect(ledgerYearTotals(2027, [], [], today).every((m) => m === null)).toBe(true);
  });

  it("books future-dated entries anyway", () => {
    const year = ledgerYearTotals(2026, [entry("2026-11-02", 800)], [], today);
    expect(year[11]).toBeNull();
    expect(year[10]?.income).toBe(eur(800));
  });
});

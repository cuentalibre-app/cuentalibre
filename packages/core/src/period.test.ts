import { describe, expect, it } from "vitest";
import { defaultPeriod, parsePeriod, periodKey, periodMonths, previousPeriod } from "./period";

describe("parsePeriod / periodKey", () => {
  it("round-trips quarters and years", () => {
    expect(parsePeriod("2026-T3")).toEqual({ year: 2026, quarter: 3 });
    expect(parsePeriod("2026")).toEqual({ year: 2026, quarter: null });
    expect(periodKey({ year: 2026, quarter: 3 })).toBe("2026-T3");
    expect(periodKey({ year: 2026, quarter: null })).toBe("2026");
  });

  it("rejects invalid keys", () => {
    expect(parsePeriod("2026-T5")).toBeNull();
    expect(parsePeriod("T3")).toBeNull();
    expect(parsePeriod("")).toBeNull();
  });
});

describe("periodMonths", () => {
  it("returns the three months of a quarter", () => {
    expect(periodMonths({ year: 2026, quarter: 4 })).toEqual([9, 10, 11]);
  });

  it("returns every month for a year", () => {
    expect(periodMonths({ year: 2026, quarter: null })).toHaveLength(12);
  });
});

describe("previousPeriod", () => {
  it("wraps Q1 to Q4 of the previous year", () => {
    expect(previousPeriod({ year: 2026, quarter: 1 })).toEqual({ year: 2025, quarter: 4 });
  });

  it("goes back one year for yearly periods", () => {
    expect(previousPeriod({ year: 2026, quarter: null })).toEqual({ year: 2025, quarter: null });
  });
});

describe("defaultPeriod", () => {
  it("keeps the previous quarter while it can still be filed", () => {
    expect(defaultPeriod(new Date(2026, 9, 15))).toEqual({ year: 2026, quarter: 3 });
    expect(defaultPeriod(new Date(2026, 9, 20))).toEqual({ year: 2026, quarter: 3 });
  });

  it("switches to the current quarter after the deadline", () => {
    expect(defaultPeriod(new Date(2026, 9, 21))).toEqual({ year: 2026, quarter: 4 });
    expect(defaultPeriod(new Date(2026, 10, 3))).toEqual({ year: 2026, quarter: 4 });
  });

  it("gives Q4 until January 30th", () => {
    expect(defaultPeriod(new Date(2027, 0, 25))).toEqual({ year: 2026, quarter: 4 });
    expect(defaultPeriod(new Date(2027, 0, 31))).toEqual({ year: 2027, quarter: 1 });
  });
});

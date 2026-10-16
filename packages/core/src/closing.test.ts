import { describe, expect, it } from "vitest";
import { lockedQuarter, numberingGaps, quarterOfDate } from "./closing";

describe("quarterOfDate", () => {
  it("maps a date to its quarter", () => {
    expect(quarterOfDate("2026-03-31")).toEqual({ year: 2026, quarter: 1 });
    expect(quarterOfDate("2026-10-01")).toEqual({ year: 2026, quarter: 4 });
  });
});

describe("lockedQuarter", () => {
  const closed = new Set(["2026-T2"]);

  it("returns the closed quarter a date falls in", () => {
    expect(lockedQuarter("2026-06-30", closed)).toEqual({ year: 2026, quarter: 2 });
  });

  it("is null for open quarters and empty dates", () => {
    expect(lockedQuarter("2026-07-01", closed)).toBeNull();
    expect(lockedQuarter("", closed)).toBeNull();
  });
});

describe("numberingGaps", () => {
  it("lists missing numbers between the lowest and the highest", () => {
    expect(numberingGaps(["2026-0004", "2026-0001", "2026-0002"])).toEqual(["2026-0003"]);
    // A series that goes on from last year doesn't start at 1
    expect(numberingGaps(["2026-0026", "2026-0028"])).toEqual(["2026-0027"]);
  });

  it("checks each series on its own", () => {
    expect(numberingGaps(["2026-0001", "2026-0003", "R-2026-0001", "R-2026-0002"])).toEqual(["2026-0002"]);
  });

  it("ignores numbers without a numeric suffix", () => {
    expect(numberingGaps(["ABC", "2026-0001"])).toEqual([]);
  });
});

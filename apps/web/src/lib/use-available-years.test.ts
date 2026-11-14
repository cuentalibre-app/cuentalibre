import { describe, expect, it } from "vitest";
import { yearsWithData } from "./use-available-years";

describe("yearsWithData", () => {
  const today = new Date(2026, 10, 14);

  it("offers the current year when there is no data", () => {
    expect(yearsWithData([], today)).toEqual([2026]);
  });

  it("lists every year with records, newest first and without repeats", () => {
    expect(yearsWithData(["2019-03-01", "2024-12-31", "2019-07-15", "2026-01-02"], today)).toEqual([
      2026, 2024, 2019,
    ]);
  });
});

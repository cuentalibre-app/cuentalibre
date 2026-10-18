import { describe, expect, it } from "vitest";
import { applyRate, cents, centsToEuros, eurosToCents, roundHundredths, sumBy, sumCents } from "./money";

describe("cents", () => {
  it("rounds to whole cents, half away from zero", () => {
    expect(cents(100.5)).toBe(101);
    expect(cents(-100.5)).toBe(-101);
    expect(cents(234.4)).toBe(234);
    expect(Object.is(cents(-0.2), 0)).toBe(true);
  });
});

describe("eurosToCents", () => {
  it("converts decimal euros without float noise", () => {
    expect(eurosToCents(1.005)).toBe(101);
    expect(eurosToCents(-1.005)).toBe(-101);
    expect(eurosToCents(0.1 + 0.2)).toBe(30);
    expect(eurosToCents(1_234.56)).toBe(123_456);
  });

  it("round-trips with centsToEuros", () => {
    expect(centsToEuros(eurosToCents(4_876.15))).toBe(4_876.15);
  });
});

describe("applyRate", () => {
  it("rounds the result to cents", () => {
    expect(applyRate(cents(250), 0.21)).toBe(53);
    expect(applyRate(cents(-250), 0.21)).toBe(-53);
    expect(applyRate(cents(100_000), 0.052)).toBe(5_200);
  });
});

describe("sums", () => {
  it("adds amounts and the amounts items yield", () => {
    expect(sumCents([cents(10), cents(20)])).toBe(30);
    expect(sumBy([{ a: cents(5) }, { a: cents(-2) }], (x) => x.a)).toBe(3);
    expect(sumCents([])).toBe(0);
  });
});

describe("roundHundredths", () => {
  it("rounds non-money figures to two decimals", () => {
    expect(roundHundredths(100 / 6)).toBe(16.67);
    expect(roundHundredths(1.005)).toBe(1.01);
  });
});

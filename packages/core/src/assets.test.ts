import { describe, expect, it } from "vitest";
import {
  accumulatedAmortization,
  amortizableValue,
  amortizationBetween,
  amortizationQuotas,
  amortizationTable,
  isValidPlan,
  lastAmortizationYear,
  rateRange,
  yearlyRate,
  yearsRange,
  type AmortizedAsset,
} from "./assets";
import { roundCents } from "./invoices";

const laptop: AmortizedAsset = {
  value: 1000,
  startsOn: "2026-01-01",
  plan: { category: "itEquipment", condition: "new", method: "rate", value: 26 },
};

describe("rateRange and yearsRange", () => {
  it("follow the simplified table", () => {
    expect(rateRange("itEquipment", "new")).toEqual({ min: 10, max: 26 });
    expect(rateRange("buildings", "new")).toEqual({ min: 1.47, max: 3 });
    expect(yearsRange("transport", "new")).toEqual({ min: 6.25, max: 14 });
  });

  it("double the highest rate for used goods and accelerated amortization", () => {
    expect(rateRange("machinery", "used").max).toBe(24);
    expect(rateRange("software", "accelerated").max).toBe(66);
    expect(rateRange("research", "used").max).toBe(100);
  });

  it("write off goods of little value and free amortization at once", () => {
    expect(rateRange("tools", "lowValue")).toEqual({ min: 100, max: 100 });
    expect(yearlyRate({ category: "tools", condition: "free", method: "rate", value: 5 })).toBe(100);
  });
});

describe("isValidPlan", () => {
  it("accepts rates and years inside the table", () => {
    expect(isValidPlan(laptop.plan)).toBe(true);
    expect(isValidPlan({ category: "itEquipment", condition: "new", method: "years", value: 4 })).toBe(true);
    expect(isValidPlan({ category: "buildings", condition: "new", method: "rate", value: 1.47 })).toBe(true);
  });

  it("rejects values out of range", () => {
    expect(isValidPlan({ category: "itEquipment", condition: "new", method: "rate", value: 30 })).toBe(false);
    expect(isValidPlan({ category: "itEquipment", condition: "new", method: "years", value: 12 })).toBe(false);
    expect(isValidPlan({ category: "itEquipment", condition: "new", method: "rate", value: 0 })).toBe(false);
  });

  it("ignores the value when the good is written off at once", () => {
    expect(isValidPlan({ category: "tools", condition: "lowValue", method: "rate", value: 0 })).toBe(true);
  });
});

describe("amortizableValue", () => {
  it("is the base when all the VAT is deductible", () => {
    expect(amortizableValue(1000, 210, 100, null)).toBe(1000);
  });

  it("adds the VAT that can't be deducted and applies the business share", () => {
    // A car: 50 % business use, 50 % of its VAT deducted
    expect(amortizableValue(20000, 4200, 50, null)).toBe(11050);
    // No VAT deduction at all
    expect(amortizableValue(1000, 210, 100, 0)).toBe(1210);
  });
});

describe("accumulatedAmortization", () => {
  it("accrues the yearly rate day by day", () => {
    expect(accumulatedAmortization(laptop, "2025-12-31")).toBe(0);
    expect(accumulatedAmortization(laptop, "2026-12-31")).toBe(260);
    expect(accumulatedAmortization(laptop, "2026-03-31")).toBe(roundCents((1000 * 0.26 * 90) / 365));
  });

  it("never goes above the value", () => {
    expect(accumulatedAmortization(laptop, "2040-01-01")).toBe(1000);
  });

  it("counts only the days of use in the first year", () => {
    const fromJuly = { ...laptop, startsOn: "2026-07-01" };
    expect(accumulatedAmortization(fromJuly, "2026-12-31")).toBe(roundCents((260 * 184) / 365));
  });

  it("takes everything on the start date for goods written off at once", () => {
    const tool = { ...laptop, plan: { ...laptop.plan, condition: "lowValue" as const } };
    expect(accumulatedAmortization(tool, "2026-01-01")).toBe(1000);
  });
});

describe("amortizationBetween", () => {
  it("gives the amortization of a range of days", () => {
    expect(amortizationBetween(laptop, "2026-01-01", "2026-12-31")).toBe(260);
    expect(amortizationBetween(laptop, "2027-01-01", "2027-12-31")).toBe(260);
  });
});

describe("amortizationTable", () => {
  it("spreads the whole value over the years", () => {
    const table = amortizationTable(laptop);
    expect(table.map((r) => r.amount)).toEqual([260, 260, 260, 220]);
    expect(table.at(-1)).toEqual({ year: 2029, amount: 220, accumulated: 1000, pending: 0 });
    expect(lastAmortizationYear(laptop)).toBe(2029);
  });

  it("needs an extra year when the good starts mid-year", () => {
    const fromJuly = {
      ...laptop,
      startsOn: "2026-07-01",
      plan: { ...laptop.plan, method: "years" as const, value: 4 },
    };
    const table = amortizationTable(fromJuly);
    expect(table.map((r) => r.year)).toEqual([2026, 2027, 2028, 2029, 2030]);
    expect(roundCents(table.reduce((acc, r) => acc + r.amount, 0))).toBe(1000);
  });
});

describe("amortizationQuotas", () => {
  it("splits each year by quarter and adds up to the value", () => {
    const quotas = amortizationQuotas(laptop);
    expect(quotas[0]).toMatchObject({ date: "2026-03-31", year: 2026, quarter: 1 });
    expect(roundCents(quotas.filter((q) => q.year === 2026).reduce((acc, q) => acc + q.amount, 0))).toBe(260);
    expect(roundCents(quotas.reduce((acc, q) => acc + q.amount, 0))).toBe(1000);
  });

  it("starts in the quarter the good starts being used", () => {
    const fromAugust = { ...laptop, startsOn: "2026-08-15" };
    expect(amortizationQuotas(fromAugust)[0]).toMatchObject({ date: "2026-09-30", quarter: 3 });
  });

  it("puts goods written off at once in a single quarter", () => {
    const tool = { ...laptop, startsOn: "2026-05-10", plan: { ...laptop.plan, condition: "free" as const } };
    expect(amortizationQuotas(tool)).toEqual([{ date: "2026-06-30", year: 2026, quarter: 2, amount: 1000 }]);
  });
});

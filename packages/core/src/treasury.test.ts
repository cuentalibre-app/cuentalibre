import { describe, expect, it } from "vitest";
import { monthlyFlows } from "./treasury";
import { eurosToCents } from "./money";

const eur = eurosToCents;

describe("monthlyFlows", () => {
  it("splits money in and out over the last months", () => {
    const months = monthlyFlows(
      [
        { date: "2026-10-02", amount: eur(500) },
        { date: "2026-10-03", amount: eur(-20) },
        { date: "2025-11-15", amount: eur(100) },
        { date: "2025-10-31", amount: eur(999) },
      ],
      new Date(2026, 9, 17),
    );
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ year: 2025, month: 10, collected: eur(100), paid: 0 });
    expect(months[11]).toEqual({ year: 2026, month: 9, collected: eur(500), paid: eur(20) });
  });
});

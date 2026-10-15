import { describe, expect, it } from "vitest";
import { daysUntil, deadlinesForYear, upcomingDeadlines } from "./deadlines";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("deadlinesForYear", () => {
  it("puts quarterly forms on the 20th of the following month", () => {
    const q3 = deadlinesForYear(2026).filter((d) => d.quarter === 3);
    expect(q3.map((d) => [d.kind, ymd(d.date)])).toEqual([
      ["vat-303", "2026-10-20"],
      ["irpf-130", "2026-10-20"],
    ]);
  });

  it("moves deadlines that fall on a weekend to Monday", () => {
    // 2025-07-20 is a Sunday
    const q2 = deadlinesForYear(2025).find((d) => d.kind === "vat-303" && d.quarter === 2);
    expect(ymd(q2!.date)).toBe("2025-07-21");
    // 2027-01-30 is a Saturday
    const q4 = deadlinesForYear(2026).find((d) => d.kind === "vat-303" && d.quarter === 4);
    expect(ymd(q4!.date)).toBe("2027-02-01");
  });

  it("charges social security on the last business day of the month", () => {
    // 2026-10-31 is a Saturday
    const october = deadlinesForYear(2026).find((d) => d.kind === "social-security" && d.month === 9);
    expect(ymd(october!.date)).toBe("2026-10-30");
  });
});

describe("upcomingDeadlines", () => {
  it("lists what's due from today onwards, soonest first", () => {
    const result = upcomingDeadlines(new Date(2026, 9, 15), 4);
    expect(result.map((d) => [d.kind, ymd(d.date)])).toEqual([
      ["vat-303", "2026-10-20"],
      ["irpf-130", "2026-10-20"],
      ["social-security", "2026-10-30"],
      ["social-security", "2026-11-30"],
    ]);
  });

  it("includes a deadline due today", () => {
    expect(upcomingDeadlines(new Date(2026, 9, 20, 18, 30), 1)[0]?.kind).toBe("vat-303");
  });
});

describe("daysUntil", () => {
  it("counts calendar days ignoring the time of day", () => {
    expect(daysUntil(new Date(2026, 9, 15, 23, 0), new Date(2026, 9, 20))).toBe(5);
    expect(daysUntil(new Date(2026, 9, 20, 9, 0), new Date(2026, 9, 20))).toBe(0);
  });
});

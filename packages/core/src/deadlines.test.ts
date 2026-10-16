import { describe, expect, it } from "vitest";
import {
  calendarStatus,
  daysUntil,
  deadlinesForYear,
  filingDeadline,
  filingStatus,
  fiscalCalendar,
  upcomingDeadlines,
} from "./deadlines";

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

describe("filingDeadline", () => {
  it("is the 20th of the following month for Q1–Q3, moved off weekends", () => {
    expect(filingDeadline(2026, 3)).toEqual(new Date(2026, 9, 20));
    // 20 July 2026 is a Monday
    expect(filingDeadline(2026, 2)).toEqual(new Date(2026, 6, 20));
  });

  it("is January 30th for Q4 and the yearly summary", () => {
    // 30 January 2027 is a Saturday
    expect(filingDeadline(2026, 4)).toEqual(new Date(2027, 1, 1));
    expect(filingDeadline(2026, null)).toEqual(new Date(2027, 1, 1));
  });
});

describe("filingStatus", () => {
  it("follows the period and its deadline", () => {
    expect(filingStatus(2026, 4, new Date(2026, 8, 30))).toBe("upcoming");
    expect(filingStatus(2026, 3, new Date(2026, 8, 30))).toBe("inProgress");
    expect(filingStatus(2026, 3, new Date(2026, 9, 20))).toBe("open");
    expect(filingStatus(2026, 3, new Date(2026, 9, 21))).toBe("closed");
    expect(filingStatus(2026, null, new Date(2026, 9, 21))).toBe("inProgress");
    expect(filingStatus(2025, null, new Date(2026, 0, 15))).toBe("open");
  });
});

describe("fiscalCalendar", () => {
  const due = (year: number, form: string) =>
    fiscalCalendar(year)
      .filter((e) => e.form === form)
      .map((e) => `${e.quarter ?? e.year}:${ymd(e.dueOn)}`);

  it("lists what falls due in the calendar year, with last year's Q4 in January", () => {
    expect(due(2026, "303")).toEqual(["4:2026-01-30", "1:2026-04-20", "2:2026-07-20", "3:2026-10-20"]);
    expect(fiscalCalendar(2026).find((e) => e.form === "303" && e.quarter === 4)?.year).toBe(2025);
  });

  it("closes the last quarter of withholdings on January 20th", () => {
    // 2027-01-20 is a Wednesday
    expect(due(2027, "111")[0]).toBe("4:2027-01-20");
    expect(due(2027, "115")[0]).toBe("4:2027-01-20");
  });

  it("puts yearly returns in January, February and June", () => {
    expect(due(2026, "390")).toEqual(["2025:2026-01-30"]);
    // 2026-01-31 is a Saturday
    expect(due(2026, "190")).toEqual(["2025:2026-02-02"]);
    // 2028 is a leap year; 2028-02-29 is a Tuesday
    expect(due(2028, "347")).toEqual(["2027:2028-02-29"]);
    expect(due(2026, "100")).toEqual(["2025:2026-06-30"]);
  });

  it("charges social security every month and sorts by date, then form", () => {
    const calendar = fiscalCalendar(2026);
    expect(calendar.filter((e) => e.form === "reta")).toHaveLength(12);
    const october20 = calendar.filter((e) => ymd(e.dueOn) === "2026-10-20").map((e) => e.form);
    expect(october20).toEqual(["303", "130", "115", "111", "349"]);
  });
});

describe("calendarStatus", () => {
  const entry = (year: number, form: string, quarter: number | null) =>
    fiscalCalendar(year).find((e) => e.form === form && e.quarter === quarter)!;

  it("follows the period, the filing window and its deadline", () => {
    const q3 = entry(2026, "303", 3);
    expect(calendarStatus(q3, new Date(2026, 5, 1))).toBe("upcoming");
    expect(calendarStatus(q3, new Date(2026, 8, 30))).toBe("inProgress");
    expect(calendarStatus(q3, new Date(2026, 9, 20))).toBe("open");
    expect(calendarStatus(q3, new Date(2026, 9, 21))).toBe("closed");
  });

  it("waits between the end of the year and the opening of the window", () => {
    const renta = entry(2026, "100", null);
    expect(calendarStatus(renta, new Date(2026, 1, 10))).toBe("waiting");
    expect(calendarStatus(renta, new Date(2026, 4, 10))).toBe("open");
  });

  it("treats a social security charge as in progress until its day", () => {
    const october = fiscalCalendar(2026).find((e) => e.form === "reta" && e.month === 9)!;
    expect(calendarStatus(october, new Date(2026, 9, 16))).toBe("inProgress");
    expect(calendarStatus(october, new Date(2026, 9, 30))).toBe("open");
    expect(calendarStatus(october, new Date(2026, 9, 31))).toBe("closed");
  });
});

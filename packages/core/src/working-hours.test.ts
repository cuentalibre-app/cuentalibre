import { describe, expect, it } from "vitest";
import {
  entriesBetween,
  entryError,
  entryMinutes,
  formatDuration,
  isoWeek,
  openEntry,
  workedDays,
  workedTotals,
  workerDay,
  type TimeEntry,
} from "./working-hours";

const entry = (id: string, start: string, end: string | null, workerId = "w1", comment = ""): TimeEntry => ({
  id,
  workerId,
  start,
  end,
  comment,
});

const entries = [
  entry("a", "2026-10-15T09:05", "2026-10-15T11:31"),
  entry("b", "2026-10-15T11:55", "2026-10-15T14:03", "w1", "Recado"),
  entry("c", "2026-10-15T15:01", "2026-10-15T18:32"),
  entry("d", "2026-10-16T09:00", null),
  entry("e", "2026-10-15T08:00", "2026-10-15T12:00", "w2"),
];

describe("entryMinutes and formatDuration", () => {
  it("counts closed intervals only", () => {
    expect(entryMinutes(entries[0]!)).toBe(146);
    expect(entryMinutes(entries[3]!)).toBe(0);
  });

  it("counts an interval past midnight", () => {
    expect(entryMinutes(entry("n", "2026-10-15T22:00", "2026-10-16T01:30"))).toBe(210);
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(485)).toBe("8 h 5 min");
    expect(formatDuration(180)).toBe("3 h");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(0)).toBe("0 min");
  });
});

describe("openEntry", () => {
  it("finds the worker's interval without a clock-out", () => {
    expect(openEntry(entries, "w1")?.id).toBe("d");
    expect(openEntry(entries, "w2")).toBeNull();
  });
});

describe("entryError", () => {
  const now = "2026-10-16T12:00";

  it("accepts a valid interval", () => {
    expect(entryError(entries, { workerId: "w2", start: "2026-10-16T08:00", end: null }, now)).toBeNull();
  });

  it("rejects a clock-out before the clock-in", () => {
    const candidate = { workerId: "w2", start: "2026-10-14T10:00", end: "2026-10-14T09:00" };
    expect(entryError(entries, candidate, now)).toBe("endBeforeStart");
  });

  it("rejects times in the future", () => {
    expect(entryError(entries, { workerId: "w2", start: "2026-10-16T12:30", end: null }, now)).toBe("future");
  });

  it("needs the open interval closed before a new clock-in", () => {
    expect(entryError(entries, { workerId: "w1", start: "2026-10-16T11:00", end: null }, now)).toBe("openEntry");
  });

  it("rejects overlapping intervals of the same worker", () => {
    const candidate = { workerId: "w1", start: "2026-10-15T14:00", end: "2026-10-15T15:00" };
    expect(entryError(entries, candidate, now)).toBe("overlap");
    // The open interval runs until now
    expect(entryError(entries, { workerId: "w1", start: "2026-10-16T10:00", end: "2026-10-16T10:30" }, now)).toBe(
      "overlap",
    );
  });

  it("lets an interval be edited or closed without clashing with itself", () => {
    expect(entryError(entries, { ...entries[3]!, end: "2026-10-16T11:00" }, now)).toBeNull();
    expect(entryError(entries, { ...entries[0]!, end: "2026-10-15T12:00" }, now)).toBe("overlap");
  });
});

describe("workerDay", () => {
  it("summarises a worker's day", () => {
    const day = workerDay(entries, "w1", "2026-10-15");
    expect(day.entries.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(day).toMatchObject({
      firstIn: "2026-10-15T09:05",
      lastOut: "2026-10-15T18:32",
      stops: 2,
      unclosed: 0,
      minutes: 485,
    });
  });

  it("flags open intervals", () => {
    expect(workerDay(entries, "w1", "2026-10-16")).toMatchObject({ lastOut: null, unclosed: 1, minutes: 0 });
  });
});

describe("entriesBetween", () => {
  it("keeps intervals that start or end within the range", () => {
    const ids = entriesBetween(entries, "2026-10-15T14:00", "2026-10-15T23:59").map((e) => e.id);
    expect(ids).toEqual(["b", "c"]);
  });
});

describe("workedDays and workedTotals", () => {
  it("groups a worker's intervals by day", () => {
    const days = workedDays(entries, "w1", "2026-10-01", "2026-10-31");
    expect(days.map((d) => [d.date, d.minutes, d.unclosed])).toEqual([
      ["2026-10-15", 485, 0],
      ["2026-10-16", 0, 1],
    ]);
    expect(days[0]!.comments).toEqual(["Recado"]);
  });

  it("adds up the range", () => {
    expect(workedTotals(entries, "w1", "2026-10-01", "2026-10-31")).toEqual({
      workerId: "w1",
      minutes: 485,
      days: 2,
      unclosed: 1,
    });
    expect(workedTotals(entries, "w1", "2026-10-16", "2026-10-16").days).toBe(1);
  });
});

describe("isoWeek", () => {
  it("returns the ISO week, Monday to Sunday", () => {
    expect(isoWeek("2026-10-17")).toEqual({ week: 42, from: "2026-10-12", to: "2026-10-18" });
    expect(isoWeek("2026-10-12").week).toBe(42);
  });

  it("puts the turn of the year in the week of its Thursday", () => {
    expect(isoWeek("2026-01-01")).toEqual({ week: 1, from: "2025-12-29", to: "2026-01-04" });
    expect(isoWeek("2027-01-01").week).toBe(53);
  });
});

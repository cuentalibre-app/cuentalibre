import { addDays } from "./invoices";

/*
 * Working-time register (registro de jornada, art. 34.9 of the Estatuto de los
 * Trabajadores): clock-in/clock-out intervals per worker and the totals the
 * reports show. Times are local wall-clock strings, "YYYY-MM-DDTHH:mm".
 */

export interface TimeEntry {
  id: string;
  workerId: string;
  /** Clock-in, "2026-10-16T09:05". */
  start: string;
  /** Clock-out; null while the interval is still open. */
  end: string | null;
  comment: string;
}

/** The day an interval counts for: the day it started, even past midnight. */
export const entryDate = (entry: Pick<TimeEntry, "start">) => entry.start.slice(0, 10);

/** "09:05" from "2026-10-16T09:05". */
export const clockTime = (dateTime: string) => dateTime.slice(11, 16);

/** Wall-clock minutes between two local date-times; DST changes are ignored. */
export function minutesBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}:00Z`) - Date.parse(`${start}:00Z`)) / 60_000);
}

/** Worked minutes of an interval; an open one doesn't count until it is closed. */
export function entryMinutes(entry: Pick<TimeEntry, "start" | "end">): number {
  return entry.end === null ? 0 : Math.max(0, minutesBetween(entry.start, entry.end));
}

/** "8 h 5 min", "3 h", "45 min", "0 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const byStart = (a: TimeEntry, b: TimeEntry) => a.start.localeCompare(b.start);

/** The worker's latest interval without a clock-out, if any. */
export function openEntry(entries: TimeEntry[], workerId: string): TimeEntry | null {
  return (
    entries
      .filter((e) => e.workerId === workerId && e.end === null)
      .sort(byStart)
      .at(-1) ?? null
  );
}

export type EntryError = "endBeforeStart" | "future" | "openEntry" | "overlap";

/**
 * Why an interval can't be saved, or null when it can. A new clock-in needs the
 * previous interval closed first, and no two intervals of a worker may overlap
 * (an open one runs until `now`).
 */
export function entryError(
  entries: TimeEntry[],
  candidate: Pick<TimeEntry, "workerId" | "start" | "end"> & { id?: string },
  now: string,
): EntryError | null {
  const { workerId, start, end } = candidate;
  if (end !== null && end <= start) return "endBeforeStart";
  if (start > now || (end !== null && end > now)) return "future";
  const others = entries.filter((e) => e.workerId === workerId && e.id !== candidate.id);
  if (candidate.id === undefined && end === null && others.some((e) => e.end === null)) return "openEntry";
  const until = end ?? now;
  const overlaps = others.some((e) => start < (e.end ?? now) && e.start < until);
  return overlaps ? "overlap" : null;
}

export interface WorkerDay {
  workerId: string;
  /** The day's intervals, earliest first. */
  entries: TimeEntry[];
  firstIn: string | null;
  lastOut: string | null;
  /** Breaks between intervals. */
  stops: number;
  unclosed: number;
  minutes: number;
}

/** What a worker did on a day: the "Visión general" and "Mi equipo" rows. */
export function workerDay(entries: TimeEntry[], workerId: string, date: string): WorkerDay {
  const day = entries.filter((e) => e.workerId === workerId && entryDate(e) === date).sort(byStart);
  const outs = day.map((e) => e.end).filter((end) => end !== null);
  return {
    workerId,
    entries: day,
    firstIn: day[0]?.start ?? null,
    lastOut: outs.sort().at(-1) ?? null,
    stops: Math.max(0, day.length - 1),
    unclosed: day.filter((e) => e.end === null).length,
    minutes: day.reduce((sum, e) => sum + entryMinutes(e), 0),
  };
}

/** Intervals that start or end within [from, to] (local date-times, inclusive). */
export function entriesBetween(entries: TimeEntry[], from: string, to: string): TimeEntry[] {
  const within = (t: string | null) => t !== null && t >= from && t <= to;
  return entries.filter((e) => within(e.start) || within(e.end));
}

export interface WorkedDay {
  date: string;
  /** The day's intervals, earliest first. */
  entries: TimeEntry[];
  minutes: number;
  unclosed: number;
  /** Non-empty comments of the day's intervals. */
  comments: string[];
}

/** Days with intervals in [from, to] (ISO dates, inclusive), oldest first: the extended report. */
export function workedDays(entries: TimeEntry[], workerId: string, from: string, to: string): WorkedDay[] {
  const days = new Map<string, TimeEntry[]>();
  for (const e of [...entries].sort(byStart)) {
    const date = entryDate(e);
    if (e.workerId !== workerId || date < from || date > to) continue;
    days.set(date, [...(days.get(date) ?? []), e]);
  }
  return [...days].map(([date, day]) => ({
    date,
    entries: day,
    minutes: day.reduce((sum, e) => sum + entryMinutes(e), 0),
    unclosed: day.filter((e) => e.end === null).length,
    comments: day.map((e) => e.comment.trim()).filter(Boolean),
  }));
}

export interface WorkedTotals {
  workerId: string;
  minutes: number;
  /** Days with at least one interval. */
  days: number;
  unclosed: number;
}

/** A worker's totals in [from, to]: one row of the basic report. */
export function workedTotals(entries: TimeEntry[], workerId: string, from: string, to: string): WorkedTotals {
  const days = workedDays(entries, workerId, from, to);
  return {
    workerId,
    minutes: days.reduce((sum, d) => sum + d.minutes, 0),
    days: days.length,
    unclosed: days.reduce((sum, d) => sum + d.unclosed, 0),
  };
}

export interface Week {
  /** ISO 8601 week number. */
  week: number;
  /** Monday. */
  from: string;
  /** Sunday. */
  to: string;
}

/** The ISO week (Monday to Sunday) a date falls in, as the weekly signature report uses. */
export function isoWeek(date: string): Week {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() || 7;
  const from = addDays(date, 1 - day);
  // The week belongs to the year of its Thursday
  const thursday = addDays(date, 4 - day);
  const jan1 = Date.UTC(Number(thursday.slice(0, 4)), 0, 1);
  const week = Math.floor((Date.parse(`${thursday}T00:00:00Z`) - jan1) / 86_400_000 / 7) + 1;
  return { week, from, to: addDays(from, 6) };
}

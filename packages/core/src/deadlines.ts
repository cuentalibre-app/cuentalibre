import type { Quarter } from "./period";

export type DeadlineKind = "vat-303" | "irpf-130" | "vat-390" | "social-security";

export interface Deadline {
  kind: DeadlineKind;
  /** Local date at midnight. */
  date: Date;
  /** Fiscal year the obligation refers to. */
  year: number;
  /** Quarter for quarterly forms; month (0-based) for social security; null for yearly forms. */
  quarter: Quarter | null;
  month: number | null;
}

/** Moves a date falling on a weekend to the following Monday. */
function nextBusinessDay(date: Date): Date {
  const d = new Date(date);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

/** Last weekday of a month. */
function lastBusinessDayOfMonth(year: number, month: number): Date {
  const d = new Date(year, month + 1, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

/**
 * Last day to file the return of a quarter (forms 303 and 130) or the yearly VAT summary
 * (form 390, quarter null). Q1–Q3 are filed from the 1st to the 20th of the following month;
 * Q4 and form 390 until January 30th.
 */
export function filingDeadline(year: number, quarter: Quarter | null): Date {
  const due = quarter === null || quarter === 4 ? new Date(year + 1, 0, 30) : new Date(year, quarter * 3, 20);
  return nextBusinessDay(due);
}

/**
 * Where a return stands on a given day: its period hasn't started, is still running, can be
 * filed (until the deadline), or the deadline has passed.
 */
export type FilingStatus = "upcoming" | "inProgress" | "open" | "closed";

export function filingStatus(year: number, quarter: Quarter | null, today: Date): FilingStatus {
  const from = startOfDay(today);
  const start = new Date(year, quarter === null ? 0 : (quarter - 1) * 3, 1);
  const end = quarter === null ? new Date(year + 1, 0, 1) : new Date(year, quarter * 3, 1);
  if (from < start) return "upcoming";
  if (from < end) return "inProgress";
  return from <= filingDeadline(year, quarter) ? "open" : "closed";
}

/**
 * Filing deadlines for a self-employed worker under direct estimation, for
 * the obligations of one fiscal year (some fall in January of the next one).
 *
 * Simplifications: weekends shift a deadline to Monday, but national and
 * regional holidays are not taken into account yet.
 */
export function deadlinesForYear(year: number): Deadline[] {
  const deadlines: Deadline[] = [];

  for (const quarter of [1, 2, 3, 4] as const) {
    const date = filingDeadline(year, quarter);
    deadlines.push({ kind: "vat-303", date, year, quarter, month: null });
    deadlines.push({ kind: "irpf-130", date, year, quarter, month: null });
  }

  deadlines.push({ kind: "vat-390", date: filingDeadline(year, null), year, quarter: null, month: null });

  // The RETA fee is charged on the last business day of each month.
  for (let month = 0; month < 12; month++) {
    deadlines.push({
      kind: "social-security",
      date: lastBusinessDayOfMonth(year, month),
      year,
      quarter: null,
      month,
    });
  }

  return deadlines;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Deadlines due today or later, soonest first. */
export function upcomingDeadlines(today: Date, limit: number): Deadline[] {
  const from = startOfDay(today);
  const year = from.getFullYear();
  return [...deadlinesForYear(year - 1), ...deadlinesForYear(year), ...deadlinesForYear(year + 1)]
    .filter((d) => d.date >= from)
    .sort((a, b) => a.date.getTime() - b.date.getTime() || kindOrder(a.kind) - kindOrder(b.kind))
    .slice(0, limit);
}

const KIND_ORDER: DeadlineKind[] = ["vat-303", "irpf-130", "social-security", "vat-390"];

function kindOrder(kind: DeadlineKind): number {
  return KIND_ORDER.indexOf(kind);
}

/** Whole calendar days from `today` until `date` (0 when it's today). */
export function daysUntil(today: Date, date: Date): number {
  const ms = startOfDay(date).getTime() - startOfDay(today).getTime();
  return Math.round(ms / 86_400_000);
}

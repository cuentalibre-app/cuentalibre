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

/*
 * Full fiscal calendar: every filing a self-employed worker may face, by the
 * calendar year in which it falls due (January holds the previous year's Q4
 * and yearly returns).
 */

export type CalendarForm = "303" | "390" | "130" | "100" | "111" | "190" | "115" | "180" | "347" | "349" | "reta";

export interface CalendarEntry {
  form: CalendarForm;
  /** Fiscal year the obligation refers to. */
  year: number;
  /** Quarter for quarterly forms; null for yearly forms and social security. */
  quarter: Quarter | null;
  /** Month (0-based) for social security; null otherwise. */
  month: number | null;
  /** First day of the filing window (the charge day for social security). */
  opensOn: Date;
  /** Last day to file, moved off weekends. */
  dueOn: Date;
}

/** Order of forms within a day, and of rows in the calendar. */
export const CALENDAR_FORMS: CalendarForm[] = ["303", "390", "130", "100", "115", "180", "111", "190", "347", "349", "reta"];

/** Window to file a quarter: the 1st to `day` of the following month; Q4 ends on `q4Day` January. */
function quarterWindow(form: CalendarForm, year: number, quarter: Quarter, day: number, q4Day: number): CalendarEntry {
  const month = quarter === 4 ? 12 : quarter * 3;
  const opensOn = new Date(year, month, 1);
  const dueOn = nextBusinessDay(new Date(year, month, quarter === 4 ? q4Day : day));
  return { form, year, quarter, month: null, opensOn, dueOn };
}

function yearly(form: CalendarForm, year: number, opensOn: Date, due: Date): CalendarEntry {
  return { form, year, quarter: null, month: null, opensOn, dueOn: nextBusinessDay(due) };
}

/** Every obligation of one fiscal year, whatever year it falls due in. */
function obligationsOfYear(year: number): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  for (const quarter of [1, 2, 3, 4] as const) {
    entries.push(quarterWindow("303", year, quarter, 20, 30));
    entries.push(quarterWindow("130", year, quarter, 20, 30));
    entries.push(quarterWindow("349", year, quarter, 20, 30));
    entries.push(quarterWindow("111", year, quarter, 20, 20));
    entries.push(quarterWindow("115", year, quarter, 20, 20));
  }
  const next = year + 1;
  entries.push(yearly("390", year, new Date(next, 0, 1), new Date(next, 0, 30)));
  entries.push(yearly("180", year, new Date(next, 0, 1), new Date(next, 0, 31)));
  entries.push(yearly("190", year, new Date(next, 0, 1), new Date(next, 0, 31)));
  entries.push(yearly("347", year, new Date(next, 1, 1), new Date(next, 2, 0)));
  // The income tax campaign opens in early April (the exact day changes every year) and ends on June 30th.
  entries.push(yearly("100", year, new Date(next, 3, 1), new Date(next, 5, 30)));
  for (let month = 0; month < 12; month++) {
    const day = lastBusinessDayOfMonth(year, month);
    entries.push({ form: "reta", year, quarter: null, month, opensOn: day, dueOn: day });
  }
  return entries;
}

/**
 * Filings due within a calendar year, soonest first. Form 349 is listed
 * quarterly, which applies while intra-EU deliveries stay under 50.000 € a
 * quarter. Like `deadlinesForYear`, holidays are not taken into account.
 */
export function fiscalCalendar(year: number): CalendarEntry[] {
  return [...obligationsOfYear(year - 1), ...obligationsOfYear(year)]
    .filter((e) => e.dueOn.getFullYear() === year)
    .sort(
      (a, b) =>
        a.dueOn.getTime() - b.dueOn.getTime() || CALENDAR_FORMS.indexOf(a.form) - CALENDAR_FORMS.indexOf(b.form),
    );
}

/**
 * Where an entry stands on a given day. Besides the states of `filingStatus`,
 * "waiting" covers a period that has ended while its filing window hasn't
 * opened yet (form 347 in January, the income tax return until April).
 */
export type CalendarStatus = FilingStatus | "waiting";

export function calendarStatus(entry: CalendarEntry, today: Date): CalendarStatus {
  const from = startOfDay(today);
  const { year, quarter, month } = entry;
  const start = new Date(year, month ?? (quarter === null ? 0 : (quarter - 1) * 3), 1);
  const end =
    month !== null ? new Date(year, month + 1, 1) : quarter === null ? new Date(year + 1, 0, 1) : new Date(year, quarter * 3, 1);
  if (from < start) return "upcoming";
  if (from < end && entry.form !== "reta") return "inProgress";
  if (from < entry.opensOn) return entry.form === "reta" ? "inProgress" : "waiting";
  return from <= entry.dueOn ? "open" : "closed";
}

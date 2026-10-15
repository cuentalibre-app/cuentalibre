export type Quarter = 1 | 2 | 3 | 4;

/** A tax period: one quarter of a year, or the whole year when `quarter` is null. */
export interface Period {
  year: number;
  quarter: Quarter | null;
}

const QUARTER_KEY = /^(\d{4})-T([1-4])$/;
const YEAR_KEY = /^(\d{4})$/;

/** Parses "2026-T3" (quarter) or "2026" (whole year). */
export function parsePeriod(key: string): Period | null {
  const q = QUARTER_KEY.exec(key);
  if (q) return { year: Number(q[1]), quarter: Number(q[2]) as Quarter };
  const y = YEAR_KEY.exec(key);
  if (y) return { year: Number(y[1]), quarter: null };
  return null;
}

export function periodKey(period: Period): string {
  return period.quarter === null ? String(period.year) : `${period.year}-T${period.quarter}`;
}

export function isSamePeriod(a: Period, b: Period): boolean {
  return a.year === b.year && a.quarter === b.quarter;
}

/** Zero-based month indexes (0 = January) covered by the period. */
export function periodMonths(period: Period): number[] {
  if (period.quarter === null) return Array.from({ length: 12 }, (_, i) => i);
  const first = (period.quarter - 1) * 3;
  return [first, first + 1, first + 2];
}

/** The period right before: the previous quarter, or the previous year. */
export function previousPeriod(period: Period): Period {
  if (period.quarter === null) return { year: period.year - 1, quarter: null };
  if (period.quarter === 1) return { year: period.year - 1, quarter: 4 };
  return { year: period.year, quarter: (period.quarter - 1) as Quarter };
}

export function quarterOfMonth(month: number): Quarter {
  return (Math.floor(month / 3) + 1) as Quarter;
}

/**
 * The period a user most likely cares about on a given day: the quarter that
 * is still being filed (until its quarterly deadline passes), otherwise the
 * current quarter.
 */
export function defaultPeriod(today: Date): Period {
  const year = today.getFullYear();
  const month = today.getMonth();
  const current: Period = { year, quarter: quarterOfMonth(month) };
  const isFirstMonthOfQuarter = month % 3 === 0;
  if (!isFirstMonthOfQuarter) return current;

  const previous = previousPeriod(current);
  // Q1–Q3 are filed until the 20th of the following month; Q4 until January 30th.
  const lastFilingDay = previous.quarter === 4 ? 30 : 20;
  return today.getDate() <= lastFilingDay ? previous : current;
}

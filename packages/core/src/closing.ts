import { periodKey, quarterOfMonth, type Period } from "./period";

/*
 * Closing a quarter freezes its books: once its returns are filed, invoices
 * and expenses dated in it can't be created, edited or deleted until it is
 * reopened.
 */

/** Quarter an ISO date (YYYY-MM-DD) falls in. */
export function quarterOfDate(isoDate: string): Period {
  const [year, month] = isoDate.split("-").map(Number);
  return { year: year!, quarter: quarterOfMonth(month! - 1) };
}

/** The closed quarter a date falls in, or null when it can still be changed. */
export function lockedQuarter(isoDate: string, closed: ReadonlySet<string>): Period | null {
  if (!isoDate) return null;
  const period = quarterOfDate(isoDate);
  return closed.has(periodKey(period)) ? period : null;
}

/**
 * Numbers missing from a correlative series: ["2026-0001", "2026-0004"] →
 * ["2026-0002", "2026-0003"]. Numbers are grouped by everything before their
 * numeric suffix ("R-2026-", "2026-"), and each group is checked from its
 * lowest to its highest number: a series may go on from the previous year
 * instead of starting at 1. Numbers without a numeric suffix are ignored.
 */
export function numberingGaps(numbers: string[]): string[] {
  const series = new Map<string, { width: number; used: Set<number> }>();
  for (const number of numbers) {
    const match = /^(.*?)(\d+)$/.exec(number);
    if (!match) continue;
    const [, head, digits] = match as unknown as [string, string, string];
    const entry = series.get(head) ?? { width: digits.length, used: new Set<number>() };
    entry.used.add(Number(digits));
    entry.width = Math.max(entry.width, digits.length);
    series.set(head, entry);
  }
  const gaps: string[] = [];
  for (const [head, { width, used }] of series) {
    const first = Math.min(...used);
    const last = Math.max(...used);
    for (let n = first + 1; n < last; n++) {
      if (!used.has(n)) gaps.push(`${head}${String(n).padStart(width, "0")}`);
    }
  }
  return gaps;
}

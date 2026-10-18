import {
  addDays,
  clockTime,
  formatDuration,
  isoWeek,
  workedDays,
  workedTotals,
  type TimeEntry,
  type WorkedDay,
  type WorkedTotals,
} from "@fiscalia/core";
import type { Worker } from "@fiscalia/contracts";
import { MONTHS } from "@/lib/format";
import { workers } from "@/mocks/working-hours";

/* The data behind the worked-hours reports, shared by the page and the PDFs. */

export interface ReportRange {
  from: string;
  to: string;
  /** "octubre de 2026", "Semana 42 (12/10/2026 – 18/10/2026)"… */
  label: string;
}

/** "16/10/2026", the date format of official records. */
export const slashDate = (iso: string) => iso.split("-").reverse().join("/");

/** "octubre de 2026" for "2026-10". */
export const monthLabel = (month: string) =>
  `${MONTHS[Number(month.slice(5, 7)) - 1]!.toLowerCase()} de ${month.slice(0, 4)}`;

export function monthRange(month: string): ReportRange {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}`, label: monthLabel(month) };
}

/** The current month and the eleven before it, newest first: "2026-10", "2026-09"… */
export function lastMonths(today: string, count = 12): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y!, m! - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function weekRange(date: string): ReportRange {
  const { week, from, to } = isoWeek(date);
  return { from, to, label: `Semana ${week} (${slashDate(from)} – ${slashDate(to)})` };
}

export const dayRange = (date: string): ReportRange => ({ from: date, to: date, label: slashDate(date) });

/** The people a report covers: everyone or one of them. */
export const reportWorkers = (workerId: string): Worker[] =>
  workerId === "all" ? workers : workers.filter((w) => w.id === workerId);

/** "09:05 – 11:31", or "09:05 – sin salida" for an open interval. */
export const intervalLabel = (e: TimeEntry) => `${clockTime(e.start)} – ${e.end ? clockTime(e.end) : "sin salida"}`;

/** "39 h 30 min (5 días)" */
export const totalLabel = (t: Pick<WorkedTotals, "minutes" | "days">) =>
  `${formatDuration(t.minutes)} (${t.days} ${t.days === 1 ? "día" : "días"})`;

export interface WorkerReport {
  worker: Worker;
  totals: WorkedTotals;
  days: WorkedDay[];
}

export function workerReports(entries: TimeEntry[], workerId: string, range: ReportRange): WorkerReport[] {
  return reportWorkers(workerId).map((worker) => ({
    worker,
    totals: workedTotals(entries, worker.id, range.from, range.to),
    days: workedDays(entries, worker.id, range.from, range.to),
  }));
}

/** Every day of the range, worked or not, so the signed sheet has no gaps. */
export function signatureDays(report: WorkerReport, range: ReportRange): WorkedDay[] {
  const worked = new Map(report.days.map((d) => [d.date, d]));
  const days: WorkedDay[] = [];
  for (let date = range.from; date <= range.to; date = addDays(date, 1))
    days.push(worked.get(date) ?? { date, entries: [], minutes: 0, unclosed: 0, comments: [] });
  return days;
}

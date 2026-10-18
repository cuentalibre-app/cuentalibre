import { addDays, type TimeEntry } from "@fiscalia/core";
import type { Worker } from "@fiscalia/contracts";

/** People who clock in, and their sample intervals, until there is a backend. Made up. */

export const workers: Worker[] = [
  { id: "w-lucia", name: "Lucía Martín Ortega", email: "hola@luciamartin.es", owner: true },
  { id: "w-daniel", name: "Daniel Ferrer Soto", email: "daniel@luciamartin.es", owner: false },
];

/** Deterministic jitter in minutes, so the sample looks hand-clocked but never changes. */
function jitter(seed: string, range: number): number {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (Math.abs(h) % (2 * range + 1)) - range;
}

function at(date: string, minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${date}T${h}:${m}`;
}

const COMMENTS: Record<string, string> = {
  "w-lucia 2026-09-14 0": "Llego tarde: revisión en el médico.",
  "w-lucia 2026-10-01 1": "Reunión con Estudio Norte por la tarde.",
  "w-daniel 2026-09-22 0": "Teletrabajo.",
  "w-daniel 2026-10-13 0": "Salgo antes, recupero el jueves.",
};

/** Lucía's August break and the bank holidays that fall on weekdays. */
const DAYS_OFF = new Set(["2026-08-15", "2026-10-12"]);
const isOff = (worker: string, date: string) =>
  DAYS_OFF.has(date) || (worker === "w-lucia" && date >= "2026-08-03" && date <= "2026-08-21");

function sampleEntries(): TimeEntry[] {
  const entries: TimeEntry[] = [];
  const add = (workerId: string, date: string, i: number, from: number, to: number | null) =>
    entries.push({
      id: `${workerId}-${date}-${i}`,
      workerId,
      start: at(date, from),
      end: to === null ? null : at(date, to),
      comment: COMMENTS[`${workerId} ${date} ${i}`] ?? "",
    });

  for (let date = "2026-06-01"; date <= "2026-10-16"; date = addDays(date, 1)) {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    if (!isOff("w-lucia", date)) {
      const j = (k: string, r: number) => jitter(`lucia${date}${k}`, r);
      add("w-lucia", date, 0, 9 * 60 + j("a", 12), 14 * 60 + j("b", 15));
      // Friday afternoons off
      if (weekday !== 5) add("w-lucia", date, 1, 15 * 60 + 5 + j("c", 8), 18 * 60 + j("d", 30));
    }
    // Daniel works mornings, Monday to Thursday
    if (weekday <= 4 && !isOff("w-daniel", date)) {
      const j = (k: string, r: number) => jitter(`daniel${date}${k}`, r);
      const end = date === "2026-10-13" ? 12 * 60 + 30 : 13 * 60 + 30 + j("b", 10);
      // He forgot to clock out on 8 October
      add("w-daniel", date, 0, 9 * 60 + 30 + j("a", 8), date === "2026-10-08" ? null : end);
    }
  }

  // Saturday 17 October: Lucía is finishing a delivery and still clocked in
  add("w-lucia", "2026-10-17", 0, 10 * 60 + 2, 12 * 60 + 15);
  add("w-lucia", "2026-10-17", 1, 12 * 60 + 40, null);
  return entries;
}

export const initialTimeEntries: TimeEntry[] = sampleEntries();

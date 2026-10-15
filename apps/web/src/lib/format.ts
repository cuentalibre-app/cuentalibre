import type { Deadline, Period } from "@fiscalia/core";

export const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

export const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"] as const;

export const MONTHS_INITIAL = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] as const;

const ORDINAL = { 1: "1.er", 2: "2.º", 3: "3.er", 4: "4.º" } as const;
const RANGE = { 1: "ene – mar", 2: "abr – jun", 3: "jul – sep", 4: "oct – dic" } as const;

/** "3.er trimestre 2026" or "Año 2026". */
export function periodLabel(period: Period): string {
  return period.quarter === null ? `Año ${period.year}` : `${ORDINAL[period.quarter]} trimestre ${period.year}`;
}

/** Compact code: "2026-3T" for a quarter, "2026" for a year. */
export function periodCode(period: Period): string {
  return period.quarter === null ? String(period.year) : `${period.year}-${period.quarter}T`;
}

/** "T3" or "T4 2025" when it's not the reference year; "2025" for a whole year. */
export function periodShortLabel(period: Period, referenceYear: number): string {
  if (period.quarter === null) return String(period.year);
  return period.year === referenceYear ? `T${period.quarter}` : `T${period.quarter} ${period.year}`;
}

export function periodRange(period: Period): string {
  return period.quarter === null ? "ene – dic" : RANGE[period.quarter];
}

/** "28 sep 2026" */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS_SHORT[m! - 1]!.toLowerCase()} ${y}`;
}

/** "28 sep" */
export function formatShortDate(isoDate: string): string {
  return formatDate(isoDate).slice(0, -5);
}

/** Compact axis label: 0, "4k €", "7,5k €". */
export function formatThousands(value: number): string {
  if (value === 0) return "0";
  return `${String(value / 1000).replace(".", ",")}k €`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)} %`;
}

export function deadlineTitle(deadline: Deadline): string {
  switch (deadline.kind) {
    case "vat-303":
      return `Modelo 303 · IVA T${deadline.quarter}`;
    case "irpf-130":
      return `Modelo 130 · IRPF T${deadline.quarter}`;
    case "vat-390":
      return "Modelo 390 · Resumen IVA";
    case "social-security":
      return "Cuota de autónomos";
  }
}

export function daysLeftLabel(days: number): string {
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Queda 1 día";
  return `Quedan ${days} días`;
}

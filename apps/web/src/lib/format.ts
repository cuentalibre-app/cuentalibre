import { centsToEuros, eurosToCents, type Cents, type Deadline, type Period } from "@cuentalibre/core";

export const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export const MONTHS_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

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

/** "12 KB", "1,4 MB", "1 GB": a file's size. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const [value, unit] = bytes < 1024 ** 3 ? [bytes / 1024 ** 2, "MB"] : [bytes / 1024 ** 3, "GB"];
  return `${value.toFixed(1).replace(/\.0$/, "").replace(".", ",")} ${unit}`;
}

/** "28 sep" */
export function formatShortDate(isoDate: string): string {
  return formatDate(isoDate).slice(0, -5);
}

/** Compact axis label: 0, "4k €", "7,5k €". */
export function formatThousands(amount: Cents): string {
  if (amount === 0) return "0";
  return `${String(centsToEuros(amount) / 1000).replace(".", ",")}k €`;
}

/** 462300 cents → "4,6k €"; under a thousand, whole euros: "380 €". For labels over chart bars. */
export function formatCompactEUR(amount: Cents): string {
  const euros = centsToEuros(amount);
  const abs = Math.abs(euros);
  // A few cents round to nothing: no sign on a zero
  const sign = euros < 0 && Math.round(abs) > 0 ? "−" : "";
  if (abs < 1000) return `${sign}${Math.round(abs)} €`;
  const k = Math.round(abs / 100) / 10;
  return `${sign}${String(k).replace(".", ",")}k €`;
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

/**
 * Parses a number typed in Spanish format: "1.250,5" → 1250.5, also "1250.5".
 * Returns null when it isn't a number.
 */
export function parseDecimal(input: string): number | null {
  let text = input.trim().replace(/\s|€|%/g, "");
  if (text === "") return null;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** 1250.5 → "1250,5", for prefilling inputs. */
export function formatDecimalInput(value: number): string {
  return String(value).replace(".", ",");
}

/** A money amount typed in euros ("1.250,5") as cents; null when it isn't a number. */
export function parseEuros(input: string): Cents | null {
  const value = parseDecimal(input);
  return value === null ? null : eurosToCents(value);
}

/** 125050 cents → "1250,5", for prefilling money inputs. */
export function formatEurosInput(amount: Cents): string {
  return formatDecimalInput(centsToEuros(amount));
}

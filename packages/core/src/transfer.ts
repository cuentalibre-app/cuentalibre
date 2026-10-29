import { INVOICE_VAT_RATES, SURCHARGE_RATES, WITHHOLDING_RATES, type WithholdingKind } from "./invoices";

/*
 * Reading the cells of an imported spreadsheet. Files exported by other apps
 * or typed by hand mix formats ("1250€", "1.250,50", "2251,2 €", "21%"), so
 * every parser accepts the usual Spanish and English spellings and returns
 * null when the text can't be read.
 */

/**
 * An amount in euros: "1250€", "2251,2 €", "1.250,50", "1,250.50", "-2100". The last
 * separator followed by one or two digits is the decimal one; a lone dot followed by
 * three digits ("1.250") is a thousands separator, as written in Spain.
 */
export function parseAmount(text: string): number | null {
  let s = text.trim().replace(/[\s €]/g, "").replace(/^\+/, "");
  if (s === "") return null;
  // (1.250,00) is an accounting negative
  const parenthesized = /^\((.*)\)$/.exec(s);
  if (parenthesized) s = `-${parenthesized[1]}`;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    s = s.replaceAll(thousands, "").replace(decimal, ".");
  } else if (lastComma >= 0) {
    // Several commas are thousands separators ("1,250,000"); one is the decimal comma
    s = s.split(",").length > 2 ? s.replaceAll(",", "") : s.replace(",", ".");
  } else if (lastDot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replaceAll(".", "");
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

/** A percentage as a number of percent: "21", "21 %", "5,2" → 21, 21, 5.2. */
export function parsePercent(text: string): number | null {
  return parseAmount(text.replace(/%/g, ""));
}

const pad = (n: number) => String(n).padStart(2, "0");

function isoIfValid(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** A date as ISO (YYYY-MM-DD) from "31/03/2026", "31-3-26", "31.03.2026" or "2026-03-31". */
export function parseDate(text: string): string | null {
  const s = text.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (iso) return isoIfValid(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (!dmy) return null;
  const year = dmy[3]!.length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
  return isoIfValid(year, Number(dmy[2]), Number(dmy[1]));
}

/** A spreadsheet date serial (days since 1899-12-30, the Excel epoch) as ISO. */
export function excelSerialToIso(serial: number): string {
  const ms = Math.round(serial * 86_400_000);
  return new Date(Date.UTC(1899, 11, 30) + ms).toISOString().slice(0, 10);
}

/** An ISO date as a spreadsheet date serial, the inverse of `excelSerialToIso`. */
export function isoToExcelSerial(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return (Date.UTC(y!, m! - 1, d!) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/** ISO date as it is written in Spain: "31/03/2026". */
export function formatSpanishDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

const closest = <T extends number>(rates: readonly T[], fraction: number): T | null =>
  rates.find((r) => Math.abs(r - fraction) < 0.00005) ?? null;

/** VAT rate (fraction) for a percentage written in a file, when it is one an invoice line can carry. */
export function vatRateFromPercent(percent: number): number | null {
  return closest(INVOICE_VAT_RATES, percent / 100);
}

/** Equivalence surcharge rate (fraction) for a percentage, when it is a valid one. */
export function surchargeRateFromPercent(percent: number): number | null {
  return closest(SURCHARGE_RATES, percent / 100);
}

/**
 * Withholding kind for a percentage. Current rates win over the historical ones that
 * share a value (21 % is only historical; 19 % is the current rentals rate).
 */
export function withholdingFromPercent(percent: number): WithholdingKind | null {
  const kinds = Object.keys(WITHHOLDING_RATES) as WithholdingKind[];
  const ordered = [...kinds.filter((k) => !k.startsWith("legacy")), ...kinds.filter((k) => k.startsWith("legacy"))];
  return ordered.find((k) => Math.abs(WITHHOLDING_RATES[k] * 100 - percent) < 0.005) ?? null;
}

/**
 * Groups the rows of an import into documents. A row with a document key different
 * from the previous one starts a new document; rows with the same key, or with an
 * empty one, add concepts (and payments) to it. Leading rows without a key are lost.
 */
export function groupRows<T>(rows: T[], keyOf: (row: T) => string): T[][] {
  const groups: T[][] = [];
  let current: string | null = null;
  for (const row of rows) {
    const key = keyOf(row).trim();
    if (key && key !== current) {
      groups.push([row]);
      current = key;
    } else if (groups.length > 0) groups.at(-1)!.push(row);
  }
  return groups;
}

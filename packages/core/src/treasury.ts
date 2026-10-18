import { cents, eurosToCents, type Cents } from "./money";

/*
 * Treasury: bank movements, the payments recorded against documents, and how
 * they are reconciled. Amounts are signed: positive money in (collections),
 * negative money out (payments).
 */

export type ReconciliationStatus = "none" | "partial" | "full";

/** How much of a movement is covered by the payments linked to it. */
export function reconciliationStatus(amount: Cents, matched: Cents): ReconciliationStatus {
  if (matched === 0) return "none";
  return matched === amount ? "full" : "partial";
}

/** Whole days from `from` to `to` (ISO dates); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export interface Flow {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  amount: Cents;
}

export interface Candidate extends Flow {
  id: string;
}

export interface RankedCandidate<T extends Candidate> {
  candidate: T;
  /** The candidate's amount equals the movement's. */
  exact: boolean;
  /** Absolute distance in days between the two dates. */
  days: number;
}

/** Days around a movement's date in which a payment can match it: transfers take a while to arrive. */
export const MATCH_WINDOW_DAYS = 30;

/**
 * Candidates that could explain a movement, best first: same direction of money,
 * within the date window, exact amounts before smaller ones that could add up to it,
 * then the closest in date.
 */
export function rankCandidates<T extends Candidate>(
  movement: Flow,
  candidates: T[],
  windowDays = MATCH_WINDOW_DAYS,
): RankedCandidate<T>[] {
  const target = movement.amount;
  return candidates
    .filter((c) => Math.sign(c.amount) === Math.sign(target) && target !== 0)
    .filter((c) => Math.abs(c.amount) <= Math.abs(target))
    .map((candidate) => ({
      candidate,
      exact: candidate.amount === target,
      days: Math.abs(daysBetween(movement.date, candidate.date)),
    }))
    .filter((r) => r.days <= windowDays)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || a.days - b.days);
}

/**
 * Automatic reconciliation: pairs each movement with the one candidate of exactly the same
 * amount, closest in date within the window. Movements are handled oldest first and every
 * candidate is used once, so two equal monthly fees pair with their own month. A movement
 * whose best match is tied with another candidate at the same distance is left for review.
 */
export function autoReconcile<M extends Candidate, C extends Candidate>(
  movements: M[],
  candidates: C[],
  windowDays = MATCH_WINDOW_DAYS,
): { movementId: string; candidateId: string }[] {
  const used = new Set<string>();
  const pairs: { movementId: string; candidateId: string }[] = [];
  for (const movement of [...movements].sort((a, b) => a.date.localeCompare(b.date))) {
    const exact = rankCandidates(
      movement,
      candidates.filter((c) => !used.has(c.id)),
      windowDays,
    ).filter((r) => r.exact);
    const [best, second] = exact;
    if (!best || (second && second.days === best.days)) continue;
    used.add(best.candidate.id);
    pairs.push({ movementId: movement.id, candidateId: best.candidate.id });
  }
  return pairs;
}

export interface MonthFlows {
  year: number;
  /** Zero-based month. */
  month: number;
  /** Money in, positive. */
  collected: Cents;
  /** Money out, as a positive figure. */
  paid: Cents;
}

/** Money in and out per month for the `count` months ending with the one of `today`, oldest first. */
export function monthlyFlows(flows: Flow[], today: Date, count = 12): MonthFlows[] {
  const last = today.getFullYear() * 12 + today.getMonth();
  const months: MonthFlows[] = Array.from({ length: count }, (_, i) => {
    const index = last - count + 1 + i;
    return { year: Math.floor(index / 12), month: index % 12, collected: cents(0), paid: cents(0) };
  });
  for (const flow of flows) {
    const [year, month] = flow.date.split("-").map(Number);
    const slot = months[year! * 12 + month! - 1 - (last - count + 1)];
    if (!slot) continue;
    if (flow.amount >= 0) slot.collected = cents(slot.collected + flow.amount);
    else slot.paid = cents(slot.paid - flow.amount);
  }
  return months;
}

/* ───────────────────────────── Statement import ───────────────────────────── */

export interface StatementLine {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  concept: string;
  amount: Cents;
  /** Balance after the movement, when the bank includes it. */
  balance: Cents | null;
  reference: string;
}

export interface StatementParse {
  lines: StatementLine[];
  /** Rows that couldn't be read, with their 1-based line number in the file. */
  errors: { line: number; message: string }[];
}

type Column = "date" | "concept" | "amount" | "credit" | "debit" | "balance" | "reference";

/** Header names Spanish banks use for each column, normalized (lower case, no accents). */
const HEADERS: Record<Column, string[]> = {
  date: ["fecha", "fecha operacion", "f. operacion", "fecha contable", "fecha valor", "date"],
  concept: ["concepto", "descripcion", "concepto comun", "movimiento", "detalle", "description"],
  amount: ["importe", "cantidad", "importe (eur)", "importe eur", "amount"],
  credit: ["haber", "abono", "ingreso", "ingresos"],
  debit: ["debe", "cargo", "gasto", "gastos"],
  balance: ["saldo", "saldo (eur)", "saldo eur", "disponible", "balance"],
  reference: ["referencia", "ref.", "ref", "observaciones", "reference"],
};

const normalize = (text: string) => text.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function splitRow(row: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i]!;
    if (char === '"') {
      if (quoted && row[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(cell);
      cell = "";
    } else cell += char;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

/** "1.250,50", "-1250.5", "1 250,50 €" → cents; null if it isn't a number. */
export function parseStatementAmount(input: string): Cents | null {
  let text = input.replace(/[\s€]|EUR/gi, "");
  if (text === "") return null;
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  // The last separator is the decimal one; the other groups thousands
  if (comma > dot) text = text.replace(/\./g, "").replace(",", ".");
  else if (dot > comma && comma !== -1) text = text.replace(/,/g, "");
  const value = Number(text);
  return Number.isFinite(value) ? eurosToCents(value) : null;
}

/** "28/09/2026", "28-09-26", "2026-09-28" → "2026-09-28"; null if it isn't a valid date. */
export function parseStatementDate(input: string): string | null {
  const text = input.trim();
  let year: number, month: number, day: number;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (m) [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else {
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(text);
    if (!m) return null;
    [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (year < 100) year += 2000;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function detectDelimiter(header: string): string {
  const counts = [";", "\t", ","].map((d) => [d, splitRow(header, d).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0]![0];
}

/**
 * Reads a bank statement exported as CSV. Banks put a few lines of account details before
 * the table, so the header is the first row that names a date and an amount column (or
 * debit and credit columns). Columns are found by name, in any order.
 */
export function parseBankStatement(text: string): StatementParse {
  const rows = text.replace(/^﻿/, "").split(/\r?\n/);
  let headerIndex = -1;
  let delimiter = ";";
  let columns: Partial<Record<Column, number>> = {};

  for (let i = 0; i < rows.length && headerIndex === -1; i++) {
    if (!rows[i]!.trim()) continue;
    delimiter = detectDelimiter(rows[i]!);
    const names = splitRow(rows[i]!, delimiter).map(normalize);
    const found: Partial<Record<Column, number>> = {};
    for (const column of Object.keys(HEADERS) as Column[]) {
      const index = names.findIndex((n) => HEADERS[column].includes(n));
      if (index !== -1) found[column] = index;
    }
    const hasAmount = found.amount !== undefined || (found.credit !== undefined && found.debit !== undefined);
    if (found.date !== undefined && hasAmount) {
      headerIndex = i;
      columns = found;
    }
  }

  if (headerIndex === -1)
    return {
      lines: [],
      errors: [
        {
          line: 1,
          message: "No se encuentra la fila de cabecera: hacen falta al menos las columnas Fecha e Importe.",
        },
      ],
    };

  const lines: StatementLine[] = [];
  const errors: StatementParse["errors"] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    if (!rows[i]!.trim()) continue;
    const cells = splitRow(rows[i]!, delimiter);
    const cell = (column: Column) => (columns[column] === undefined ? "" : (cells[columns[column]!] ?? ""));
    if (cells.every((c) => c === "")) continue;

    const date = parseStatementDate(cell("date"));
    let amount: Cents | null;
    if (columns.amount !== undefined) amount = parseStatementAmount(cell("amount"));
    else {
      const credit = parseStatementAmount(cell("credit")) ?? 0;
      const debit = parseStatementAmount(cell("debit")) ?? 0;
      amount = cell("credit") || cell("debit") ? cents(credit - Math.abs(debit)) : null;
    }

    if (!date) errors.push({ line: i + 1, message: `Fecha no válida: «${cell("date")}».` });
    else if (amount === null) errors.push({ line: i + 1, message: "Falta el importe o no es un número." });
    else
      lines.push({
        date,
        concept: cell("concept"),
        amount,
        balance: parseStatementAmount(cell("balance")),
        reference: cell("reference"),
      });
  }
  return { lines, errors };
}

/** Same account, date, amount and concept: the line was already imported. */
export function isDuplicateMovement(
  line: Pick<StatementLine, "date" | "amount" | "concept">,
  existing: Pick<StatementLine, "date" | "amount" | "concept">[],
): boolean {
  return existing.some(
    (m) => m.date === line.date && m.amount === line.amount && normalize(m.concept) === normalize(line.concept),
  );
}

import { roundCents } from "./invoices";
import { periodMonths, type Period, type Quarter } from "./period";
import type { TaxBooks } from "./tax-returns";

/*
 * Profit and loss report of a self-employed worker, laid out as Contasimple does: the
 * Spanish chart of accounts (PGC) groups 6 and 7 summed from the tax books. Income is the
 * taxable base of the issued invoices; expenses count their deductible part, as forms 130
 * and 100 do, so the result matches the activity's net income before the hard-to-justify
 * allowance.
 */

/** Lines of the report: PGC account groups (two digits). */
export type PnlLine = "70" | "74" | "75" | "60" | "62" | "63" | "64" | "68" | "76" | "66";

export const PNL_LABELS: Record<PnlLine, string> = {
  "70": "Venta de mercaderías o servicios",
  "74": "Subvenciones",
  "75": "Otros ingresos de gestión",
  "60": "Compras",
  "62": "Servicios exteriores",
  "63": "Tributos",
  "64": "Gastos de personal",
  "68": "Dotaciones para amortizaciones",
  "76": "Ingresos financieros",
  "66": "Gastos financieros",
};

export const PNL_INCOME_LINES = ["70", "74", "75"] as const satisfies PnlLine[];
export const PNL_EXPENSE_LINES = ["60", "62", "63", "64"] as const satisfies PnlLine[];
export const PNL_FINANCIAL_LINES = ["76", "66"] as const satisfies PnlLine[];

/** Accounts of issued invoices without one of their own: services (705) and, for property rentals, leases (752). */
export const SERVICES_ACCOUNT = "705";
export const RENTAL_ACCOUNT = "752";

/** The report line an account (PGC, three or more digits) adds to. Unknown expense accounts go to 62. */
export function pnlLine(account: string): PnlLine {
  const group = account.slice(0, 2);
  if (group in PNL_LABELS) return group as PnlLine;
  return account.startsWith("7") ? "75" : "62";
}

export interface ProfitAndLoss {
  /** ISO dates, both included. */
  from: string;
  to: string;
  lines: Record<PnlLine, number>;
  /** Amount per account (705, 752, 6231…), for the extended version. */
  accounts: Record<string, number>;
  /** 1 – Ventas y otros ingresos. */
  income: number;
  /** 2 – Compras y otros gastos. */
  expenses: number;
  /** A – Resultado operativo: 1 − 2. */
  operating: number;
  /** B – Resultado de la explotación: A − 68. */
  exploitation: number;
  /** 3 – Ingresos y gastos financieros: 76 − 66. */
  financial: number;
  /** Resultado del ejercicio: B + 3. */
  result: number;
}

const inRange = (date: string, from: string, to: string) => date >= from && date <= to;

/** The report for documents dated from `from` to `to` (ISO dates, both included). */
export function profitAndLoss(books: TaxBooks, from: string, to: string): ProfitAndLoss {
  const accounts: Record<string, number> = {};
  const add = (account: string, amount: number) => {
    accounts[account] = (accounts[account] ?? 0) + amount;
  };

  for (const s of books.sales.filter((s) => inRange(s.date, from, to))) {
    add(
      s.account ?? (s.rental ? RENTAL_ACCOUNT : SERVICES_ACCOUNT),
      s.vatBreakdown.reduce((acc, r) => acc + r.base, 0),
    );
  }
  for (const p of books.purchases.filter((p) => inRange(p.date, from, to))) add(p.account, p.expense);
  for (const e of books.expenses.filter((e) => inRange(e.date, from, to))) add(e.account, e.expense);

  const lines = Object.fromEntries(Object.keys(PNL_LABELS).map((k) => [k, 0])) as Record<PnlLine, number>;
  for (const [account, amount] of Object.entries(accounts)) {
    accounts[account] = roundCents(amount);
    lines[pnlLine(account)] += amount;
  }
  for (const key of Object.keys(lines) as PnlLine[]) lines[key] = roundCents(lines[key]);

  const sum = (keys: readonly PnlLine[]) => roundCents(keys.reduce((acc, k) => acc + lines[k], 0));
  const income = sum(PNL_INCOME_LINES);
  const expenses = sum(PNL_EXPENSE_LINES);
  const operating = roundCents(income - expenses);
  const exploitation = roundCents(operating - lines["68"]);
  const financial = roundCents(lines["76"] - lines["66"]);

  return {
    from,
    to,
    lines,
    accounts,
    income,
    expenses,
    operating,
    exploitation,
    financial,
    result: roundCents(exploitation + financial),
  };
}

/** From January 1st to the end of the quarter: the range Contasimple reports "up to" a quarter. */
export function yearToQuarter(year: number, quarter: Quarter): { from: string; to: string } {
  const lastDay = ["03-31", "06-30", "09-30", "12-31"][quarter - 1]!;
  return { from: `${year}-01-01`, to: `${year}-${lastDay}` };
}

/** First and last day (ISO) of a quarter or a whole year. */
export function periodDates(period: Period): { from: string; to: string } {
  const months = periodMonths(period);
  const first = months[0]!;
  const last = months.at(-1)!;
  const lastDay = new Date(Date.UTC(period.year, last + 1, 0)).getUTCDate();
  const mm = (m: number) => String(m + 1).padStart(2, "0");
  return { from: `${period.year}-${mm(first)}-01`, to: `${period.year}-${mm(last)}-${lastDay}` };
}

export interface MonthResult {
  /** Zero-based month. */
  month: number;
  income: number;
  expenses: number;
  profit: number;
}

/** Income and deductible expenses of each month of a year, on the same basis as the report. */
export function monthlyResults(books: TaxBooks, year: number): MonthResult[] {
  return Array.from({ length: 12 }, (_, month) => {
    const mm = String(month + 1).padStart(2, "0");
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const pnl = profitAndLoss(books, `${year}-${mm}-01`, `${year}-${mm}-${String(lastDay)}`);
    return { month, income: pnl.income, expenses: pnl.expenses, profit: pnl.operating };
  });
}

/** Relative change from `previous` to `current`, as a fraction; null when there's nothing to compare with. */
export function relativeChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

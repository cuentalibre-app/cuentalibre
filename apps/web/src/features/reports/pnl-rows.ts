import {
  cents,
  PNL_EXPENSE_LINES,
  PNL_FINANCIAL_LINES,
  PNL_INCOME_LINES,
  PNL_LABELS,
  pnlLine,
  type Cents,
  type PnlLine,
  type ProfitAndLoss,
} from "@fiscalia/core";
import { accountLabel } from "./reports-model";

/** One row of the report, with its amount in the selected year and the one before. */
export type PnlRow =
  | { kind: "section"; label: string; values: [Cents, Cents] }
  | { kind: "line"; label: string; values: [Cents, Cents] }
  | { kind: "account"; label: string; values: [Cents, Cents] }
  | { kind: "result"; label: string; values: [Cents, Cents]; final?: boolean };

/** The rows in the reference app's order. The extended version lists each account under its line. */
export function pnlRows(current: ProfitAndLoss, previous: ProfitAndLoss, extended: boolean): PnlRow[] {
  const both = (pick: (p: ProfitAndLoss) => Cents): [Cents, Cents] => [pick(current), pick(previous)];
  const accounts = [...new Set([...Object.keys(current.accounts), ...Object.keys(previous.accounts)])].sort();

  const lines = (keys: readonly PnlLine[]): PnlRow[] =>
    keys.flatMap((key) => {
      const row: PnlRow = { kind: "line", label: `${key}. ${PNL_LABELS[key]}`, values: both((p) => p.lines[key]) };
      if (!extended) return [row];
      const detail = accounts
        .filter((a) => pnlLine(a) === key)
        .map((a): PnlRow => ({
          kind: "account",
          label: `${a}. ${accountLabel(a)}`,
          values: both((p) => p.accounts[a] ?? cents(0)),
        }));
      return [row, ...detail];
    });

  return [
    { kind: "section", label: "1 - Ventas y otros ingresos", values: both((p) => p.income) },
    ...lines(PNL_INCOME_LINES),
    { kind: "section", label: "2 - Compras y otros gastos", values: both((p) => p.expenses) },
    ...lines(PNL_EXPENSE_LINES),
    { kind: "result", label: "A - Resultado operativo", values: both((p) => p.operating) },
    ...lines(["68"]),
    { kind: "result", label: "B - Resultado de la explotación", values: both((p) => p.exploitation) },
    { kind: "section", label: "3 - Ingresos y gastos financieros", values: both((p) => p.financial) },
    ...lines(PNL_FINANCIAL_LINES),
    { kind: "result", label: "Resultado del ejercicio", values: both((p) => p.result), final: true },
  ];
}

import { useCallback, useMemo } from "react";
import { rankCounterparties, type CounterpartyRanking } from "@fiscalia/core";
import type { ExpenseType } from "@fiscalia/contracts";
import { deductibleOf, payeeOf } from "@/features/purchases/expenses-model";
import { useExpenses } from "@/features/purchases/expenses-store";
import { deductible, expenseTypeShortLabel, supplierOf } from "@/features/purchases/purchases-model";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { clientOf, documentTotals, INCOME_TYPE_GROUPS } from "@/features/sales/sales-model";
import { useSalesDocuments } from "@/features/sales/sales-store";
import { amortizationExpenses, toTaxBooks } from "@/features/taxes/tax-books";

export const REPORTS_PATH = "/informes";
export const PNL_PATH = "/informes/perdidas-y-ganancias";
export const COMPANY_REPORTS_PATH = "/informes/empresas";

const INCOME_LABELS = new Map(INCOME_TYPE_GROUPS.flatMap((g) => g.options.map((o) => [o.value as string, o.label])));

/** "Prestación de servicios", "Suministros"…: an account's name without its number. */
export function accountLabel(account: string): string {
  const income = INCOME_LABELS.get(account);
  if (income) return income.replace(/^\d+\.\s*/, "");
  return expenseTypeShortLabel(account as ExpenseType);
}

export interface Range {
  from: string;
  to: string;
}

const inRange = (date: string, { from, to }: Range) => date >= from && date <= to;

export interface Breakdowns {
  clients: CounterpartyRanking;
  suppliers: CounterpartyRanking;
  categories: CounterpartyRanking;
}

/** Everything the reports need, from the same stores as the tax pages. */
export function useReportSources() {
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  const books = useMemo(() => toTaxBooks(documents, purchases, expenses), [documents, purchases, expenses]);

  /** Who and what makes up the income and expenses of a range, on the report's basis. */
  const breakdowns = useCallback(
    (range: Range, limit = 5): Breakdowns => {
      const invoices = documents.filter((d) => d.kind === "invoice" && inRange(d.issuedOn, range));
      const bought = purchases.filter((p) => inRange(p.bookedOn, range));
      const spent = expenses.filter((e) => inRange(e.date, range));
      // Investment goods count through the amortization of the range, not when bought
      const amortized = purchases.flatMap((p) =>
        amortizationExpenses(p)
          .filter((a) => inRange(a.date, range))
          .map((a) => ({ doc: p, amount: a.expense })),
      );
      return {
        clients: rankCounterparties(
          invoices.map((d) => ({ name: clientOf(d).name, amount: documentTotals(d).base })),
          limit,
        ),
        suppliers: rankCounterparties(
          [
            ...bought.map((p) => ({ name: supplierOf(p).name, amount: deductible(p).base })),
            ...amortized.map((a) => ({ name: supplierOf(a.doc).name, amount: a.amount })),
            ...spent.map((e) => ({ name: payeeOf(e)?.name ?? "Sin proveedor", amount: deductibleOf(e) })),
          ],
          limit,
        ),
        categories: rankCounterparties(
          [
            ...bought.map((p) => ({ name: expenseTypeShortLabel(p.expenseType), amount: deductible(p).base })),
            ...amortized.map((a) => ({ name: expenseTypeShortLabel(a.doc.expenseType), amount: a.amount })),
            ...spent.map((e) => ({ name: expenseTypeShortLabel(e.expenseType), amount: deductibleOf(e) })),
          ],
          limit,
        ),
      };
    },
    [documents, purchases, expenses],
  );

  return { books, breakdowns };
}

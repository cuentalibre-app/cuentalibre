import { useMemo } from "react";
import {
  amortizationQuotas,
  type TaxableExpense,
  type TaxablePurchase,
  type TaxableSale,
  type TaxBooks,
} from "@fiscalia/core";
import type { Expense, ExpenseType, PurchaseInvoice, SalesDocument } from "@fiscalia/contracts";
import { deductibleOf } from "@/features/purchases/expenses-model";
import { useFiledBoxes } from "@/features/closing/closing-store";
import { useExpenses } from "@/features/purchases/expenses-store";
import { assetOf, deductible, purchaseTotals } from "@/features/purchases/purchases-model";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { documentTotals } from "@/features/sales/sales-model";
import { useSalesDocuments } from "@/features/sales/sales-store";
import { taxOptions } from "@/features/settings/settings-model";

/** Purchases of goods rather than services, which form 390 reports apart when intra-EU. */
const GOODS: ExpenseType[] = ["600", "602"];

/** Read on each use, so a change of method in the tax settings applies on the next render. */
export const TAX_OPTIONS = {
  get simplified() {
    return taxOptions().simplified;
  },
};

export function taxableSale(doc: SalesDocument): TaxableSale {
  const totals = documentTotals(doc);
  return {
    id: doc.id,
    date: doc.issuedOn,
    operation: doc.operationType,
    rectifying: doc.series === "rectifying",
    vatBreakdown: totals.vatBreakdown,
    withholding: totals.withholding,
    rental: doc.rental,
    account: doc.incomeType,
  };
}

export function taxablePurchase(doc: PurchaseInvoice): TaxablePurchase {
  const totals = purchaseTotals(doc);
  return {
    id: doc.id,
    date: doc.bookedOn,
    operation: doc.operationType,
    creditNote: Boolean(doc.rectifiesId) || totals.base < 0,
    goods: GOODS.includes(doc.expenseType) || Boolean(doc.asset),
    investment: Boolean(doc.asset),
    vatBreakdown: totals.vatBreakdown,
    vatShare: (doc.vatImputation ?? doc.imputation) / 100,
    expense: deductible(doc).base,
    account: doc.expenseType,
  };
}

export function taxableExpense(expense: Expense): TaxableExpense {
  return { id: expense.id, date: expense.date, expense: deductibleOf(expense), account: expense.expenseType };
}

/**
 * An investment good counts for income tax through its amortization: one expense per
 * quarter, dated on the quarter's last day, in its amortization account (68x).
 */
export function amortizationExpenses(doc: PurchaseInvoice): TaxableExpense[] {
  if (!doc.asset) return [];
  return amortizationQuotas(assetOf(doc)).map((q) => ({
    id: `${doc.id}-amortization-${q.date}`,
    date: q.date,
    expense: q.amount,
    account: doc.expenseType,
  }));
}

/** Issued invoices (drafts, quotes and delivery notes don't count), received invoices and expenses. */
export function toTaxBooks(documents: SalesDocument[], purchases: PurchaseInvoice[], expenses: Expense[]): TaxBooks {
  return {
    sales: documents.filter((d) => d.kind === "invoice").map(taxableSale),
    purchases: purchases.map(taxablePurchase),
    expenses: [...expenses.map(taxableExpense), ...purchases.flatMap(amortizationExpenses)],
  };
}

/** The books, with the returns already filed, which later quarters start from. */
export function useTaxBooks(): TaxBooks {
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  const filed = useFiledBoxes();
  return useMemo(
    () => ({ ...toTaxBooks(documents, purchases, expenses), filed }),
    [documents, purchases, expenses, filed],
  );
}

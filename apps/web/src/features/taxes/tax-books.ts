import { useMemo } from "react";
import type { TaxableExpense, TaxablePurchase, TaxableSale, TaxBooks } from "@fiscalia/core";
import { deductibleOf } from "@/features/purchases/expenses-model";
import { useExpenses } from "@/features/purchases/expenses-store";
import { deductible, purchaseTotals } from "@/features/purchases/purchases-model";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { documentTotals } from "@/features/sales/sales-model";
import { useSalesDocuments } from "@/features/sales/sales-store";
import { taxOptions } from "@/features/settings/settings-model";
import type { Expense } from "@/mocks/expenses";
import type { ExpenseType, PurchaseInvoice } from "@/mocks/purchases";
import type { SalesDocument } from "@/mocks/sales";

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
    goods: GOODS.includes(doc.expenseType),
    vatBreakdown: totals.vatBreakdown,
    vatShare: (doc.vatImputation ?? doc.imputation) / 100,
    expense: deductible(doc).base,
    account: doc.expenseType,
  };
}

export function taxableExpense(expense: Expense): TaxableExpense {
  return { id: expense.id, date: expense.date, expense: deductibleOf(expense), account: expense.expenseType };
}

/** Issued invoices (drafts, quotes and delivery notes don't count), received invoices and expenses. */
export function toTaxBooks(documents: SalesDocument[], purchases: PurchaseInvoice[], expenses: Expense[]): TaxBooks {
  return {
    sales: documents.filter((d) => d.kind === "invoice").map(taxableSale),
    purchases: purchases.map(taxablePurchase),
    expenses: expenses.map(taxableExpense),
  };
}

export function useTaxBooks(): TaxBooks {
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  return useMemo(() => toTaxBooks(documents, purchases, expenses), [documents, purchases, expenses]);
}

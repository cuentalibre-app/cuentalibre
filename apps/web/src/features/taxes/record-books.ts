import {
  WITHHOLDING_RATES,
  recordBooks,
  type ExpenseEntry,
  type IncomeEntry,
  type InvestmentEntry,
  type PurchaseEntry,
  type RecordBook,
  type RecordBookEntries,
} from "@cuentalibre/core";
import type { EconomicActivity, Expense, PurchaseInvoice, SalesDocument } from "@cuentalibre/contracts";
import { payeeOf } from "@/features/purchases/expenses-model";
import { assetOf, purchaseTotals, supplierOf } from "@/features/purchases/purchases-model";
import { clientOf } from "@/features/sales/sales-model";
import { xlsxBlob } from "@/lib/xlsx";
import { amortizationExpenses, taxableExpense, taxablePurchase, taxableSale } from "./tax-books";

/* The income tax record books Renta WEB imports, built in core; this file only maps the app's data. */

function incomeEntry(doc: SalesDocument): IncomeEntry {
  const client = clientOf(doc);
  return {
    ...taxableSale(doc),
    number: doc.number ?? "",
    operationOn: doc.operationOn,
    client: doc.clientId ? { taxId: client.taxId, name: client.name, country: client.country } : null,
    withholdingRate: WITHHOLDING_RATES[doc.withholding],
    rectificationReason: doc.rectification?.reason,
  };
}

function purchaseEntry(doc: PurchaseInvoice): PurchaseEntry {
  const supplier = supplierOf(doc);
  return {
    ...taxablePurchase(doc),
    number: doc.number,
    issuedOn: doc.issuedOn,
    operationOn: doc.operationOn,
    supplier: { taxId: supplier.taxId, name: supplier.name, country: supplier.country },
    withholding: purchaseTotals(doc).withholding,
    withholdingRate: WITHHOLDING_RATES[doc.withholding],
  };
}

function expenseEntry(expense: Expense): ExpenseEntry {
  return { ...taxableExpense(expense), amount: expense.amount, number: expense.number, payee: payeeOf(expense) };
}

/** The amortizations of an investment good: entries without an invoice or payee. */
const amortizationEntries = (doc: PurchaseInvoice): ExpenseEntry[] =>
  amortizationExpenses(doc).map((e) => ({ ...e, amount: e.expense, number: "", payee: null }));

function investmentEntry(doc: PurchaseInvoice): InvestmentEntry {
  const supplier = supplierOf(doc);
  return {
    number: doc.number,
    issuedOn: doc.issuedOn,
    supplier: { taxId: supplier.taxId, name: supplier.name, country: supplier.country },
    description: doc.lines
      .map((l) => l.concept)
      .filter(Boolean)
      .join(" · "),
    identifier: doc.asset?.identifier ?? "",
    acquisition: purchaseTotals(doc).base,
    asset: assetOf(doc),
  };
}

/** Every entry the books can hold, from the same documents the tax returns use. */
export function recordBookEntries(
  documents: SalesDocument[],
  purchases: PurchaseInvoice[],
  expenses: Expense[],
): RecordBookEntries {
  return {
    sales: documents.filter((d) => d.kind === "invoice").map(incomeEntry),
    purchases: purchases.map(purchaseEntry),
    expenses: [...expenses.map(expenseEntry), ...purchases.flatMap(amortizationEntries)],
    investments: purchases.filter((p) => p.asset).map(investmentEntry),
  };
}

/** The books as a workbook: the three header rows of the AEAT's template, then the entries. */
export function recordBooksBlob(books: RecordBook[]): Blob {
  return xlsxBlob(books.map((b) => ({ name: b.name, header: b.header[0]!, rows: [...b.header.slice(1), ...b.rows] })));
}

/** The year's books, for the main activity. */
export function recordBooksFile(
  documents: SalesDocument[],
  purchases: PurchaseInvoice[],
  expenses: Expense[],
  year: number,
  activity: EconomicActivity,
): Blob {
  return recordBooksBlob(recordBooks(recordBookEntries(documents, purchases, expenses), year, activity));
}

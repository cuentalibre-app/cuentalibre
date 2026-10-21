import {
  cents,
  daysUntil,
  estimateIncomeTax,
  incomeTaxYear,
  isEconomicallyDependent,
  isInPeriod,
  ledgerYearTotals,
  periodMonths,
  periodTotals,
  previousPeriod,
  rankCounterparties,
  sumBy,
  sumCents,
  takeHomeEstimate,
  upcomingDeadlines,
  vatReturns,
  type Cents,
  type Deadline,
  type LedgerEntry,
  type Period,
  type TaxBooks,
  type YearTotals,
} from "@cuentalibre/core";
import type { Expense, PurchaseInvoice, SalesDocument } from "@cuentalibre/contracts";
import { deductibleOf, payeeOf } from "@/features/purchases/expenses-model";
import { deductible, supplierOf } from "@/features/purchases/purchases-model";
import { clientOf, displayStatus, documentTotals } from "@/features/sales/sales-model";
import { TAX_OPTIONS, amortizationExpenses, toTaxBooks } from "@/features/taxes/tax-books";
import { settingsStore } from "@/features/settings/settings-store";

export type InvoiceStatus = "paid" | "pending" | "overdue";

export interface InvoiceSummary {
  id: string;
  number: string;
  client: string;
  /** ISO date (YYYY-MM-DD). */
  issuedOn: string;
  /** Taxable base, before VAT. */
  base: Cents;
  /** Total the client pays: base + VAT − withholding. */
  total: Cents;
  status: InvoiceStatus;
}

export interface MonthPoint {
  month: number;
  income: Cents;
  expenses: Cents;
  profit: Cents;
  cumulativeProfit: Cents;
}

export interface DeadlineItem {
  deadline: Deadline;
  /** Amount to pay, or null when it's an informative return. */
  amount: Cents | null;
  detail: string;
}

/** Percentage change, or null when there is nothing to compare with. */
function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Quarterly results of forms 303 and 130 for a year, computed once per year. */
function yearReturns(books: TaxBooks) {
  const cache = new Map<number, { vat: Cents[]; irpf: Cents[] }>();
  return (year: number) => {
    if (!cache.has(year)) {
      cache.set(year, {
        vat: vatReturns(books, year).map((r) => r.result),
        irpf: incomeTaxYear(books, year, TAX_OPTIONS).quarters.map((r) => r.result),
      });
    }
    return cache.get(year)!;
  };
}

function deadlineItem(deadline: Deadline, returns: ReturnType<typeof yearReturns>): DeadlineItem {
  const { kind, year, quarter } = deadline;
  switch (kind) {
    case "vat-303": {
      const amount = quarter ? returns(year).vat[quarter - 1]! : cents(0);
      return { deadline, amount, detail: amount < 0 ? "A compensar" : "A ingresar" };
    }
    case "irpf-130":
      return {
        deadline,
        amount: quarter ? cents(Math.max(0, returns(year).irpf[quarter - 1]!)) : null,
        detail: "Pago fraccionado",
      };
    case "social-security":
      return { deadline, amount: settingsStore.get().tax.socialSecurityFee, detail: "Seguridad Social · RETA" };
    case "vat-390":
      return { deadline, amount: null, detail: `Anual ${year}` };
  }
}

function summarize(doc: SalesDocument, today: Date): InvoiceSummary {
  const { base, total } = documentTotals(doc);
  const status = displayStatus(doc, today);
  return {
    id: doc.id,
    number: doc.number ?? "",
    client: clientOf(doc).name,
    issuedOn: doc.issuedOn,
    base,
    total,
    status: status === "paid" || status === "overdue" ? status : "pending",
  };
}

/** Invoices totalled by collection status (totals with VAT). */
function collectionStatus(invoices: InvoiceSummary[]) {
  const byStatus: Record<InvoiceStatus, { amount: Cents; count: number }> = {
    paid: { amount: cents(0), count: 0 },
    pending: { amount: cents(0), count: 0 },
    overdue: { amount: cents(0), count: 0 },
  };
  for (const inv of invoices) {
    byStatus[inv.status].amount = cents(byStatus[inv.status].amount + inv.total);
    byStatus[inv.status].count += 1;
  }
  return { byStatus, total: sumBy(invoices, (i) => i.total), count: invoices.length };
}

/**
 * Everything the dashboard shows, derived from the issued and received invoices and the expenses
 * so every figure adds up with their lists. Expenses count their deductible part.
 */
export function buildHomeData(
  period: Period,
  today: Date,
  documents: SalesDocument[],
  purchases: PurchaseInvoice[],
  otherExpenses: Expense[],
) {
  const invoiceDocs = documents
    .filter((d) => d.kind === "invoice")
    .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn));
  const issued = invoiceDocs.map((d) => summarize(d, today));
  const income = invoiceDocs.map((d): LedgerEntry => ({ date: d.issuedOn, ...documentTotals(d) }));
  const expenses = [
    ...purchases.map((p) => ({ supplier: supplierOf(p).name, date: p.bookedOn, ...deductible(p) })),
    // Investment goods count through their quarterly amortization
    ...purchases.flatMap((p) =>
      amortizationExpenses(p).map((a) => ({
        supplier: supplierOf(p).name,
        date: a.date,
        base: a.expense,
        vat: cents(0),
      })),
    ),
    // Without an invoice there is no VAT to deduct. Only saved suppliers enter the ranking
    ...otherExpenses.map((e) => ({
      supplier: e.supplierId ? payeeOf(e)!.name : null,
      date: e.date,
      base: deductibleOf(e),
      vat: cents(0),
    })),
  ];
  const expenseEntries = expenses.map((e): LedgerEntry => ({
    date: e.date,
    base: e.base,
    vat: e.vat,
    withholding: cents(0),
  }));

  const yearCache = new Map<number, YearTotals>();
  const yearTotals = (y: number) => {
    if (!yearCache.has(y)) yearCache.set(y, ledgerYearTotals(y, income, expenseEntries, today));
    return yearCache.get(y)!;
  };

  const periodInvoices = issued.filter((i) => isInPeriod(i.issuedOn, period));
  const periodExpenses = expenses.filter((e) => isInPeriod(e.date, period));

  const year = yearTotals(period.year);
  const months = periodMonths(period);
  const totals = periodTotals(year, period);
  const profit = cents(totals.income - totals.expenses);

  const previous = previousPeriod(period);
  const previousTotals = periodTotals(yearTotals(previous.year), previous);
  const previousProfit = cents(previousTotals.income - previousTotals.expenses);

  // The same returns the tax pages show, so both add up
  const returns = yearReturns(toTaxBooks(documents, purchases, otherExpenses));
  const quarters = (results: Cents[]) => (period.quarter ? [results[period.quarter - 1]!] : results);
  const vat = sumCents(quarters(returns(period.year).vat));
  const irpf = sumBy(quarters(returns(period.year).irpf), (r) => cents(Math.max(0, r)));

  // The progressive scale needs the whole year: its rate is spread over the period
  const incomeTax = estimateIncomeTax(year, period.year, TAX_OPTIONS.simplified);

  let running = cents(0);
  const monthly: (MonthPoint | null)[] = year.map((m, month) => {
    if (!m) return null;
    const profit = cents(m.income - m.expenses);
    running = cents(running + profit);
    return { month, income: m.income, expenses: m.expenses, profit, cumulativeProfit: running };
  });

  const lastMonthWithData = [...months].reverse().find((m) => monthly[m] != null) ?? months[0]!;

  const deadlines = upcomingDeadlines(today, 4).map((d) => deadlineItem(d, returns));
  const nextFiling = deadlines.find((d) => d.deadline.kind !== "social-security");
  const filingsSoon = deadlines.filter(
    (d) => d.deadline.kind !== "social-security" && daysUntil(today, d.deadline.date) <= 30,
  ).length;

  const clients = rankCounterparties(periodInvoices.map((i) => ({ name: i.client, amount: i.base })));

  return {
    period,
    previous,
    hasPrevious: previousTotals.income !== 0 || previousTotals.expenses !== 0,
    totals,
    profit,
    margin: totals.income ? (profit / totals.income) * 100 : 0,
    counts: { invoices: periodInvoices.length, receipts: periodExpenses.length },
    changes: {
      income: change(totals.income, previousTotals.income),
      expenses: change(totals.expenses, previousTotals.expenses),
      profit: change(profit, previousProfit),
    },
    taxes: { vat, irpf, total: cents(Math.max(0, vat) + irpf) },
    incomeTax,
    takeHome: takeHomeEstimate(totals, incomeTax.rate),
    months,
    monthly,
    lastMonthWithData,
    deadlines,
    nextFilingDays: nextFiling ? daysUntil(today, nextFiling.deadline.date) : null,
    filingsSoon,
    invoices: issued.slice(0, 5),
    clients,
    suppliers: rankCounterparties(
      periodExpenses.flatMap((e) => (e.supplier ? [{ name: e.supplier, amount: e.base }] : [])),
    ),
    /** Self-employed fees (PGC 6422) booked in the period, already counted as expenses. */
    socialSecurityBooked: otherExpenses
      .filter((e) => e.expenseType === "6422" && isInPeriod(e.date, period))
      .reduce((acc, e) => cents(acc + e.amount), cents(0)),
    economicallyDependent: isEconomicallyDependent(clients),
    collection: collectionStatus(periodInvoices),
  };
}

export type HomeData = ReturnType<typeof buildHomeData>;

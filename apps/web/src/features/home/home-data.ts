import {
  daysUntil,
  irpfInstallmentForPeriod,
  irpfInstallments,
  isEconomicallyDependent,
  isInPeriod,
  ledgerYearTotals,
  periodMonths,
  periodTotals,
  previousPeriod,
  rankCounterparties,
  takeHomeEstimate,
  upcomingDeadlines,
  vatSettlement,
  type Deadline,
  type LedgerEntry,
  type Period,
  type YearTotals,
} from "@fiscalia/core";
import { deductibleOf, payeeOf } from "@/features/purchases/expenses-model";
import { deductible, supplierOf } from "@/features/purchases/purchases-model";
import { clientOf, displayStatus, documentTotals } from "@/features/sales/sales-model";
import { currentUser } from "@/mocks/data";
import type { Expense } from "@/mocks/expenses";
import type { PurchaseInvoice } from "@/mocks/purchases";
import type { SalesDocument } from "@/mocks/sales";

export type InvoiceStatus = "paid" | "pending" | "overdue";

export interface InvoiceSummary {
  id: string;
  number: string;
  client: string;
  /** ISO date (YYYY-MM-DD). */
  issuedOn: string;
  /** Taxable base, before VAT. */
  base: number;
  /** Total the client pays: base + VAT − withholding. */
  total: number;
  status: InvoiceStatus;
}

export interface MonthPoint {
  month: number;
  income: number;
  expenses: number;
  profit: number;
  cumulativeProfit: number;
}

export interface DeadlineItem {
  deadline: Deadline;
  /** Amount to pay, or null when it's an informative return. */
  amount: number | null;
  detail: string;
}

/** Percentage change, or null when there is nothing to compare with. */
function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function deadlineItem(deadline: Deadline, yearTotals: (year: number) => YearTotals): DeadlineItem {
  const { kind, year, quarter } = deadline;
  switch (kind) {
    case "vat-303":
      return {
        deadline,
        amount: vatSettlement(periodTotals(yearTotals(year), { year, quarter })),
        detail: "A ingresar",
      };
    case "irpf-130":
      return {
        deadline,
        amount: quarter ? irpfInstallments(yearTotals(year))[quarter] : null,
        detail: "Pago fraccionado",
      };
    case "social-security":
      return { deadline, amount: currentUser.socialSecurityFee, detail: "Seguridad Social · RETA" };
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
  const byStatus: Record<InvoiceStatus, { amount: number; count: number }> = {
    paid: { amount: 0, count: 0 },
    pending: { amount: 0, count: 0 },
    overdue: { amount: 0, count: 0 },
  };
  for (const inv of invoices) {
    byStatus[inv.status].amount += inv.total;
    byStatus[inv.status].count += 1;
  }
  return { byStatus, total: invoices.reduce((acc, i) => acc + i.total, 0), count: invoices.length };
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
    // Without an invoice there is no VAT to deduct. Only saved suppliers enter the ranking
    ...otherExpenses.map((e) => ({
      supplier: e.supplierId ? payeeOf(e)!.name : null,
      date: e.date,
      base: deductibleOf(e),
      vat: 0,
    })),
  ];
  const expenseEntries = expenses.map((e): LedgerEntry => ({ date: e.date, base: e.base, vat: e.vat, withholding: 0 }));

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
  const profit = totals.income - totals.expenses;

  const previous = previousPeriod(period);
  const previousTotals = periodTotals(yearTotals(previous.year), previous);
  const previousProfit = previousTotals.income - previousTotals.expenses;

  const vat = vatSettlement(totals);
  const irpf = irpfInstallmentForPeriod(year, period);

  let running = 0;
  const monthly: (MonthPoint | null)[] = year.map((m, month) => {
    if (!m) return null;
    running += m.income - m.expenses;
    return { month, income: m.income, expenses: m.expenses, profit: m.income - m.expenses, cumulativeProfit: running };
  });

  const lastMonthWithData = [...months].reverse().find((m) => monthly[m] != null) ?? months[0]!;

  const deadlines = upcomingDeadlines(today, 4).map((d) => deadlineItem(d, yearTotals));
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
    taxes: { vat, irpf, total: Math.max(0, vat) + irpf },
    takeHome: takeHomeEstimate(totals),
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
      .reduce((acc, e) => acc + e.amount, 0),
    economicallyDependent: isEconomicallyDependent(clients),
    collection: collectionStatus(periodInvoices),
    /** Every unpaid invoice, whatever its date. */
    pendingCollection: issued.filter((i) => i.status !== "paid").reduce((acc, i) => acc + i.total, 0),
  };
}

export type HomeData = ReturnType<typeof buildHomeData>;

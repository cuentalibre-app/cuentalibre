import {
  daysUntil,
  irpfInstallmentForPeriod,
  irpfInstallments,
  periodMonths,
  periodTotals,
  previousPeriod,
  takeHomeEstimate,
  upcomingDeadlines,
  vatSettlement,
  type Deadline,
  type Period,
} from "@fiscalia/core";
import { currentUser, documentCounts, recentInvoices, yearTotals } from "@/mocks/data";

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

function deadlineItem(deadline: Deadline): DeadlineItem {
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

export function buildHomeData(period: Period, today: Date) {
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

  const deadlines = upcomingDeadlines(today, 4).map(deadlineItem);
  const nextFiling = deadlines.find((d) => d.deadline.kind !== "social-security");
  const filingsSoon = deadlines.filter(
    (d) => d.deadline.kind !== "social-security" && daysUntil(today, d.deadline.date) <= 30,
  ).length;

  return {
    period,
    previous,
    hasPrevious: previousTotals.income !== 0 || previousTotals.expenses !== 0,
    totals,
    profit,
    margin: totals.income ? (profit / totals.income) * 100 : 0,
    counts: documentCounts(period.year, months),
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
    invoices: recentInvoices,
    pendingCollection: recentInvoices.filter((i) => i.status !== "paid").reduce((acc, i) => acc + i.total, 0),
  };
}

export type HomeData = ReturnType<typeof buildHomeData>;

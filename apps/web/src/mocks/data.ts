import { GENERAL_VAT_RATE, type MonthTotals, type YearTotals } from "@fiscalia/core";

/**
 * Sample data until there is a backend. Figures come from the design mockups.
 * Every amount is a tax base (before VAT) and every invoice is assumed to be at 21% VAT.
 */

interface RawYear {
  income: (number | null)[];
  expenses: (number | null)[];
  invoices: number[];
  receipts: number[];
}

const RAW: Record<number, RawYear> = {
  2025: {
    income: [3800, 4100, 4600, 4400, 4700, 5000, 5300, 3900, 5900, 5600, 5800, 6200],
    expenses: [1200, 600, 650, 900, 700, 800, 850, 600, 1000, 900, 750, 1100],
    invoices: [2, 2, 2, 2, 2, 2, 3, 2, 3, 3, 3, 3],
    receipts: [5, 4, 4, 5, 4, 4, 5, 3, 5, 4, 4, 5],
  },
  2026: {
    income: [4300, 4900, 5600, 5200, 5400, 5830, 6200, 4600, 7600, 2950, null, null],
    expenses: [1400, 700, 750, 1100, 800, 1020, 900, 650, 1350, 310, null, null],
    invoices: [2, 2, 3, 2, 2, 3, 3, 1, 3, 1, 0, 0],
    receipts: [6, 4, 4, 5, 4, 5, 5, 4, 5, 2, 0, 0],
  },
};

export const availableYears = Object.keys(RAW)
  .map(Number)
  .sort((a, b) => b - a);

export function yearTotals(year: number): YearTotals {
  const raw = RAW[year];
  if (!raw) return Array.from({ length: 12 }, () => null);
  return raw.income.map((income, m): MonthTotals | null => {
    const expenses = raw.expenses[m];
    if (income == null || expenses == null) return null;
    return {
      income,
      expenses,
      outputVat: income * GENERAL_VAT_RATE,
      inputVat: expenses * GENERAL_VAT_RATE,
      withholdings: 0,
    };
  });
}

export function documentCounts(year: number, months: number[]) {
  const raw = RAW[year];
  const sum = (list: number[] | undefined) => months.reduce((acc, m) => acc + (list?.[m] ?? 0), 0);
  return { invoices: sum(raw?.invoices), receipts: sum(raw?.receipts) };
}

export type InvoiceStatus = "paid" | "pending" | "overdue";

export interface InvoiceSummary {
  number: string;
  client: string;
  /** ISO date (YYYY-MM-DD). */
  issuedOn: string;
  /** Total including VAT. */
  total: number;
  status: InvoiceStatus;
}

export const recentInvoices: InvoiceSummary[] = [
  { number: "2026-0047", client: "Estudio Norte S.L.", issuedOn: "2026-09-28", total: 4876, status: "pending" },
  { number: "2026-0046", client: "Agencia Brisa", issuedOn: "2026-09-15", total: 2120, status: "paid" },
  { number: "2026-0045", client: "Talleres Ruiz S.C.", issuedOn: "2026-09-02", total: 1060, status: "overdue" },
  { number: "2026-0044", client: "Estudio Norte S.L.", issuedOn: "2026-08-29", total: 4876, status: "paid" },
  { number: "2026-0043", client: "Lumen Software S.A.", issuedOn: "2026-07-31", total: 3180, status: "paid" },
];

export const currentUser = {
  name: "Lucía Martín",
  initials: "LM",
  taxRegime: "Estimación directa simplificada",
  /** Monthly RETA fee. */
  socialSecurityFee: 294,
};

export const draftInvoicesCount = 2;

export const quarterClose = { quarter: 3, year: 2026, stepsDone: 3, stepsTotal: 5 } as const;

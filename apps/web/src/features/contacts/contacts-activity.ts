import { cents, isInPeriod, sumBy, sumCents, type Cents, type Period } from "@cuentalibre/core";
import type { ContactRole, Expense, PurchaseInvoice, SalesDocument, SalesKind } from "@cuentalibre/contracts";
import type { BadgeProps } from "@cuentalibre/ui/components/badge";
import { EXPENSES_PATH, EXPENSE_STATUS, expenseStatus } from "@/features/purchases/expenses-model";
import { PURCHASES_PATH, PURCHASE_STATUS, purchaseStatus, purchaseTotals } from "@/features/purchases/purchases-model";
import { KINDS, STATUS, displayStatus, documentTotals } from "@/features/sales/sales-model";

/** Kinds of document a contact can have. */
export type ActivityKind = SalesKind | "purchase" | "expense";

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  invoice: "Factura emitida",
  draft: "Borrador",
  quote: "Presupuesto",
  deliveryNote: "Albarán",
  purchase: "Factura recibida",
  expense: "Gasto",
};

/** One document of the contact, as the sheet lists it. */
export interface ActivityRow {
  id: string;
  kind: ActivityKind;
  number: string;
  /** ISO date that decides the quarter. */
  date: string;
  total: Cents;
  /** What has been collected or paid of the total. */
  settled: Cents;
  status: { label: string; tone: BadgeProps["tone"] };
  path: string;
}

interface Sources {
  sales: SalesDocument[];
  purchases: PurchaseInvoice[];
  expenses: Expense[];
}

/** Every document of a contact, newest first. */
export function contactActivity(role: ContactRole, id: string, sources: Sources, today: Date): ActivityRow[] {
  const rows: ActivityRow[] =
    role === "client"
      ? sources.sales
          .filter((d) => d.clientId === id)
          .map((d) => {
            const { total } = documentTotals(d);
            return {
              id: d.id,
              kind: d.kind,
              number: d.number ?? "Sin número",
              date: d.issuedOn,
              total,
              settled: d.kind === "invoice" && d.status === "paid" ? total : cents(0),
              status: STATUS[displayStatus(d, today)],
              path: `${KINDS[d.kind].path}/${d.id}`,
            };
          })
      : [
          ...sources.purchases
            .filter((d) => d.supplierId === id)
            .map((d) => ({
              id: d.id,
              kind: "purchase" as const,
              number: d.number,
              date: d.bookedOn,
              total: purchaseTotals(d).total,
              settled: sumBy(d.payments, (p) => p.amount),
              status: PURCHASE_STATUS[purchaseStatus(d, today)],
              path: `${PURCHASES_PATH}/${d.id}`,
            })),
          ...sources.expenses
            .filter((e) => e.supplierId === id)
            .map((e) => ({
              id: e.id,
              kind: "expense" as const,
              number: e.number || e.concept,
              date: e.date,
              total: e.amount,
              settled: e.payment ? e.amount : cents(0),
              status: EXPENSE_STATUS[expenseStatus(e)],
              path: `${EXPENSES_PATH}/${e.id}`,
            })),
        ];
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export interface KindSummary {
  count: number;
  total: Cents;
}

export interface ActivitySummary {
  byKind: Partial<Record<ActivityKind, KindSummary>>;
  /** Clients: invoiced over quoted. Null without quotes. */
  invoicedOverQuoted: number | null;
  /** Collected (clients) or paid (suppliers) over invoiced. Null without invoices. */
  settledRatio: number | null;
  /** Invoiced and not yet collected or paid. */
  outstanding: Cents;
}

/** What the "Informes de facturación" tab shows, for all time or one period. */
export function summarizeActivity(rows: ActivityRow[], period?: Period): ActivitySummary {
  const inScope = period ? rows.filter((r) => isInPeriod(r.date, period)) : rows;
  const byKind: ActivitySummary["byKind"] = {};
  for (const r of inScope) {
    const k = (byKind[r.kind] ??= { count: 0, total: cents(0) });
    k.count += 1;
    k.total = cents(k.total + r.total);
  }
  // Credit notes and invoices both count, so a fully refunded invoice nets out
  const invoiced = inScope.filter((r) => r.kind === "invoice" || r.kind === "purchase" || r.kind === "expense");
  const invoicedTotal = sumBy(invoiced, (r) => r.total);
  const settled = sumCents(invoiced.map((r) => r.settled));
  const quoted = byKind.quote?.total ?? 0;
  return {
    byKind,
    invoicedOverQuoted: quoted > 0 ? Math.min(1, (byKind.invoice?.total ?? 0) / quoted) : null,
    settledRatio: invoicedTotal > 0 ? Math.min(1, settled / invoicedTotal) : null,
    outstanding: cents(Math.max(0, invoicedTotal - settled)),
  };
}

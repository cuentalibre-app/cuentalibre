import { useMemo } from "react";
import {
  isInPeriod,
  numberingGaps,
  periodKey,
  periodMonths,
  previousPeriod,
  quarterOfMonth,
  type Period,
  type Quarter,
} from "@fiscalia/core";
import type { ClosedQuarter } from "@fiscalia/contracts";
import { useExpenses } from "@/features/purchases/expenses-store";
import { EXPENSES_PATH } from "@/features/purchases/expenses-model";
import { outstanding, PURCHASES_PATH } from "@/features/purchases/purchases-model";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { KINDS } from "@/features/sales/sales-model";
import { useSalesDocuments } from "@/features/sales/sales-store";

export const CLOSING_PATH = "/cierre-trimestre";

/** "T3 2026" */
export function quarterName(period: Period): string {
  return `T${period.quarter} ${period.year}`;
}

/** Shown wherever a closed quarter blocks a change. */
export function lockedMessage(period: Period): string {
  return `El ${quarterName(period)} está cerrado. Reábrelo en Cierre de trimestres para hacer cambios.`;
}

export function closingPath(period: Period): string {
  return `${CLOSING_PATH}?periodo=${periodKey(period)}`;
}

/**
 * One item to review before closing. Warnings are worth fixing first (they change the returns);
 * notices don't block anything.
 */
export interface QuarterCheck {
  id: string;
  tone: "ok" | "warning" | "notice";
  title: string;
  detail: string;
  /** Where to fix it. */
  to?: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function useQuarterChecks(period: Period): QuarterCheck[] {
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();

  return useMemo(() => {
    const inQuarter = (isoDate: string) => isInPeriod(isoDate, period);
    const key = periodKey(period);
    const lastMonth = periodMonths(period).at(-1)! + 1;
    const quarterEnd = `${period.year}-${String(lastMonth).padStart(2, "0")}-31`;

    const drafts = documents.filter((d) => d.kind === "draft" && inQuarter(d.issuedOn));
    const invoices = documents.filter((d) => d.kind === "invoice" && d.number !== null);
    // Gaps up to the end of the quarter, within the year: later invoices can't fill them
    const gaps = numberingGaps(
      invoices
        .filter((d) => d.issuedOn.startsWith(String(period.year)) && d.issuedOn <= quarterEnd)
        .map((d) => d.number!),
    );
    const uncollected = invoices.filter((d) => inQuarter(d.issuedOn) && d.status !== "paid");
    const quarterPurchases = purchases.filter((p) => inQuarter(p.bookedOn));
    const unpaid = quarterPurchases.filter((p) => outstanding(p) !== 0);
    const quarterExpenses = expenses.filter((e) => inQuarter(e.date));
    const withoutReceipt =
      quarterPurchases.filter((p) => !p.attachments?.length).length +
      quarterExpenses.filter((e) => !e.attachments?.length).length;

    return [
      drafts.length
        ? {
            id: "drafts",
            tone: "warning",
            title: plural(drafts.length, "borrador con fecha del trimestre", "borradores con fecha del trimestre"),
            detail: "Un borrador no cuenta en los impuestos. Emítelo o cámbiale la fecha antes de cerrar.",
            to: `${KINDS.draft.path}?periodo=${key}`,
          }
        : {
            id: "drafts",
            tone: "ok",
            title: "Sin borradores pendientes",
            detail: "Todas las facturas del trimestre están emitidas.",
          },
      gaps.length
        ? {
            id: "numbering",
            tone: "warning",
            title: plural(gaps.length, "número de factura sin usar", "números de factura sin usar"),
            detail: `La numeración debe ser correlativa. Falta${gaps.length === 1 ? "" : "n"}: ${gaps.slice(0, 5).join(", ")}${gaps.length > 5 ? "…" : ""}.`,
            to: `${KINDS.invoice.path}?periodo=${key}`,
          }
        : {
            id: "numbering",
            tone: "ok",
            title: "Numeración correlativa",
            detail: "No faltan números en las series de facturas.",
          },
      uncollected.length
        ? {
            id: "uncollected",
            tone: "notice",
            title: plural(uncollected.length, "factura emitida sin cobrar", "facturas emitidas sin cobrar"),
            detail: "No impide cerrar: podrás marcarlas como cobradas desde la lista con el trimestre cerrado.",
            to: `${KINDS.invoice.path}?periodo=${key}`,
          }
        : { id: "uncollected", tone: "ok", title: "Facturas emitidas cobradas", detail: "No hay cobros pendientes." },
      unpaid.length
        ? {
            id: "unpaid",
            tone: "notice",
            title: plural(unpaid.length, "factura recibida sin pagar", "facturas recibidas sin pagar"),
            detail: "No impide cerrar: podrás marcarlas como pagadas desde la lista con el trimestre cerrado.",
            to: `${PURCHASES_PATH}?periodo=${key}`,
          }
        : { id: "unpaid", tone: "ok", title: "Facturas recibidas pagadas", detail: "No hay pagos pendientes." },
      withoutReceipt
        ? {
            id: "receipts",
            tone: "notice",
            title: plural(withoutReceipt, "compra sin justificante adjunto", "compras sin justificante adjunto"),
            detail: "Guarda las facturas y tiques: Hacienda puede pedirlos durante cuatro años.",
            to: quarterPurchases.some((p) => !p.attachments?.length)
              ? `${PURCHASES_PATH}?periodo=${key}`
              : `${EXPENSES_PATH}?periodo=${key}`,
          }
        : {
            id: "receipts",
            tone: "ok",
            title: "Justificantes adjuntos",
            detail: "Todas las compras tienen su justificante.",
          },
    ] satisfies QuarterCheck[];
  }, [documents, purchases, expenses, period]);
}

/**
 * The quarter to close next: the last one that has ended, unless it's closed already, in which
 * case the one in progress.
 */
export function quarterToClose(today: Date, closed: ClosedQuarter[]): Period {
  const current: Period = { year: today.getFullYear(), quarter: quarterOfMonth(today.getMonth()) as Quarter };
  const previous = previousPeriod(current);
  return closed.some((c) => c.period === periodKey(previous)) ? current : previous;
}

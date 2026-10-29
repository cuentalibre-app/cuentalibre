import { HandCoins, Receipt, ReceiptText, Wallet, type LucideIcon } from "lucide-react";
import { cents, type Cents } from "@cuentalibre/core";
import type { Expense, ManualPayment, PurchaseInvoice, SalesDocument } from "@cuentalibre/contracts";
import { EXPENSES_PATH, payeeOf } from "@/features/purchases/expenses-model";
import { PURCHASES_PATH, supplierOf } from "@/features/purchases/purchases-model";
import { KINDS, clientOf } from "@/features/sales/sales-model";

export const TREASURY_PATH = "/bancos";
/** Old address of the payments list, now the whole of banks. */
export const OLD_PAYMENTS_PATH = "/bancos/cobros-y-pagos";

export type PaymentSource = "sale" | "purchase" | "expense" | "manual";

export const PAYMENT_SOURCES: Record<PaymentSource, { label: string; icon: LucideIcon }> = {
  sale: { label: "Factura emitida", icon: ReceiptText },
  purchase: { label: "Factura recibida", icon: Receipt },
  expense: { label: "Gasto", icon: Wallet },
  manual: { label: "Manual", icon: HandCoins },
};

export const PAYMENT_SOURCE_ORDER: PaymentSource[] = ["sale", "purchase", "expense", "manual"];

/**
 * A collection or payment recorded in cuentalibre: an invoice marked as collected, a payment of a
 * received invoice or an expense, or a manual one. Signed: positive for money in.
 */
export interface TreasuryPayment {
  /** Stable across renders: "sale:<payment id>", "purchase:<payment id>", "expense:<id>", "manual:<id>". */
  key: string;
  source: PaymentSource;
  /** Number of the linked document, or the manual payment's description. */
  reference: string;
  counterparty: string;
  date: string;
  amount: Cents;
  paymentMethodId: string;
  /** The linked document's page, null for manual payments. */
  href: string | null;
}

interface Books {
  sales: SalesDocument[];
  purchases: PurchaseInvoice[];
  expenses: Expense[];
  manual: ManualPayment[];
}

export const saleHref = (id: string) => `${KINDS.invoice.path}/${id}`;
export const purchaseHref = (id: string) => `${PURCHASES_PATH}/${id}`;
export const expenseHref = (id: string) => `${EXPENSES_PATH}/${id}`;

/** Every recorded collection and payment, newest first. */
export function collectPayments({ sales, purchases, expenses, manual }: Books): TreasuryPayment[] {
  const payments: TreasuryPayment[] = [];

  for (const doc of sales) {
    if (doc.kind !== "invoice" || !doc.payments) continue;
    const counterparty = clientOf(doc).name;
    for (const p of doc.payments)
      payments.push({
        key: `sale:${p.id}`,
        source: "sale",
        reference: doc.number ?? "",
        counterparty,
        date: p.date,
        amount: p.amount,
        paymentMethodId: p.paymentMethodId,
        href: saleHref(doc.id),
      });
  }

  for (const doc of purchases) {
    const counterparty = supplierOf(doc).name;
    for (const p of doc.payments)
      payments.push({
        key: `purchase:${p.id}`,
        source: "purchase",
        reference: doc.number,
        counterparty,
        date: p.date,
        amount: cents(-p.amount),
        paymentMethodId: p.paymentMethodId,
        href: purchaseHref(doc.id),
      });
  }

  for (const e of expenses) {
    if (!e.payment) continue;
    payments.push({
      key: `expense:${e.id}`,
      source: "expense",
      reference: e.number || e.concept,
      counterparty: payeeOf(e)?.name ?? "",
      date: e.payment.date,
      amount: cents(-e.amount),
      paymentMethodId: e.payment.paymentMethodId,
      href: expenseHref(e.id),
    });
  }

  for (const m of manual)
    payments.push({
      key: `manual:${m.id}`,
      source: "manual",
      reference: m.description,
      counterparty: "",
      date: m.date,
      amount: m.amount,
      paymentMethodId: m.paymentMethodId,
      href: null,
    });

  return payments.sort((a, b) => b.date.localeCompare(a.date));
}

import { HandCoins, Receipt, ReceiptText, Wallet, type LucideIcon } from "lucide-react";
import { cents, type Cents } from "@cuentalibre/core";
import type {
  Expense,
  ManualPayment,
  PaymentMethod,
  PurchaseInvoice,
  SalesDocument,
  TreasuryAccount,
} from "@cuentalibre/contracts";
import { EXPENSES_PATH, payeeOf } from "@/features/purchases/expenses-model";
import { PURCHASES_PATH, supplierOf } from "@/features/purchases/purchases-model";
import { KINDS, clientOf } from "@/features/sales/sales-model";

export const TREASURY_PATH = "/bancos";
export const PAYMENTS_PATH = "/bancos/cobros-y-pagos";

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
  accountId: string | null;
  /** The linked document's page, null for manual payments. */
  href: string | null;
}

interface Books {
  sales: SalesDocument[];
  purchases: PurchaseInvoice[];
  expenses: Expense[];
  manual: ManualPayment[];
  methods: PaymentMethod[];
}

export const saleHref = (id: string) => `${KINDS.invoice.path}/${id}`;
export const purchaseHref = (id: string) => `${PURCHASES_PATH}/${id}`;
export const expenseHref = (id: string) => `${EXPENSES_PATH}/${id}`;

/** Every recorded collection and payment, newest first. */
export function collectPayments({ sales, purchases, expenses, manual, methods }: Books): TreasuryPayment[] {
  const accountOf = (methodId: string) => methods.find((m) => m.id === methodId)?.accountId ?? null;
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
        accountId: accountOf(p.paymentMethodId),
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
        accountId: accountOf(p.paymentMethodId),
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
      accountId: accountOf(e.payment.paymentMethodId),
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
      accountId: accountOf(m.paymentMethodId),
      href: null,
    });

  return payments.sort((a, b) => b.date.localeCompare(a.date));
}

export function accountName(id: string | null, accounts: TreasuryAccount[]): string {
  if (!id) return "Sin cuenta";
  return accounts.find((a) => a.id === id)?.name ?? "Cuenta eliminada";
}

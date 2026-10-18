import { HandCoins, Receipt, ReceiptText, Wallet, type LucideIcon } from "lucide-react";
import { cents, sumBy, type Cents, type ReconciliationStatus } from "@fiscalia/core";
import type { BadgeProps } from "@fiscalia/ui/components/badge";
import { EXPENSES_PATH, payeeOf } from "@/features/purchases/expenses-model";
import { PURCHASES_PATH, outstanding, supplierOf } from "@/features/purchases/purchases-model";
import { KINDS, clientOf, documentTotals } from "@/features/sales/sales-model";
import type { Expense } from "@/mocks/expenses";
import type { PurchaseInvoice } from "@/mocks/purchases";
import type { SalesDocument } from "@/mocks/sales";
import type { PaymentMethod, TreasuryAccount } from "@/mocks/settings";
import type { BankMovement, ManualPayment } from "@/mocks/treasury";

export const TREASURY_PATH = "/bancos";
export const MOVEMENTS_PATH = "/bancos/movimientos";
export const RECONCILIATION_PATH = "/bancos/conciliacion";
export const PAYMENTS_PATH = "/bancos/cobros-y-pagos";

export type PaymentSource = "sale" | "purchase" | "expense" | "manual";

export const PAYMENT_SOURCES: Record<PaymentSource, { label: string; icon: LucideIcon }> = {
  sale: { label: "Factura emitida", icon: ReceiptText },
  purchase: { label: "Factura recibida", icon: Receipt },
  expense: { label: "Gasto", icon: Wallet },
  manual: { label: "Manual", icon: HandCoins },
};

export const PAYMENT_SOURCE_ORDER: PaymentSource[] = ["sale", "purchase", "expense", "manual"];

export const RECONCILIATION: Record<ReconciliationStatus, { label: string; tone: BadgeProps["tone"] }> = {
  none: { label: "Sin conciliar", tone: "warning" },
  partial: { label: "Parcial", tone: "primary" },
  full: { label: "Conciliado", tone: "success" },
};

export const RECONCILIATION_ORDER: ReconciliationStatus[] = ["none", "partial", "full"];

/**
 * A collection or payment recorded in Fiscalia: an invoice marked as collected, a payment of a
 * received invoice or an expense, or a manual one. Signed like bank movements.
 */
export interface TreasuryPayment {
  /** Stable across renders: "sale:<id>", "purchase:<payment id>", "expense:<id>", "manual:<id>". */
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

/** An invoice or expense not yet (fully) paid, which reconciling a movement can settle. */
export interface PendingDocument {
  key: string;
  source: Exclude<PaymentSource, "manual">;
  docId: string;
  reference: string;
  counterparty: string;
  /** Due date when it has one, otherwise the issue date. */
  date: string;
  /** What is left to collect (positive) or pay (negative). */
  amount: Cents;
  href: string;
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
    if (doc.kind !== "invoice" || doc.status !== "paid") continue;
    const methodId = doc.paymentMethodId ?? "";
    payments.push({
      key: `sale:${doc.id}`,
      source: "sale",
      reference: doc.number ?? "",
      counterparty: clientOf(doc).name,
      date: doc.paidOn ?? doc.issuedOn,
      amount: documentTotals(doc).total,
      paymentMethodId: methodId,
      accountId: accountOf(methodId),
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

/** Issued invoices to collect, received invoices and expenses to pay. */
export function pendingDocuments({ sales, purchases, expenses }: Omit<Books, "manual" | "methods">): PendingDocument[] {
  const pending: PendingDocument[] = [];
  for (const doc of sales) {
    if (doc.kind !== "invoice" || doc.status !== "pending") continue;
    pending.push({
      key: `pending-sale:${doc.id}`,
      source: "sale",
      docId: doc.id,
      reference: doc.number ?? "",
      counterparty: clientOf(doc).name,
      date: doc.dueOn ?? doc.issuedOn,
      amount: documentTotals(doc).total,
      href: saleHref(doc.id),
    });
  }
  for (const doc of purchases) {
    const left = outstanding(doc);
    if (left === 0) continue;
    pending.push({
      key: `pending-purchase:${doc.id}`,
      source: "purchase",
      docId: doc.id,
      reference: doc.number,
      counterparty: supplierOf(doc).name,
      date: doc.dueOn ?? doc.issuedOn,
      amount: cents(-left),
      href: purchaseHref(doc.id),
    });
  }
  for (const e of expenses) {
    if (e.payment) continue;
    pending.push({
      key: `pending-expense:${e.id}`,
      source: "expense",
      docId: e.id,
      reference: e.number || e.concept,
      counterparty: payeeOf(e)?.name ?? "",
      date: e.date,
      amount: cents(-e.amount),
      href: expenseHref(e.id),
    });
  }
  return pending;
}

/** The method to record a payment through an account: the default one if it books there, else the first active. */
export function methodForAccount(accountId: string, methods: PaymentMethod[], defaultId: string): string | null {
  const linked = methods.filter((m) => m.active && m.accountId === accountId);
  return (linked.find((m) => m.id === defaultId) ?? linked[0])?.id ?? null;
}

/** Sum of the linked payments that still exist: a payment deleted elsewhere stops counting. */
export function matchedAmount(movement: BankMovement, paymentsByKey: Map<string, TreasuryPayment>): Cents {
  return sumBy(movement.paymentKeys, (key) => paymentsByKey.get(key)?.amount ?? cents(0));
}

/**
 * Balance of an account: the last balance the bank reported plus anything recorded after it,
 * or the plain sum of its movements when the bank gives none.
 */
export function accountBalance(accountId: string, movements: BankMovement[]): Cents {
  const own = movements.filter((m) => m.accountId === accountId);
  const lastReported = own.findLastIndex((m) => m.balance !== null);
  if (lastReported === -1) return sumBy(own, (m) => m.amount);
  return cents(own[lastReported]!.balance! + sumBy(own.slice(lastReported + 1), (m) => m.amount));
}

export function accountName(id: string | null, accounts: TreasuryAccount[]): string {
  if (!id) return "Sin cuenta";
  return accounts.find((a) => a.id === id)?.name ?? "Cuenta eliminada";
}

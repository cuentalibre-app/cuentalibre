import { useMemo, useSyncExternalStore } from "react";
import { cents, toIsoDate } from "@fiscalia/core";
import { expensesStore, useExpenses } from "@/features/purchases/expenses-store";
import { purchasesStore, usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { salesStore, useSalesDocuments } from "@/features/sales/sales-store";
import { settingsStore, useSettings } from "@/features/settings/settings-store";
import { initialManualPayments, sampleMovements, type BankMovement, type ManualPayment } from "@/mocks/treasury";
import { collectPayments, methodForAccount, pendingDocuments, type PendingDocument } from "./treasury-model";

/**
 * Bank movements and manual payments, in memory until reload like the other stores. Payments of
 * invoices and expenses live in their own stores; this one only links them to movements.
 */
interface TreasuryState {
  /** Oldest first, so an account's running balance reads in order. */
  movements: BankMovement[];
  manualPayments: ManualPayment[];
}

const books = () => ({
  sales: salesStore.all(),
  purchases: purchasesStore.all(),
  expenses: expensesStore.all(),
  manual: initialManualPayments,
  methods: settingsStore.get().paymentMethods,
});

let state: TreasuryState = {
  movements: sampleMovements(collectPayments(books()), toIsoDate(new Date())),
  manualPayments: initialManualPayments,
};
const listeners = new Set<() => void>();

function commit(changes: Partial<TreasuryState>) {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTreasury(): TreasuryState {
  return useSyncExternalStore(subscribe, () => state);
}

/** Every recorded collection and payment, newest first. Recomputed only when a source changes. */
export function usePayments() {
  const sales = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  const { manualPayments: manual } = useTreasury();
  const { paymentMethods: methods } = useSettings();
  return useMemo(
    () => collectPayments({ sales, purchases, expenses, manual, methods }),
    [sales, purchases, expenses, manual, methods],
  );
}

export function usePendingDocuments() {
  const sales = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  return useMemo(() => pendingDocuments({ sales, purchases, expenses }), [sales, purchases, expenses]);
}

const byDate = (a: BankMovement, b: BankMovement) => a.date.localeCompare(b.date);
const newId = (prefix: string) => `${prefix}${crypto.randomUUID().slice(0, 8)}`;

/**
 * Records the payment that settles a pending document, on the movement's date and through a
 * method of its account, and returns the new payment's key.
 */
function settle(doc: PendingDocument, movement: BankMovement): string {
  const { paymentMethods, defaultPaymentMethodId } = settingsStore.get();
  const methodId =
    methodForAccount(movement.accountId, paymentMethods, defaultPaymentMethodId) ?? defaultPaymentMethodId;
  const date = movement.date;
  switch (doc.source) {
    case "sale":
      salesStore.update(doc.docId, { status: "paid", paidOn: date, paymentMethodId: methodId });
      return `sale:${doc.docId}`;
    case "purchase": {
      const invoice = purchasesStore.get(doc.docId)!;
      const payment = { id: newId("pay"), date, amount: cents(-doc.amount), paymentMethodId: methodId };
      purchasesStore.update(doc.docId, { payments: [...invoice.payments, payment] });
      return `purchase:${payment.id}`;
    }
    case "expense":
      expensesStore.update(doc.docId, { payment: { date, paymentMethodId: methodId } });
      return `expense:${doc.docId}`;
  }
}

const updateMovement = (id: string, changes: Partial<BankMovement>) =>
  commit({ movements: state.movements.map((m) => (m.id === id ? { ...m, ...changes } : m)) });

export const treasuryStore = {
  get: () => state,

  addMovements: (movements: Omit<BankMovement, "id" | "paymentKeys">[]) =>
    commit({
      movements: [...state.movements, ...movements.map((m) => ({ ...m, id: newId("mv"), paymentKeys: [] }))].sort(
        byDate,
      ),
    }),
  removeMovement: (id: string) => commit({ movements: state.movements.filter((m) => m.id !== id) }),

  /** Links recorded payments and settles pending documents, all against one movement. */
  reconcile: (movementId: string, paymentKeys: string[], pending: PendingDocument[] = []) => {
    const movement = state.movements.find((m) => m.id === movementId);
    if (!movement) return;
    const settled = pending.map((doc) => settle(doc, movement));
    const keys = [...new Set([...movement.paymentKeys, ...paymentKeys, ...settled])];
    updateMovement(movementId, { paymentKeys: keys });
  },
  /** Undoes the links; the payments themselves stay recorded. */
  unreconcile: (movementId: string) => updateMovement(movementId, { paymentKeys: [] }),

  addManualPayment: (payment: Omit<ManualPayment, "id">): string => {
    const id = newId("mp");
    commit({ manualPayments: [...state.manualPayments, { ...payment, id }] });
    return `manual:${id}`;
  },
  removeManualPayment: (id: string) => {
    const key = `manual:${id}`;
    commit({
      manualPayments: state.manualPayments.filter((p) => p.id !== id),
      movements: state.movements.map((m) =>
        m.paymentKeys.includes(key) ? { ...m, paymentKeys: m.paymentKeys.filter((k) => k !== key) } : m,
      ),
    });
  },
};

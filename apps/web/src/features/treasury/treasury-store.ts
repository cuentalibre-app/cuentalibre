import { useMemo } from "react";
import { cents, newId, toIsoDate } from "@cuentalibre/core";
import type { BankMovement, ManualPayment } from "@cuentalibre/contracts";
import { expensesStore, useExpenses } from "@/features/purchases/expenses-store";
import { purchasesStore, usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { withPayments } from "@/features/sales/sales-model";
import { salesStore, useSalesDocuments } from "@/features/sales/sales-store";
import { settingsStore, useSettings } from "@/features/settings/settings-store";
import { initialManualPayments, sampleMovements } from "@/mocks/treasury";
import type { Command } from "@/data/commands";
import { createStore } from "@/data/store";
import { listTarget, syncTarget } from "@/data/sync";
import { collectPayments, methodForAccount, pendingDocuments, type PendingDocument } from "./treasury-model";

/**
 * Bank movements and manual payments. Payments of invoices and expenses live in their own
 * stores; this one only links them to movements.
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

const treasury = createStore<TreasuryState>({
  movements: sampleMovements(collectPayments(books()), toIsoDate(new Date())),
  manualPayments: initialManualPayments,
});

export function useTreasury(): TreasuryState {
  return treasury.use();
}

const write = (changes: Partial<TreasuryState>, commands: Command[]) =>
  treasury.write({ ...treasury.get(), ...changes }, commands);

const byDate = (a: BankMovement, b: BankMovement) => a.date.localeCompare(b.date);

const take = (changes: Partial<TreasuryState>) => treasury.set({ ...treasury.get(), ...changes });

syncTarget(
  "bankMovements",
  listTarget(
    () => treasury.get().movements,
    (movements) => take({ movements }),
    (movements) => [...movements].sort(byDate),
  ),
);
syncTarget(
  "manualPayments",
  listTarget(
    () => treasury.get().manualPayments,
    (manualPayments) => take({ manualPayments }),
  ),
);

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
    case "sale": {
      const invoice = salesStore.get(doc.docId)!;
      const payment = { id: newId(), date, amount: doc.amount, paymentMethodId: methodId };
      salesStore.update(doc.docId, withPayments(invoice, [...(invoice.payments ?? []), payment]));
      return `sale:${payment.id}`;
    }
    case "purchase": {
      const invoice = purchasesStore.get(doc.docId)!;
      const payment = { id: newId(), date, amount: cents(-doc.amount), paymentMethodId: methodId };
      purchasesStore.update(doc.docId, { payments: [...invoice.payments, payment] });
      return `purchase:${payment.id}`;
    }
    case "expense":
      expensesStore.update(doc.docId, { payment: { date, paymentMethodId: methodId } });
      return `expense:${doc.docId}`;
  }
}

const updateMovement = (id: string, changes: Partial<BankMovement>) =>
  write({ movements: treasury.get().movements.map((m) => (m.id === id ? { ...m, ...changes } : m)) }, [
    { type: "update", entity: "bankMovements", id, changes },
  ]);

export const treasuryStore = {
  get: treasury.get,

  addMovements(movements: Omit<BankMovement, "id" | "paymentKeys">[]) {
    const added = movements.map((m) => ({ ...m, id: newId(), paymentKeys: [] }));
    return write(
      { movements: [...treasury.get().movements, ...added].sort(byDate) },
      added.map((data): Command => ({ type: "create", entity: "bankMovements", data })),
    );
  },
  removeMovement: (id: string) =>
    write({ movements: treasury.get().movements.filter((m) => m.id !== id) }, [
      { type: "delete", entity: "bankMovements", id },
    ]),

  /** Links recorded payments and settles pending documents, all against one movement. */
  reconcile: (movementId: string, paymentKeys: string[], pending: PendingDocument[] = []) => {
    const movement = treasury.get().movements.find((m) => m.id === movementId);
    if (!movement) return;
    const settled = pending.map((doc) => settle(doc, movement));
    const keys = [...new Set([...movement.paymentKeys, ...paymentKeys, ...settled])];
    return updateMovement(movementId, { paymentKeys: keys });
  },
  /** Undoes the links; the payments themselves stay recorded. */
  unreconcile: (movementId: string) => updateMovement(movementId, { paymentKeys: [] }),

  addManualPayment: (payment: Omit<ManualPayment, "id">): string => {
    const created = { ...payment, id: newId() };
    void write({ manualPayments: [...treasury.get().manualPayments, created] }, [
      { type: "create", entity: "manualPayments", data: created },
    ]);
    return `manual:${created.id}`;
  },
  removeManualPayment: (id: string) => {
    const key = `manual:${id}`;
    const { manualPayments, movements } = treasury.get();
    const unlinked = movements
      .filter((m) => m.paymentKeys.includes(key))
      .map((m) => ({ ...m, paymentKeys: m.paymentKeys.filter((k) => k !== key) }));
    return write(
      {
        manualPayments: manualPayments.filter((p) => p.id !== id),
        movements: movements.map((m) => unlinked.find((u) => u.id === m.id) ?? m),
      },
      [
        ...unlinked.map((m): Command => ({
          type: "update",
          entity: "bankMovements",
          id: m.id,
          changes: { paymentKeys: m.paymentKeys },
        })),
        { type: "delete", entity: "manualPayments", id },
      ],
    );
  },
};

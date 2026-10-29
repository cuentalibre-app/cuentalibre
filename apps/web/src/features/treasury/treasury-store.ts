import { useMemo } from "react";
import { newId } from "@cuentalibre/core";
import type { ManualPayment } from "@cuentalibre/contracts";
import { useExpenses } from "@/features/purchases/expenses-store";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { useSalesDocuments } from "@/features/sales/sales-store";
import { initialManualPayments } from "@/mocks/treasury";
import type { Command } from "@/data/commands";
import { createStore } from "@/data/store";
import { listTarget, syncTarget } from "@/data/sync";
import { collectPayments } from "./treasury-model";

/** Manual payments. Payments of invoices and expenses live in their own stores. */
interface TreasuryState {
  manualPayments: ManualPayment[];
}

const treasury = createStore<TreasuryState>({ manualPayments: initialManualPayments });

export function useTreasury(): TreasuryState {
  return treasury.use();
}

const write = (changes: Partial<TreasuryState>, commands: Command[]) =>
  treasury.write({ ...treasury.get(), ...changes }, commands);

syncTarget(
  "manualPayments",
  listTarget(
    () => treasury.get().manualPayments,
    (manualPayments) => treasury.set({ ...treasury.get(), manualPayments }),
  ),
);

/** Every recorded collection and payment, newest first. Recomputed only when a source changes. */
export function usePayments() {
  const sales = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  const { manualPayments: manual } = useTreasury();
  return useMemo(() => collectPayments({ sales, purchases, expenses, manual }), [sales, purchases, expenses, manual]);
}

export const treasuryStore = {
  get: treasury.get,

  addManualPayment: (payment: Omit<ManualPayment, "id">) => {
    const created = { ...payment, id: newId() };
    return write({ manualPayments: [...treasury.get().manualPayments, created] }, [
      { type: "create", entity: "manualPayments", data: created },
    ]);
  },
  removeManualPayment: (id: string) =>
    write({ manualPayments: treasury.get().manualPayments.filter((p) => p.id !== id) }, [
      { type: "delete", entity: "manualPayments", id },
    ]),
};

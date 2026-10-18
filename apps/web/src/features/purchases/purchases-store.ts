import { useSyncExternalStore } from "react";
import type { PurchaseInvoice } from "@fiscalia/contracts";
import { initialPurchaseInvoices } from "@/mocks/purchases";

/**
 * In-memory received invoices. Changes apply instantly and last until reload;
 * this is where the API cache will go once there is a backend.
 */
let invoices = initialPurchaseInvoices;
const listeners = new Set<() => void>();

function commit(next: PurchaseInvoice[]) {
  invoices = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePurchaseInvoices(): PurchaseInvoice[] {
  return useSyncExternalStore(subscribe, () => invoices);
}

export const purchasesStore = {
  get: (id: string) => invoices.find((d) => d.id === id),
  all: () => invoices,
  add: (invoice: PurchaseInvoice) => commit([invoice, ...invoices]),
  update: (id: string, changes: Partial<PurchaseInvoice>) =>
    commit(invoices.map((d) => (d.id === id ? { ...d, ...changes } : d))),
  remove: (id: string) => commit(invoices.filter((d) => d.id !== id)),
};

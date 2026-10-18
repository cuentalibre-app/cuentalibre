import type { PurchaseInvoice } from "@fiscalia/contracts";
import { createCollection } from "@/data/collection";
import { initialPurchaseInvoices } from "@/mocks/purchases";

/** Received invoices. Changes apply instantly and are sent to the backend (see `@/data`). */
const invoices = createCollection<PurchaseInvoice>("purchaseInvoices", initialPurchaseInvoices, { addAt: "start" });

export function usePurchaseInvoices(): PurchaseInvoice[] {
  return invoices.use();
}

export const purchasesStore = {
  get: invoices.get,
  all: invoices.all,
  add: invoices.add,
  update: invoices.update,
  remove: invoices.remove,
};

import type { PurchaseInvoice } from "@cuentalibre/contracts";
import { createCollection } from "@/data/collection";
import { syncCollection } from "@/data/sync";
import { initialPurchaseInvoices } from "@/mocks/purchases";

/** Received invoices. Changes apply instantly and are sent to the backend (see `@/data`). */
const invoices = createCollection<PurchaseInvoice>("purchaseInvoices", initialPurchaseInvoices, { addAt: "start" });
syncCollection("purchaseInvoices", invoices);

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

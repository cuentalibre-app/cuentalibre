import { initialExpenses } from "./expenses";
import { initialPurchaseInvoices } from "./purchases";
import { initialSalesDocuments } from "./sales";

/** Years with sample documents, newest first. */
export const availableYears = [
  ...new Set(
    [
      ...initialSalesDocuments.map((d) => d.issuedOn),
      ...initialPurchaseInvoices.map((p) => p.bookedOn),
      ...initialExpenses.map((e) => e.date),
    ].map((d) => Number(d.slice(0, 4))),
  ),
].sort((a, b) => b - a);

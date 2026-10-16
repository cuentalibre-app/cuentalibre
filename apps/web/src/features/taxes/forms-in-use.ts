import { useMemo } from "react";
import { useExpenses } from "@/features/purchases/expenses-store";
import { purchaseTotals } from "@/features/purchases/purchases-model";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { useSalesDocuments } from "@/features/sales/sales-store";

/** Which of the forms Fiscalia doesn't prepare yet the books of a year call for. */
export interface FormsInUse {
  /** Professionals' invoices with withholding: forms 111 and 190. */
  withholdings: boolean;
  /** Rented premises: forms 115 and 180. */
  rentals: boolean;
  /** Intra-EU sales or purchases: form 349. */
  intraEu: boolean;
}

export function useFormsInUse(): (year: number) => FormsInUse {
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  return useMemo(() => {
    const cache = new Map<number, FormsInUse>();
    return (year: number) => {
      const cached = cache.get(year);
      if (cached) return cached;
      const inYear = (date: string) => date.startsWith(String(year));
      const yearPurchases = purchases.filter((p) => inYear(p.bookedOn));
      const result = {
        withholdings: yearPurchases.some((p) => !p.rental && purchaseTotals(p).withholding !== 0),
        rentals: yearPurchases.some((p) => p.rental) || expenses.some((e) => inYear(e.date) && e.rental),
        intraEu:
          documents.some((d) => d.kind === "invoice" && inYear(d.issuedOn) && d.operationType === "intraEu") ||
          yearPurchases.some((p) => p.operationType === "intraEu"),
      };
      cache.set(year, result);
      return result;
    };
  }, [documents, purchases, expenses]);
}

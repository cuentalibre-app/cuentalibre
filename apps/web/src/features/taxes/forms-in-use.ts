import { useMemo } from "react";
import { model347 } from "@cuentalibre/core";
import { useExpenses } from "@/features/purchases/expenses-store";
import { purchaseTotals } from "@/features/purchases/purchases-model";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { useSalesDocuments } from "@/features/sales/sales-store";
import { usePartyBooks } from "./party-operations";

/** Which of the forms cuentalibre doesn't prepare yet the books of a year call for. */
export interface FormsInUse {
  /** Professionals' invoices with withholding: forms 111 and 190. */
  withholdings: boolean;
  /** Rented premises: forms 115 and 180. */
  rentals: boolean;
  /** Intra-EU sales or purchases: form 349. */
  intraEu: boolean;
  /** A client or supplier above 3.005,06 € a year: form 347. */
  thirdParties: boolean;
}

export function useFormsInUse(): (year: number) => FormsInUse {
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  const party = usePartyBooks();
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
        thirdParties: model347(party.ops, year, party.excludedFrom347).declared.length > 0,
      };
      cache.set(year, result);
      return result;
    };
  }, [documents, purchases, expenses, party]);
}

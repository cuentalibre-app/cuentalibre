import { useMemo } from "react";
import { useExpenses } from "@/features/purchases/expenses-store";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { useSalesDocuments } from "@/features/sales/sales-store";

/** The current year plus every year with a dated record (YYYY-MM-DD), newest first. */
export function yearsWithData(dates: string[], today: Date): number[] {
  const years = new Set([today.getFullYear(), ...dates.map((d) => Number(d.slice(0, 4)))]);
  return [...years].sort((a, b) => b - a);
}

/** Years the period pickers offer: the current one and any year the business has invoices or expenses in. */
export function useAvailableYears(): number[] {
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  return useMemo(
    () =>
      yearsWithData(
        [
          ...documents.map((d) => d.issuedOn),
          ...purchases.map((p) => p.bookedOn),
          ...expenses.map((e) => e.date),
        ],
        new Date(),
      ),
    [documents, purchases, expenses],
  );
}

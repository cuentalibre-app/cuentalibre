import { contactsStore } from "@/features/contacts/contacts-store";
import { expensesStore } from "@/features/purchases/expenses-store";
import { purchasesStore } from "@/features/purchases/purchases-store";
import { salesStore } from "@/features/sales/sales-store";
import { treasuryStore } from "@/features/treasury/treasury-store";

/** Documents, contacts and manual payments that use a method: removing it would leave them pointing nowhere. */
export function methodUsage(id: string): number {
  return (
    salesStore.all().filter((d) => d.payments?.some((x) => x.paymentMethodId === id)).length +
    purchasesStore.all().filter((p) => p.payments.some((x) => x.paymentMethodId === id)).length +
    expensesStore.all().filter((e) => e.payment?.paymentMethodId === id).length +
    [...contactsStore.all("client"), ...contactsStore.all("supplier")].filter((c) => c.paymentMethodId === id).length +
    treasuryStore.get().manualPayments.filter((p) => p.paymentMethodId === id).length
  );
}

/** Bank movements recorded on an account: they keep it from being removed. */
export const accountMovements = (id: string): number =>
  treasuryStore.get().movements.filter((m) => m.accountId === id).length;

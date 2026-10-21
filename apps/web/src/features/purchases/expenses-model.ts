import { deductibleExpense, type ExpenseIdentity } from "@cuentalibre/core";
import type { Expense, OtherPayee } from "@cuentalibre/contracts";
import type { BadgeProps } from "@cuentalibre/ui/components/badge";
import { contactsStore } from "@/features/contacts/contacts-store";

export const EXPENSES_PATH = "/compras/gastos";
export const NEW_EXPENSE_PATH = "/compras/gastos/nuevo";
export const expensePath = (expense: Pick<Expense, "id">) => `${EXPENSES_PATH}/${expense.id}`;

export type ExpenseStatus = "pending" | "paid";

export const EXPENSE_STATUS: Record<ExpenseStatus, { label: string; tone: BadgeProps["tone"]; hint: string }> = {
  pending: { label: "Pendiente", tone: "neutral", hint: "Todavía no lo has pagado." },
  paid: { label: "Pagado", tone: "success", hint: "Pagado de una vez." },
};

export const EXPENSE_STATUS_ORDER: ExpenseStatus[] = ["pending", "paid"];

export const expenseStatus = (expense: Pick<Expense, "payment">): ExpenseStatus =>
  expense.payment ? "paid" : "pending";

export const deductibleOf = (expense: Pick<Expense, "amount" | "imputation">) =>
  deductibleExpense(expense.amount, expense.imputation);

/** Who was paid: a saved supplier, a one-off payee, or nobody in particular. */
export function payeeOf(expense: Pick<Expense, "supplierId" | "otherPayee">): OtherPayee | null {
  if (expense.supplierId) {
    const supplier = contactsStore.get("supplier", expense.supplierId);
    return supplier ? { name: supplier.name, taxId: supplier.taxId } : { name: "Proveedor eliminado", taxId: "" };
  }
  return expense.otherPayee ?? null;
}

/** Groups expenses by who was paid: the supplier id, or the one-off payee's tax ID and name. Empty without one. */
export function payeeKey(expense: Pick<Expense, "supplierId" | "otherPayee">): string {
  const other = expense.otherPayee;
  return expense.supplierId ?? (other ? `${other.taxId.trim().toUpperCase()}|${other.name.trim().toLowerCase()}` : "");
}

/** The fields that tell two expenses apart, for the duplicate check. */
export function expenseIdentity(expense: Omit<Expense, "id"> & { id?: string }): Required<ExpenseIdentity> {
  return {
    id: expense.id ?? "",
    date: expense.date,
    number: expense.number,
    concept: expense.concept,
    amount: expense.amount,
    payee: payeeKey(expense),
  };
}

import type { Expense } from "@fiscalia/contracts";
import { createCollection } from "@/data/collection";
import { initialExpenses } from "@/mocks/expenses";

/** Expenses. Changes apply instantly and are sent to the backend (see `@/data`). */
const expenses = createCollection<Expense>("expenses", initialExpenses, { addAt: "start" });

export function useExpenses(): Expense[] {
  return expenses.use();
}

export const expensesStore = {
  get: expenses.get,
  all: expenses.all,
  add: expenses.add,
  update: expenses.update,
  remove: expenses.remove,
};

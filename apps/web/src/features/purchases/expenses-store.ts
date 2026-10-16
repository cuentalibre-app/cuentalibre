import { useSyncExternalStore } from "react";
import { initialExpenses, type Expense } from "@/mocks/expenses";

/**
 * In-memory expenses. Changes apply instantly and last until reload;
 * this is where the API cache will go once there is a backend.
 */
let expenses = initialExpenses;
const listeners = new Set<() => void>();

function commit(next: Expense[]) {
  expenses = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useExpenses(): Expense[] {
  return useSyncExternalStore(subscribe, () => expenses);
}

export const expensesStore = {
  get: (id: string) => expenses.find((e) => e.id === id),
  all: () => expenses,
  add: (expense: Expense) => commit([expense, ...expenses]),
  update: (id: string, changes: Partial<Expense>) =>
    commit(expenses.map((e) => (e.id === id ? { ...e, ...changes } : e))),
  remove: (id: string) => commit(expenses.filter((e) => e.id !== id)),
};

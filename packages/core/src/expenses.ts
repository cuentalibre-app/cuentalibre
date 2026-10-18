import { cents, type Cents } from "./money";

/*
 * Expenses without an invoice: the social security fee, fees and taxes, bank
 * charges, receipts that are not a full invoice… They carry a single amount
 * with any taxes included, and no VAT can be deducted from them, so all of it
 * counts as the expense.
 */

/** Part of an expense's amount that counts for income tax, after its imputation (0–100). */
export function deductibleExpense(amount: Cents, imputation: number): Cents {
  return cents((amount * imputation) / 100);
}

export interface ExpenseIdentity {
  id?: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Receipt number; often empty. */
  number: string;
  concept: string;
  amount: Cents;
  /** Supplier id, or the name and tax ID of a one-off payee; empty without one. */
  payee: string;
}

/**
 * Whether an expense was already registered. With a number, it repeats when
 * the same payee used it in the same year; without one, when the date,
 * concept, amount and payee all match.
 */
export function isDuplicateExpense(candidate: ExpenseIdentity, existing: Required<ExpenseIdentity>[]): boolean {
  const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");
  const number = normalize(candidate.number);
  return existing.some((e) => {
    if (e.id === candidate.id || e.payee !== candidate.payee) return false;
    if (number) return normalize(e.number) === number && e.date.slice(0, 4) === candidate.date.slice(0, 4);
    return (
      !normalize(e.number) &&
      e.date === candidate.date &&
      normalize(e.concept) === normalize(candidate.concept) &&
      e.amount === candidate.amount
    );
  });
}

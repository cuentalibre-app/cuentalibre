import type { AccountKind, PaymentMethod, PaymentMethodType, TreasuryAccount } from "@cuentalibre/contracts";
import type { Command } from "@/data/commands";

/*
 * Payment methods hang from the account they book into: an account opens with a method of
 * its own, and deactivating or removing it takes its methods along. Methods some document
 * already names are never removed, only deactivated, so the document keeps showing them.
 */

export interface MethodBook {
  accounts: TreasuryAccount[];
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId: string;
}

/** A change to accounts and methods, and the commands that make it. */
export interface MethodBookChange extends MethodBook {
  commands: Command[];
}

/**
 * Method types each kind of account takes, the one it opens with first. Money goes in and
 * out of a bank account many ways; cash, PayPal and a credit card are a method in themselves.
 */
export const METHOD_TYPES_FOR_ACCOUNT: Record<AccountKind, PaymentMethodType[]> = {
  bank: ["transfer", "directDebit", "card", "promissory"],
  cash: ["cash"],
  paypal: ["paypal"],
  card: ["card"],
};

/** Whether `account` can take one more method, or take `methodId` if it's moved there. */
export function takesMethod(account: TreasuryAccount, methods: PaymentMethod[], methodId?: string): boolean {
  return (
    METHOD_TYPES_FOR_ACCOUNT[account.kind].length > 1 ||
    !methods.some((m) => m.accountId === account.id && m.id !== methodId)
  );
}

/** The method an account opens with: its name and number, and the usual type for its kind. */
export const firstMethod = (account: TreasuryAccount, id: string): PaymentMethod => ({
  id,
  type: METHOD_TYPES_FOR_ACCOUNT[account.kind][0]!,
  name: account.name,
  number: account.number,
  accountId: account.id,
  active: account.active,
});

/** The default method while it's active; otherwise the first active one, or none. */
export function defaultAfter(methods: PaymentMethod[], currentId: string): string {
  return methods.find((m) => m.id === currentId && m.active)?.id ?? methods.find((m) => m.active)?.id ?? "";
}

/** Moves the default off a method that is gone or inactive. */
function settle(before: MethodBook, after: Omit<MethodBook, "defaultPaymentMethodId">, commands: Command[]) {
  const defaultPaymentMethodId = defaultAfter(after.paymentMethods, before.defaultPaymentMethodId);
  if (defaultPaymentMethodId !== before.defaultPaymentMethodId)
    commands.push({ type: "saveSettings", section: "defaultPaymentMethod", data: defaultPaymentMethodId });
  return { ...after, defaultPaymentMethodId, commands };
}

export function addAccount(book: MethodBook, account: TreasuryAccount, methodId: string): MethodBookChange {
  const method = firstMethod(account, methodId);
  return settle(book, { accounts: [...book.accounts, account], paymentMethods: [...book.paymentMethods, method] }, [
    { type: "create", entity: "treasuryAccounts", data: account },
    { type: "create", entity: "paymentMethods", data: method },
  ]);
}

/** Its methods follow the account: all of them go inactive with it, and come back with it. */
export function setAccountActive(book: MethodBook, id: string, active: boolean): MethodBookChange {
  const changed = book.paymentMethods.filter((m) => m.accountId === id && m.active !== active);
  return settle(
    book,
    {
      accounts: book.accounts.map((a) => (a.id === id ? { ...a, active } : a)),
      paymentMethods: book.paymentMethods.map((m) => (changed.includes(m) ? { ...m, active } : m)),
    },
    [
      { type: "update", entity: "treasuryAccounts", id, changes: { active } },
      ...changed.map((m): Command => ({ type: "update", entity: "paymentMethods", id: m.id, changes: { active } })),
    ],
  );
}

/** What removing an account does to each of its methods. */
export function accountRemoval(book: MethodBook, id: string, isUsed: (methodId: string) => boolean) {
  const linked = book.paymentMethods.filter((m) => m.accountId === id);
  return { removed: linked.filter((m) => !isUsed(m.id)), kept: linked.filter((m) => isUsed(m.id)) };
}

/** Unused methods go with the account; used ones stay, unlinked and inactive. */
export function removeAccount(book: MethodBook, id: string, isUsed: (methodId: string) => boolean): MethodBookChange {
  const { removed, kept } = accountRemoval(book, id, isUsed);
  const unlinked = { accountId: null, active: false };
  return settle(
    book,
    {
      accounts: book.accounts.filter((a) => a.id !== id),
      paymentMethods: book.paymentMethods
        .filter((m) => !removed.includes(m))
        .map((m) => (kept.includes(m) ? { ...m, ...unlinked } : m)),
    },
    [
      ...kept.map((m): Command => ({ type: "update", entity: "paymentMethods", id: m.id, changes: unlinked })),
      ...removed.map((m): Command => ({ type: "delete", entity: "paymentMethods", id: m.id })),
      // Last: the server won't remove an account its methods still name
      { type: "delete", entity: "treasuryAccounts", id },
    ],
  );
}

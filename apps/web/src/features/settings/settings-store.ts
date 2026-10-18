import { useSyncExternalStore } from "react";
import type { BusinessProfile, PaymentMethod, TaxSetup, TreasuryAccount } from "@fiscalia/contracts";
import {
  initialAccounts,
  initialDefaultPaymentMethodId,
  initialPaymentMethods,
  initialProfile,
  initialTaxSetup,
} from "@/mocks/settings";

/**
 * Business profile, tax setup, treasury accounts and payment methods, in memory until reload
 * like the other stores. Invoices, the PDF, the tax pages and the sidebar read them from here.
 */
export interface Settings {
  profile: BusinessProfile;
  tax: TaxSetup;
  accounts: TreasuryAccount[];
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId: string;
}

let settings: Settings = {
  profile: initialProfile,
  tax: initialTaxSetup,
  accounts: initialAccounts,
  paymentMethods: initialPaymentMethods,
  defaultPaymentMethodId: initialDefaultPaymentMethodId,
};
const listeners = new Set<() => void>();

function commit(changes: Partial<Settings>) {
  settings = { ...settings, ...changes };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => settings);
}

const replace = <T extends { id: string }>(items: T[], id: string, changes: Partial<T>) =>
  items.map((item) => (item.id === id ? { ...item, ...changes } : item));

export const settingsStore = {
  get: () => settings,
  updateProfile: (profile: BusinessProfile) => commit({ profile }),
  updateTax: (tax: TaxSetup) => commit({ tax }),

  addAccount: (account: TreasuryAccount) => commit({ accounts: [...settings.accounts, account] }),
  updateAccount: (id: string, changes: Partial<TreasuryAccount>) =>
    commit({ accounts: replace(settings.accounts, id, changes) }),
  /** Methods linked to a removed account keep working, unlinked. */
  removeAccount: (id: string) =>
    commit({
      accounts: settings.accounts.filter((a) => a.id !== id),
      paymentMethods: settings.paymentMethods.map((m) => (m.accountId === id ? { ...m, accountId: null } : m)),
    }),

  addPaymentMethod: (method: PaymentMethod) => commit({ paymentMethods: [...settings.paymentMethods, method] }),
  updatePaymentMethod: (id: string, changes: Partial<PaymentMethod>) =>
    commit({ paymentMethods: replace(settings.paymentMethods, id, changes) }),
  removePaymentMethod: (id: string) => commit({ paymentMethods: settings.paymentMethods.filter((m) => m.id !== id) }),
  setDefaultPaymentMethod: (id: string) => commit({ defaultPaymentMethodId: id }),
};

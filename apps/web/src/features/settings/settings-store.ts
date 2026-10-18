import type { BusinessProfile, PaymentMethod, TaxSetup, TreasuryAccount } from "@fiscalia/contracts";
import {
  initialAccounts,
  initialDefaultPaymentMethodId,
  initialPaymentMethods,
  initialProfile,
  initialTaxSetup,
} from "@/mocks/settings";
import type { Command } from "@/data/commands";
import { createStore } from "@/data/store";

/**
 * Business profile, tax setup, treasury accounts and payment methods. Invoices, the PDF, the
 * tax pages and the sidebar read them from here.
 */
export interface Settings {
  profile: BusinessProfile;
  tax: TaxSetup;
  accounts: TreasuryAccount[];
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId: string;
}

const settings = createStore<Settings>({
  profile: initialProfile,
  tax: initialTaxSetup,
  accounts: initialAccounts,
  paymentMethods: initialPaymentMethods,
  defaultPaymentMethodId: initialDefaultPaymentMethodId,
});

export function useSettings(): Settings {
  return settings.use();
}

const write = (changes: Partial<Settings>, ...commands: Command[]) =>
  settings.write({ ...settings.get(), ...changes }, commands);

const replace = <T extends { id: string }>(items: T[], id: string, changes: Partial<T>) =>
  items.map((item) => (item.id === id ? { ...item, ...changes } : item));

export const settingsStore = {
  get: settings.get,
  updateProfile: (profile: BusinessProfile) =>
    write({ profile }, { type: "saveSettings", section: "businessProfile", data: profile }),
  updateTax: (tax: TaxSetup) => write({ tax }, { type: "saveSettings", section: "taxSetup", data: tax }),

  addAccount: (account: TreasuryAccount) =>
    write(
      { accounts: [...settings.get().accounts, account] },
      { type: "create", entity: "treasuryAccounts", data: account },
    ),
  updateAccount: (id: string, changes: Partial<TreasuryAccount>) =>
    write(
      { accounts: replace(settings.get().accounts, id, changes) },
      { type: "update", entity: "treasuryAccounts", id, changes },
    ),
  /** Methods linked to a removed account keep working, unlinked. */
  removeAccount(id: string) {
    const { accounts, paymentMethods } = settings.get();
    const linked = paymentMethods.filter((m) => m.accountId === id);
    return write(
      {
        accounts: accounts.filter((a) => a.id !== id),
        paymentMethods: paymentMethods.map((m) => (m.accountId === id ? { ...m, accountId: null } : m)),
      },
      ...linked.map((m): Command => ({
        type: "update",
        entity: "paymentMethods",
        id: m.id,
        changes: { accountId: null },
      })),
      { type: "delete", entity: "treasuryAccounts", id },
    );
  },

  addPaymentMethod: (method: PaymentMethod) =>
    write(
      { paymentMethods: [...settings.get().paymentMethods, method] },
      { type: "create", entity: "paymentMethods", data: method },
    ),
  updatePaymentMethod: (id: string, changes: Partial<PaymentMethod>) =>
    write(
      { paymentMethods: replace(settings.get().paymentMethods, id, changes) },
      { type: "update", entity: "paymentMethods", id, changes },
    ),
  removePaymentMethod: (id: string) =>
    write(
      { paymentMethods: settings.get().paymentMethods.filter((m) => m.id !== id) },
      { type: "delete", entity: "paymentMethods", id },
    ),
  setDefaultPaymentMethod: (id: string) =>
    write({ defaultPaymentMethodId: id }, { type: "saveSettings", section: "defaultPaymentMethod", data: id }),
};

import type { BusinessProfile, PaymentMethod, TaxSetup } from "@cuentalibre/contracts";
import {
  initialDefaultPaymentMethodId,
  initialPaymentMethods,
  initialProfile,
  initialTaxSetup,
} from "@/mocks/settings";
import type { Command } from "@/data/commands";
import { createStore } from "@/data/store";
import { listTarget, syncSettings, syncTarget } from "@/data/sync";

/**
 * Business profile, tax setup and payment methods. Invoices, the PDF, the
 * tax pages and the sidebar read them from here.
 */
export interface Settings {
  profile: BusinessProfile;
  tax: TaxSetup;
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId: string;
}

const settings = createStore<Settings>({
  profile: initialProfile,
  tax: initialTaxSetup,
  paymentMethods: initialPaymentMethods,
  defaultPaymentMethodId: initialDefaultPaymentMethodId,
});

const take = (changes: Partial<Settings>) => settings.set({ ...settings.get(), ...changes });

syncSettings("businessProfile", (profile) => take({ profile }));
syncSettings("taxSetup", (tax) => take({ tax }));
syncSettings("defaultPaymentMethod", (defaultPaymentMethodId) => take({ defaultPaymentMethodId }));
syncTarget(
  "paymentMethods",
  listTarget(
    () => settings.get().paymentMethods,
    (paymentMethods) => take({ paymentMethods }),
  ),
);

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

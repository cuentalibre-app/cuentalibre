import { useSyncExternalStore } from "react";
import type { LedgerAccountSettings } from "@fiscalia/contracts";
import { initialLedgerAccounts } from "@/mocks/ledger-accounts";

/** Ledger account numbers for the accounting export, in memory until reload like the other stores. */
let settings = initialLedgerAccounts;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLedgerAccounts(): LedgerAccountSettings {
  return useSyncExternalStore(subscribe, () => settings);
}

export const ledgerAccountsStore = {
  get: () => settings,
  update(changes: Partial<LedgerAccountSettings>) {
    settings = { ...settings, ...changes };
    listeners.forEach((listener) => listener());
  },
};

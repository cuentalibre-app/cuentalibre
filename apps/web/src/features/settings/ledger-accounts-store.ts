import type { LedgerAccountSettings } from "@fiscalia/contracts";
import { createStore } from "@/data/store";
import { initialLedgerAccounts } from "@/mocks/ledger-accounts";

/** Ledger account numbers for the accounting export. */
const settings = createStore<LedgerAccountSettings>(initialLedgerAccounts);

export function useLedgerAccounts(): LedgerAccountSettings {
  return settings.use();
}

export const ledgerAccountsStore = {
  get: settings.get,
  update(changes: Partial<LedgerAccountSettings>) {
    const next = { ...settings.get(), ...changes };
    return settings.write(next, [{ type: "saveSettings", section: "ledgerAccounts", data: next }]);
  },
};

import type { LedgerAccountSettings } from "@fiscalia/contracts";

/** Ledger account numbers for exporting to accounting software. Contasimple's defaults until there is a backend. */

export const initialLedgerAccounts: LedgerAccountSettings = {
  companyCode: "",
  digits: 8,
  prefixes: {
    customers: "430",
    suppliers: "400",
    assetSuppliers: "523",
    creditors: "410",
    sales: "700",
    purchases: "600",
    outputVat: "477",
    inputVat: "472",
    salesWithholding: "473",
    purchasesWithholding: "475",
    cash: "570",
    bank: "572",
    nonDeductible: "629",
  },
  defaults: {
    customers: "00000",
    suppliers: "00000",
    assetSuppliers: "00000",
    creditors: "00000",
    sales: "00000",
    purchases: "00000",
    outputVat: "00000",
    inputVat: "00000",
    salesWithholding: "00000",
    purchasesWithholding: "01000",
    cash: "00000",
    bank: "00000",
    nonDeductible: "99999",
  },
  contactCodes: {},
  methodCodes: {},
};

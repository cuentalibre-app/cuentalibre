/** Ledger account numbers for exporting to accounting software. Contasimple's defaults until there is a backend. */

export type LedgerAccountKey =
  | "customers"
  | "suppliers"
  | "assetSuppliers"
  | "creditors"
  | "sales"
  | "purchases"
  | "outputVat"
  | "inputVat"
  | "salesWithholding"
  | "purchasesWithholding"
  | "cash"
  | "bank"
  | "nonDeductible";

export interface LedgerAccountSettings {
  /** Company code in the accounting program the books are transferred to. */
  companyCode: string;
  /** Length of every account number, 6 to 12. */
  digits: number;
  prefixes: Record<LedgerAccountKey, string>;
  /** Code after the prefix used when a contact or method has none of its own. */
  defaults: Record<LedgerAccountKey, string>;
  /** Own codes by contact id; empty means the default. */
  contactCodes: Record<string, string>;
  /** Own codes by payment method id. */
  methodCodes: Record<string, string>;
}

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

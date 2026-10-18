/*
 * Every change the app makes to its data is described as a command and sent to
 * the backend. The stores apply it to their in-memory copy first, so the UI
 * never waits, and undo it if the backend rejects it.
 *
 * Plain create/update/delete covers most records. Settings are saved a whole
 * section at a time, and changes with legal effects (closing a quarter, and
 * later issuing or rectifying an invoice) get their own command, because only
 * the server may decide them.
 */

/** Collections of records, named like the tables they will be stored in. */
export type Entity =
  | "clients"
  | "suppliers"
  | "salesDocuments"
  | "purchaseInvoices"
  | "expenses"
  | "tags"
  | "timeEntries"
  | "products"
  | "catalogFamilies"
  | "stockMovements"
  | "bankMovements"
  | "manualPayments"
  | "treasuryAccounts"
  | "paymentMethods"
  | "companyUsers";

/** Settings stored as one document per section. */
export type SettingsSection =
  | "businessProfile"
  | "taxSetup"
  | "defaultPaymentMethod"
  | "invoiceSettings"
  | "documentSettings"
  | "catalogSettings"
  | "contactSettings"
  | "ledgerAccounts"
  | "verifactu"
  | "certificate"
  | "signing"
  | "emailSettings"
  | "userProfile"
  | "notificationPrefs"
  | "userLocale"
  | "userAccess";

export type Command =
  | { type: "create"; entity: Entity; data: { id: string } }
  | { type: "update"; entity: Entity; id: string; changes: object }
  | { type: "delete"; entity: Entity; id: string }
  | { type: "saveSettings"; section: SettingsSection; data: unknown }
  | { type: "closeQuarter"; period: string; closedOn: string }
  | { type: "reopenQuarter"; period: string };

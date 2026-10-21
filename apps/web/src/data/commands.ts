/*
 * Every change the app makes to its data is described as a command and sent to
 * the backend. The stores apply it to their in-memory copy first, so the UI
 * never waits, and undo it if the backend rejects it.
 *
 * Plain create/update/delete covers most records. Settings are saved a whole
 * section at a time, and changes with legal effects (issuing an invoice,
 * closing a quarter) get their own command, because only the server may decide
 * them.
 */

import type { FiledReturn, SalesDocument, SettingsSection as OrganizationSection } from "@cuentalibre/contracts";

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

/**
 * Settings stored as one document per section: the organization's (see
 * `organizationSettingsSchema`), plus the ones the server doesn't store yet.
 */
export type SettingsSection =
  | OrganizationSection
  | "certificate"
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
  /** Issues an invoice, new or from a draft: the server numbers it, unless `number` keeps an imported one. */
  | { type: "issue"; data: SalesDocument; number?: string }
  /** Closes a quarter and stores its returns as filed. */
  | { type: "closeQuarter"; period: string; closedOn: string; returns?: FiledReturn[] }
  | { type: "reopenQuarter"; period: string };

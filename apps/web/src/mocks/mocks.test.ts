import {
  bankMovementSchema,
  businessProfileSchema,
  catalogFamilySchema,
  catalogSettingsSchema,
  closedQuarterSchema,
  companyUserSchema,
  contactSchema,
  emailSettingsSchema,
  expenseSchema,
  ledgerAccountSettingsSchema,
  manualPaymentSchema,
  noteTemplateSchema,
  notificationPrefsSchema,
  paymentMethodSchema,
  productSchema,
  purchaseInvoiceSchema,
  salesDocumentSchema,
  signingSettingsSchema,
  stockMovementSchema,
  tagSchema,
  taxSetupSchema,
  timeEntrySchema,
  treasuryAccountSchema,
  userAccessSchema,
  userLocaleSchema,
  userProfileSchema,
  verifactuSetupSchema,
  workerSchema,
} from "@fiscalia/contracts";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { initialCatalogSettings, initialFamilies, initialMovements, initialProducts } from "./catalog";
import { initialClosedQuarters } from "./closing";
import { initialSigning, initialVerifactu } from "./compliance";
import { initialClients, initialSuppliers } from "./contacts";
import { initialExpenses } from "./expenses";
import { initialNoteTemplates } from "./invoicing";
import { initialLedgerAccounts } from "./ledger-accounts";
import { initialPurchaseInvoices } from "./purchases";
import { initialSalesDocuments } from "./sales";
import { initialAccounts, initialPaymentMethods, initialProfile, initialTaxSetup } from "./settings";
import { initialTags } from "./tags";
import { initialManualPayments, sampleMovements } from "./treasury";
import { initialNotificationPrefs, initialUserAccess, initialUserLocale, initialUserProfile } from "./user";
import { initialEmailSettings, initialUsers } from "./users";
import { initialTimeEntries, workers } from "./working-hours";

// The sample data becomes the seed data of the database, so it must pass the same validation as user input.
const collections: [string, z.ZodType, unknown[]][] = [
  ["clients", contactSchema, initialClients],
  ["suppliers", contactSchema, initialSuppliers],
  ["sales documents", salesDocumentSchema, initialSalesDocuments],
  ["purchase invoices", purchaseInvoiceSchema, initialPurchaseInvoices],
  ["expenses", expenseSchema, initialExpenses],
  ["note templates", noteTemplateSchema, initialNoteTemplates],
  ["products", productSchema, initialProducts],
  ["catalog families", catalogFamilySchema, initialFamilies],
  ["stock movements", stockMovementSchema, initialMovements],
  ["closed quarters", closedQuarterSchema, initialClosedQuarters],
  ["treasury accounts", treasuryAccountSchema, initialAccounts],
  ["payment methods", paymentMethodSchema, initialPaymentMethods],
  ["tags", tagSchema, initialTags],
  ["manual payments", manualPaymentSchema, initialManualPayments],
  ["company users", companyUserSchema, initialUsers],
  ["workers", workerSchema, workers],
  ["time entries", timeEntrySchema, initialTimeEntries],
];

const singletons: [string, z.ZodType, unknown][] = [
  ["catalog settings", catalogSettingsSchema, initialCatalogSettings],
  ["VERI*FACTU setup", verifactuSetupSchema, initialVerifactu],
  ["signing settings", signingSettingsSchema, initialSigning],
  ["ledger accounts", ledgerAccountSettingsSchema, initialLedgerAccounts],
  ["business profile", businessProfileSchema, initialProfile],
  ["tax setup", taxSetupSchema, initialTaxSetup],
  ["user profile", userProfileSchema, initialUserProfile],
  ["notification preferences", notificationPrefsSchema, initialNotificationPrefs],
  ["user locale", userLocaleSchema, initialUserLocale],
  ["user access", userAccessSchema, initialUserAccess],
  ["email settings", emailSettingsSchema, initialEmailSettings],
];

const issues = (schema: z.ZodType, value: unknown) => schema.safeParse(value).error?.issues ?? [];

describe("sample data", () => {
  it.each(collections)("%s match their schema", (_, schema, items) => {
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(issues(schema, item)).toEqual([]);
  });

  it.each(singletons)("%s match their schema", (_, schema, value) => {
    expect(issues(schema, value)).toEqual([]);
  });

  it("bank movements match their schema", () => {
    const payment = {
      key: "sale:x",
      source: "sale" as const,
      date: "2026-01-15",
      amount: initialManualPayments[0]!.amount,
      accountId: initialAccounts[0]!.id,
      counterparty: "Cliente",
      reference: "F-1",
    };
    for (const movement of sampleMovements([payment], "2026-03-31")) {
      expect(issues(bankMovementSchema, movement)).toEqual([]);
    }
  });
});

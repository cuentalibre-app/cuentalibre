import {
  businessProfileSchema,
  catalogFamilySchema,
  catalogSettingsSchema,
  closedQuarterSchema,
  companyUserSchema,
  contactSchema,
  expenseSchema,
  ledgerAccountSettingsSchema,
  manualPaymentSchema,
  noteTemplateSchema,
  notificationPrefsSchema,
  paymentMethodSchema,
  productSchema,
  purchaseInvoiceSchema,
  salesDocumentSchema,
  stockMovementSchema,
  tagSchema,
  taxSetupSchema,
  userAccessSchema,
  userProfileSchema,
  userTourSchema,
} from "@cuentalibre/contracts";
import { contactTaxIdProblem } from "@cuentalibre/core";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { initialCatalogSettings, initialFamilies, initialMovements, initialProducts } from "./catalog";
import { initialClosedQuarters } from "./closing";

import { initialClients, initialSuppliers } from "./contacts";
import { initialExpenses } from "./expenses";
import { initialNoteTemplates } from "./invoicing";
import { initialLedgerAccounts } from "./ledger-accounts";
import { initialPurchaseInvoices } from "./purchases";
import { initialSalesDocuments } from "./sales";
import { initialPaymentMethods, initialProfile, initialTaxSetup } from "./settings";
import { initialTags } from "./tags";
import { initialManualPayments } from "./treasury";
import { initialNotificationPrefs, initialUserAccess, initialUserProfile, initialUserTour } from "./user";
import { initialUsers } from "./users";

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
  ["payment methods", paymentMethodSchema, initialPaymentMethods],
  ["tags", tagSchema, initialTags],
  ["manual payments", manualPaymentSchema, initialManualPayments],
  ["company users", companyUserSchema, initialUsers],
];

const singletons: [string, z.ZodType, unknown][] = [
  ["catalog settings", catalogSettingsSchema, initialCatalogSettings],

  ["ledger accounts", ledgerAccountSettingsSchema, initialLedgerAccounts],
  ["business profile", businessProfileSchema, initialProfile],
  ["tax setup", taxSetupSchema, initialTaxSetup],
  ["user profile", userProfileSchema, initialUserProfile],
  ["notification preferences", notificationPrefsSchema, initialNotificationPrefs],
  ["user access", userAccessSchema, initialUserAccess],
  ["user tour", userTourSchema, initialUserTour],
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

  it("contacts have a valid tax ID, as the API requires", () => {
    const invalid = [...initialClients, ...initialSuppliers].filter((c) => contactTaxIdProblem(c));
    expect(invalid.map((c) => c.name)).toEqual([]);
  });
});

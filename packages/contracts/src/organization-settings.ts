import { z } from "zod";
import { cents, hexColor, id } from "./common";
import { catalogSettingsSchema, type CatalogSettings } from "./catalog";
import { emailTemplateSettingsSchema } from "./email";
import {
  invoiceSeriesList,
  invoiceSeriesSchema,
  noteTemplateSchema,
  salesKindSchema,
  storedInvoiceSeriesSchema,
} from "./sales";
import {
  businessProfileSchema,
  ledgerAccountKeySchema,
  ledgerAccountSettingsSchema,
  taxSetupSchema,
  verifactuSetupSchema,
} from "./settings";

/* ───────────────────────── Sales documents ───────────────────────── */

/** Look of the PDF. Each template also has a "traditional" variant. */
export const invoiceTemplateSchema = z.enum([
  "classic",
  "classicTraditional",
  "modern",
  "modernTraditional",
  "elegant",
  "elegantTraditional",
  "avantGarde",
]);
export type InvoiceTemplate = z.infer<typeof invoiceTemplateSchema>;

export const documentFontSchema = z.enum([
  "Arial",
  "Comic Sans",
  "Courier New",
  "Georgia",
  "Impact",
  "Lucida Console",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
]);
export type DocumentFont = z.infer<typeof documentFontSchema>;

/** Look and locale of a PDF, shared by every kind of sales document. */
export const documentLookSchema = z.object({
  template: invoiceTemplateSchema,
  font: documentFontSchema,
  textColor: hexColor,
  lineColor: hexColor,
  backgroundColor: hexColor,
  language: z.string(),
  numberFormat: z.string(),
});
export type DocumentLook = z.infer<typeof documentLookSchema>;

/** Largest logo stored, in pixels; bigger images are scaled down to fit. */
export const LOGO_MAX_SIZE = { width: 325, height: 200 };

export const invoiceSettingsSchema = documentLookSchema
  .extend({
    showProductUnits: z.boolean(),
    hideZeroTaxes: z.boolean(),
    showServicePeriod: z.boolean(),
    showOperationDate: z.boolean(),
    /** "A pagar por transferencia bancaria en la cuenta…", under the totals. */
    showPaymentMethod: z.boolean(),
    /** Fixed text printed on the side of every invoice (registry details, GDPR…). */
    footer: z.string(),
    /**
     * Printed top left on every sales document: a PNG data URL, already scaled down to
     * fit LOGO_MAX_SIZE. Absent until one is uploaded.
     */
    logo: z
      .string()
      .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/)
      .max(512 * 1024)
      .optional(),
    noteTemplates: z.array(noteTemplateSchema),
    /**
     * Numbering series created by the organization, and the built-in ones it
     * changed (see BUILT_IN_INVOICE_SERIES). Absent until there is one.
     */
    series: storedInvoiceSeriesSchema.optional(),
    /** Series of new invoices of each type; absent means the built-in one. */
    defaultSeries: z.partialRecord(invoiceSeriesSchema, z.string()).optional(),
  })
  .superRefine((settings, ctx) => {
    const all = invoiceSeriesList(settings.series);
    for (const [type, seriesId] of Object.entries(settings.defaultSeries ?? {})) {
      const series = all.find((s) => s.id === seriesId);
      if (!series || series.type !== type || series.active === false)
        ctx.addIssue({
          code: "custom",
          path: ["defaultSeries", type],
          message: `The default ${type} series must be an active ${type} series.`,
        });
    }
  });
export type InvoiceSettings = z.infer<typeof invoiceSettingsSchema>;

export const documentKindSchema = salesKindSchema.exclude(["invoice"]);
export type DocumentKind = z.infer<typeof documentKindSchema>;

/** Settings of the kinds other than invoices; each has its own copy. */
export const documentSettingsSchema = documentLookSchema.extend({
  showProductUnits: z.boolean(),
  showServicePeriod: z.boolean(),
  showPrices: z.boolean(),
  /** Quotes and drafts only; delivery notes always print them, like before the setting existed. */
  showTaxes: z.boolean(),
  hideZeroTaxes: z.boolean(),
  footer: z.string(),
  /**
   * Drafts and delivery notes: when invoiced, copy every line as it is (true) or one line per tax
   * rate naming the source document (false).
   */
  keepLinesOnInvoice: z.boolean(),
  /** Quotes and delivery notes. */
});
export type DocumentSettings = z.infer<typeof documentSettingsSchema>;

/* ───────────────────────── Contacts ───────────────────────── */

/** Options of Configuración › Clientes y proveedores. */
export const contactSettingsSchema = z.object({
  /** Names of the two free fields of every client and supplier. */
  customFieldNames: z.tuple([z.string(), z.string()]),
  /** Look up the company's details from its NIF or name when creating a contact. */
  autocomplete: z.boolean(),
});
export type ContactSettings = z.infer<typeof contactSettingsSchema>;

/* ───────────────────────── The organization's settings ───────────────────────── */

/**
 * The settings of an organization, one document per section. The server
 * stores a section once it is saved and fills the others with the defaults
 * below. The signed-in user's own settings aren't here: they belong to the
 * account.
 */
export const organizationSettingsSchema = z.object({
  businessProfile: businessProfileSchema,
  taxSetup: taxSetupSchema,
  /** Payment method proposed on new documents; empty when there is none. */
  defaultPaymentMethod: id.or(z.literal("")),
  invoiceSettings: invoiceSettingsSchema,
  documentSettings: z.record(documentKindSchema, documentSettingsSchema),
  catalogSettings: catalogSettingsSchema,
  contactSettings: contactSettingsSchema,
  /** Subjects and messages for emailing sales documents. */
  emailTemplates: emailTemplateSettingsSchema,
  ledgerAccounts: ledgerAccountSettingsSchema,
  verifactu: verifactuSetupSchema,
});
export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

export const settingsSectionSchema = organizationSettingsSchema.keyof();
export type SettingsSection = z.infer<typeof settingsSectionSchema>;

const look: DocumentLook = {
  template: "classic",
  font: "Arial",
  textColor: "#000000",
  lineColor: "#000000",
  backgroundColor: "#ffffff",
  language: "es",
  numberFormat: "ES",
};

const documentDefaults = (kind: DocumentKind): DocumentSettings => ({
  ...look,
  showProductUnits: true,
  showServicePeriod: true,
  showPrices: true,
  showTaxes: true,
  hideZeroTaxes: false,
  footer: "",
  keepLinesOnInvoice: kind === "deliveryNote",
});

const catalogDefaults: CatalogSettings = {
  customFieldNames: ["Personalizado1", "Personalizado2", "Personalizado3", "Personalizado4"],
  conceptText: "name",
  copyDescription: false,
  alarmEmail: "",
  rules: { invoices: "never", deliveryNotes: "never", quotes: "never", drafts: "never" },
  restoreOnDeleteInvoice: false,
  restoreOnDeleteDeliveryNote: false,
  defaults: {
    enabled: false,
    allowWithoutStock: false,
    alarmOn: false,
    alarm: { minUnits: 0, dashboard: false, notification: false, email: false },
  },
};

/** What a new organization starts with, section by section. */
export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  businessProfile: {
    kind: "selfEmployed",
    taxId: "",
    firstName: "",
    lastName: "",
    secondLastName: "",
    legalName: "",
    tradeName: "",
    address: "",
    postalCode: "",
    city: "",
    province: "",
    country: "España",
    email: "",
    phone: "",
    website: "",
  },
  taxSetup: {
    region: "peninsula",
    incomeTaxMethod: "simplified",
    vatRegime: "general",
    activities: [],
    defaultVatRate: 0.21,
    defaultWithholding: "none",
    socialSecurityFee: cents.parse(0),
    variousClientsId: null,
  },
  defaultPaymentMethod: "",
  invoiceSettings: {
    ...look,
    showProductUnits: true,
    hideZeroTaxes: false,
    showServicePeriod: true,
    showOperationDate: false,
    showPaymentMethod: true,
    footer: "",
    noteTemplates: [],
  },
  documentSettings: {
    draft: documentDefaults("draft"),
    quote: documentDefaults("quote"),
    deliveryNote: documentDefaults("deliveryNote"),
  },
  catalogSettings: catalogDefaults,
  contactSettings: { customFieldNames: ["Personalizado 1", "Personalizado 2"], autocomplete: true },
  emailTemplates: { templates: [], defaults: {} },
  // The usual accounts of the Spanish chart of accounts (PGC)
  ledgerAccounts: {
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
      ...Object.fromEntries(ledgerAccountKeySchema.options.map((key) => [key, "00000"])),
      purchasesWithholding: "01000",
      nonDeductible: "99999",
    } as OrganizationSettings["ledgerAccounts"]["defaults"],
    contactCodes: {},
    methodCodes: {},
  },
  // Nobody sends records to the AEAT without choosing to
  verifactu: {
    system: "exempt",
    startDate: "2027-07-01",
    exemptionResolution: "",
  },
};

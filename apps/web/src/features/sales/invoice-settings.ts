import type { NoteTemplate, SalesKind } from "@fiscalia/contracts";
import { createStore } from "@/data/store";
import { initialNoteTemplates } from "@/mocks/invoicing";

/** Look of the PDF. Each template also has a "traditional" variant. */
export type InvoiceTemplate =
  "classic" | "classicTraditional" | "modern" | "modernTraditional" | "elegant" | "elegantTraditional" | "avantGarde";

export const TEMPLATES: { value: InvoiceTemplate; label: string }[] = [
  { value: "classic", label: "Clásica" },
  { value: "classicTraditional", label: "Clásica Tradicional" },
  { value: "modern", label: "Moderna" },
  { value: "modernTraditional", label: "Moderna Tradicional" },
  { value: "elegant", label: "Elegante" },
  { value: "elegantTraditional", label: "Elegante Tradicional" },
  { value: "avantGarde", label: "Vanguardista" },
];

export const FONTS = [
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
] as const;

/** Look and locale of a PDF, shared by every kind of sales document. */
export interface DocumentLook {
  template: InvoiceTemplate;
  font: (typeof FONTS)[number];
  textColor: string;
  lineColor: string;
  backgroundColor: string;
  language: string;
  numberFormat: string;
}

export interface InvoiceSettings extends DocumentLook {
  showProductUnits: boolean;
  hideZeroTaxes: boolean;
  hideWatermark: boolean;
  showServicePeriod: boolean;
  showOperationDate: boolean;
  /** Fixed text printed on the side of every invoice (registry details, GDPR…). */
  footer: string;
  /** Link in the footer so the recipient can import the invoice. */
  allowImport: boolean;
  /** Check intra-EU clients against VIES when issuing. */
  validateVies: boolean;
  uploadToDropbox: boolean;
  uploadToDrive: boolean;
  noteTemplates: NoteTemplate[];
}

export const DEFAULT_SETTINGS: InvoiceSettings = {
  template: "classic",
  font: "Arial",
  textColor: "#000000",
  lineColor: "#000000",
  backgroundColor: "#ffffff",
  language: "es",
  numberFormat: "ES",
  showProductUnits: true,
  hideZeroTaxes: false,
  hideWatermark: false,
  showServicePeriod: true,
  showOperationDate: false,
  footer: "",
  allowImport: true,
  validateVies: true,
  uploadToDropbox: false,
  uploadToDrive: false,
  noteTemplates: initialNoteTemplates,
};

const settings = createStore<InvoiceSettings>(DEFAULT_SETTINGS);

export function useInvoiceSettings(): InvoiceSettings {
  return settings.use();
}

export const invoiceSettingsStore = {
  get: settings.get,
  update(changes: Partial<InvoiceSettings>) {
    const next = { ...settings.get(), ...changes };
    return settings.write(next, [{ type: "saveSettings", section: "invoiceSettings", data: next }]);
  },
};

/* ─────────────────── Drafts, quotes and delivery notes ─────────────────── */

export type DocumentKind = Exclude<SalesKind, "invoice">;

/** Settings of the kinds other than invoices; each has its own copy. */
export interface DocumentSettings extends DocumentLook {
  showProductUnits: boolean;
  showServicePeriod: boolean;
  showPrices: boolean;
  /** Quotes and drafts only; delivery notes always print them, like before the setting existed. */
  showTaxes: boolean;
  hideZeroTaxes: boolean;
  footer: string;
  /**
   * Drafts and delivery notes: when invoiced, copy every line as it is (true) or one line per tax
   * rate naming the source document (false).
   */
  keepLinesOnInvoice: boolean;
  /** Quotes and delivery notes. */
  uploadToDropbox: boolean;
  uploadToDrive: boolean;
}

const lookDefaults: DocumentLook = {
  template: DEFAULT_SETTINGS.template,
  font: DEFAULT_SETTINGS.font,
  textColor: DEFAULT_SETTINGS.textColor,
  lineColor: DEFAULT_SETTINGS.lineColor,
  backgroundColor: DEFAULT_SETTINGS.backgroundColor,
  language: DEFAULT_SETTINGS.language,
  numberFormat: DEFAULT_SETTINGS.numberFormat,
};

const documentDefaults = (kind: DocumentKind): DocumentSettings => ({
  ...lookDefaults,
  showProductUnits: true,
  showServicePeriod: true,
  showPrices: true,
  showTaxes: true,
  hideZeroTaxes: false,
  footer: "",
  keepLinesOnInvoice: kind === "deliveryNote",
  uploadToDropbox: false,
  uploadToDrive: false,
});

export const DEFAULT_DOCUMENT_SETTINGS: Record<DocumentKind, DocumentSettings> = {
  draft: documentDefaults("draft"),
  quote: documentDefaults("quote"),
  deliveryNote: documentDefaults("deliveryNote"),
};

const documentSettings = createStore(DEFAULT_DOCUMENT_SETTINGS);

export function useDocumentSettings(kind: DocumentKind): DocumentSettings {
  return documentSettings.use()[kind];
}

export const documentSettingsStore = {
  get: (kind: DocumentKind) => documentSettings.get()[kind],
  update(kind: DocumentKind, changes: Partial<DocumentSettings>) {
    const all = documentSettings.get();
    const next = { ...all[kind], ...changes };
    return documentSettings.write({ ...all, [kind]: next }, [
      { type: "saveSettings", section: "documentSettings", data: { kind, settings: next } },
    ]);
  },
};

/** Whether new documents of a kind propose uploading them to Dropbox and Google Drive. */
export function useUploadDefaults(kind: SalesKind): Pick<DocumentSettings, "uploadToDropbox" | "uploadToDrive"> {
  const invoice = settings.use();
  const documents = documentSettings.use();
  return kind === "invoice" ? invoice : documents[kind];
}

/** What the PDF of a document prints, from its kind's settings. */
export interface PrintOptions {
  showProductUnits: boolean;
  showServicePeriod: boolean;
  showPrices: boolean;
  showTaxes: boolean;
  hideZeroTaxes: boolean;
  footer: string;
}

export function printOptions(kind: SalesKind): PrintOptions {
  if (kind === "invoice") {
    const s = settings.get();
    return {
      showProductUnits: s.showProductUnits,
      showServicePeriod: s.showServicePeriod,
      showPrices: true,
      showTaxes: true,
      hideZeroTaxes: s.hideZeroTaxes,
      footer: s.footer,
    };
  }
  const s = documentSettings.get()[kind];
  return {
    showProductUnits: s.showProductUnits,
    showServicePeriod: s.showServicePeriod,
    showPrices: s.showPrices,
    showTaxes: kind === "deliveryNote" || s.showTaxes,
    hideZeroTaxes: kind !== "deliveryNote" && s.hideZeroTaxes,
    footer: s.footer,
  };
}

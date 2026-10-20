import {
  DEFAULT_ORGANIZATION_SETTINGS,
  documentFontSchema,
  type DocumentKind,
  type DocumentLook,
  type DocumentSettings,
  type InvoiceSeriesDefinition,
  type InvoiceSettings,
  type InvoiceTemplate,
  type SalesKind,
} from "@fiscalia/contracts";
import { createStore } from "@/data/store";
import { syncSettings } from "@/data/sync";
import { initialNoteTemplates } from "@/mocks/invoicing";

export const TEMPLATES: { value: InvoiceTemplate; label: string }[] = [
  { value: "classic", label: "Clásica" },
  { value: "classicTraditional", label: "Clásica Tradicional" },
  { value: "modern", label: "Moderna" },
  { value: "modernTraditional", label: "Moderna Tradicional" },
  { value: "elegant", label: "Elegante" },
  { value: "elegantTraditional", label: "Elegante Tradicional" },
  { value: "avantGarde", label: "Vanguardista" },
];

export const FONTS = documentFontSchema.options;

export const DEFAULT_SETTINGS: InvoiceSettings = {
  ...DEFAULT_ORGANIZATION_SETTINGS.invoiceSettings,
  noteTemplates: initialNoteTemplates,
};

const settings = createStore<InvoiceSettings>(DEFAULT_SETTINGS);
syncSettings("invoiceSettings", settings.set);

export function useInvoiceSettings(): InvoiceSettings {
  return settings.use();
}

export const invoiceSettingsStore = {
  get: settings.get,
  update(changes: Partial<InvoiceSettings>) {
    const next = { ...settings.get(), ...changes };
    return settings.write(next, [{ type: "saveSettings", section: "invoiceSettings", data: next }]);
  },
  /** Creates a series or changes one; a built-in series is stored once it changes. */
  saveSeries(series: InvoiceSeriesDefinition) {
    const stored = settings.get().series ?? [];
    const exists = stored.some((s) => s.id === series.id);
    return invoiceSettingsStore.update({
      series: exists ? stored.map((s) => (s.id === series.id ? series : s)) : [...stored, series],
    });
  },
  removeSeries(id: string) {
    return invoiceSettingsStore.update({ series: (settings.get().series ?? []).filter((s) => s.id !== id) });
  },
  setDefaultSeries(series: InvoiceSeriesDefinition) {
    return invoiceSettingsStore.update({
      defaultSeries: { ...settings.get().defaultSeries, [series.type]: series.id },
    });
  },
};

/* ─────────────────── Drafts, quotes and delivery notes ─────────────────── */

export const DEFAULT_DOCUMENT_SETTINGS = DEFAULT_ORGANIZATION_SETTINGS.documentSettings;

const documentSettings = createStore(DEFAULT_DOCUMENT_SETTINGS);
syncSettings("documentSettings", documentSettings.set);

export function useDocumentSettings(kind: DocumentKind): DocumentSettings {
  return documentSettings.use()[kind];
}

export const documentSettingsStore = {
  get: (kind: DocumentKind) => documentSettings.get()[kind],
  update(kind: DocumentKind, changes: Partial<DocumentSettings>) {
    const all = documentSettings.get();
    const next = { ...all, [kind]: { ...all[kind], ...changes } };
    return documentSettings.write(next, [{ type: "saveSettings", section: "documentSettings", data: next }]);
  },
};

/** Whether new documents of a kind propose uploading them to Dropbox and Google Drive. */
export function useUploadDefaults(kind: SalesKind): Pick<DocumentSettings, "uploadToDropbox" | "uploadToDrive"> {
  const invoice = settings.use();
  const documents = documentSettings.use();
  return kind === "invoice" ? invoice : documents[kind];
}

/** What the PDF of a document prints and how it looks, from its kind's settings. */
export interface PrintOptions {
  look: DocumentLook;
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
      look: lookOf(s),
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
    look: lookOf(s),
    showProductUnits: s.showProductUnits,
    showServicePeriod: s.showServicePeriod,
    showPrices: s.showPrices,
    showTaxes: kind === "deliveryNote" || s.showTaxes,
    hideZeroTaxes: kind !== "deliveryNote" && s.hideZeroTaxes,
    footer: s.footer,
  };
}

const lookOf = ({ template, font, textColor, lineColor, backgroundColor, language, numberFormat }: DocumentLook) => ({
  template,
  font,
  textColor,
  lineColor,
  backgroundColor,
  language,
  numberFormat,
});

import { useSyncExternalStore } from "react";
import { initialNoteTemplates, type NoteTemplate } from "@/mocks/invoicing";

/** Look of the PDF. Each template also has a "traditional" variant. */
export type InvoiceTemplate =
  | "classic"
  | "classicTraditional"
  | "modern"
  | "modernTraditional"
  | "elegant"
  | "elegantTraditional"
  | "avantGarde";

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

export interface InvoiceSettings {
  template: InvoiceTemplate;
  font: (typeof FONTS)[number];
  textColor: string;
  lineColor: string;
  backgroundColor: string;
  language: string;
  numberFormat: string;
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

/** In-memory invoice settings, like the sales store: they last until reload. */
let settings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInvoiceSettings(): InvoiceSettings {
  return useSyncExternalStore(subscribe, () => settings);
}

export const invoiceSettingsStore = {
  get: () => settings,
  update(changes: Partial<InvoiceSettings>) {
    settings = { ...settings, ...changes };
    listeners.forEach((listener) => listener());
  },
};

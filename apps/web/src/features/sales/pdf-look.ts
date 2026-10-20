import { centsToEuros, type Cents, type OperationType } from "@fiscalia/core";
import type { DocumentFont, InvoiceTemplate, PaymentMethodType, SalesKind } from "@fiscalia/contracts";

/*
 * How a sales document's PDF looks and reads: template layout, font, colors,
 * labels and number format. Pure, so sales-pdf.ts only draws.
 */

/* ───────────────────────── Templates ───────────────────────── */

/** Layout families, after Contasimple's: Clásica, Moderna, Profesional (our Elegante) and Vanguardista. */
export type TemplateFamily = "classic" | "modern" | "professional" | "avantGarde";

export interface TemplateStyle {
  family: TemplateFamily;
  /**
   * Traditional variants: quantity as "2 x 255,00 €", VAT as "21 % (96,39 €)",
   * totals right after the lines without a breakdown table, then the due date
   * and how to pay. The others anchor the breakdown and totals to the page foot.
   */
  traditional: boolean;
}

export const TEMPLATE_STYLES: Record<InvoiceTemplate, TemplateStyle> = {
  classic: { family: "classic", traditional: false },
  classicTraditional: { family: "classic", traditional: true },
  modern: { family: "modern", traditional: false },
  modernTraditional: { family: "modern", traditional: true },
  elegant: { family: "professional", traditional: false },
  elegantTraditional: { family: "professional", traditional: true },
  avantGarde: { family: "avantGarde", traditional: false },
};

/* ───────────────────────── Fonts and colors ───────────────────────── */

/** The three fonts jsPDF ships with; the others would need embedded font files. */
export type PdfFont = "helvetica" | "times" | "courier";

/** Closest built-in font for each choice: serif, monospaced or sans-serif. */
export const PDF_FONTS: Record<DocumentFont, PdfFont> = {
  Arial: "helvetica",
  "Comic Sans": "helvetica",
  "Courier New": "courier",
  Georgia: "times",
  Impact: "helvetica",
  "Lucida Console": "courier",
  Tahoma: "helvetica",
  "Times New Roman": "times",
  "Trebuchet MS": "helvetica",
  Verdana: "helvetica",
};

export type Rgb = [number, number, number];

/** "#1a2b3c" → [26, 43, 60]; anything unreadable is black. */
export function hexToRgb(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!match) return [0, 0, 0];
  const digits = match[1]!.length === 3 ? [...match[1]!].map((d) => d + d).join("") : match[1]!;
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as Rgb;
}

/** A color moved towards another, e.g. muted text: the text color 45% of the way to the paper. */
export function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return from.map((c, i) => Math.round(c + (to[i]! - c) * amount)) as Rgb;
}

/* ───────────────────────── Locale ───────────────────────── */

export interface DocumentLocale {
  language: string;
  region: string;
}

type LocaleSource = { language?: string; numberFormat?: string };

/**
 * The document's own language and format, else the client's, else the template's.
 * Language and region travel together, so a format never pairs with another language.
 */
export function documentLocale(doc: LocaleSource, client: LocaleSource, look: Required<LocaleSource>): DocumentLocale {
  const source = [doc, client].find((s) => s.language) ?? look;
  return { language: source.language!, region: source.numberFormat || look.numberFormat };
}

/** The built-in fonts only cover WinAnsi: plain minus and spaces instead of the typographic ones. */
export const pdfText = (text: string) => text.replace(/[−‒–]/g, "-").replace(/[   ]/g, " ");

export interface PdfFormat {
  money: (amount: Cents) => string;
  /** 0.21 → "21 %", in the language's notation. */
  percent: (rate: number) => string;
  quantity: (value: number) => string;
  /** ISO date → the region's numeric date, e.g. "05/03/2026". */
  date: (isoDate: string) => string;
}

function intlLocale({ language, region }: DocumentLocale): string {
  const tag = region ? `${language}-${region}` : language;
  try {
    return Intl.getCanonicalLocales(tag)[0] ?? "es-ES";
  } catch {
    return "es-ES";
  }
}

export function pdfFormat(locale: DocumentLocale): PdfFormat {
  const tag = intlLocale(locale);
  const money = new Intl.NumberFormat(tag, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    // es-ES doesn't group 4-digit numbers by default
    useGrouping: "always",
  });
  const percent = new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 2 });
  const quantity = new Intl.NumberFormat(tag, { maximumFractionDigits: 4 });
  const date = new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  return {
    money: (amount) => pdfText(money.format(centsToEuros(amount))),
    percent: (rate) => pdfText(percent.format(rate)),
    quantity: (value) => pdfText(quantity.format(value)),
    date: (isoDate) => {
      const [y, m, d] = isoDate.split("-").map(Number);
      return pdfText(date.format(new Date(Date.UTC(y!, m! - 1, d!))));
    },
  };
}

/* ───────────────────────── Labels ───────────────────────── */

export interface PdfLabels {
  kinds: Record<SalesKind, string>;
  rectifyingInvoice: string;
  /** "Número de factura". */
  numberOf: Record<SalesKind, string>;
  date: string;
  dueDate: string;
  /** Short form, in the date tables of Elegante and Vanguardista. */
  due: string;
  validUntil: string;
  client: string;
  taxId: string;
  phone: string;
  web: string;
  concept: string;
  units: string;
  unitBase: string;
  discount: string;
  lineBase: string;
  vatRate: string;
  vat: string;
  quantity: string;
  /** The line base in the traditional templates. */
  baseShort: string;
  taxBase: string;
  taxType: string;
  tax: string;
  totals: string;
  /** "Total B.I." */
  totalBase: string;
  /** "Total Base Imponible" */
  totalBaseLong: string;
  totalVat: string;
  surcharge: string;
  withholding: string;
  supplies: string;
  total: string;
  totalUntaxed: string;
  information: string;
  /** "A pagar por transferencia bancaria", per payment method type. */
  payBy: Record<PaymentMethodType, string>;
  /** Appended to `payBy` when the method has an account: " en la cuenta {account}". */
  payToAccount: string;
  period: string;
  /** Legal mention for operations without Spanish VAT. */
  operations: Partial<Record<OperationType, string>>;
}

export const PDF_LABELS: Record<string, PdfLabels> = {
  es: {
    kinds: { invoice: "Factura", draft: "Factura borrador", quote: "Presupuesto", deliveryNote: "Albarán" },
    rectifyingInvoice: "Factura rectificativa",
    numberOf: {
      invoice: "Número de factura",
      draft: "Número de borrador",
      quote: "Número de presupuesto",
      deliveryNote: "Número de albarán",
    },
    date: "Fecha",
    dueDate: "Fecha de vencimiento",
    due: "Vencimiento",
    validUntil: "Fecha de validez",
    client: "Cliente",
    taxId: "NIF",
    phone: "Telf",
    web: "Url",
    concept: "Concepto",
    units: "Uds.",
    unitBase: "Base Ud.",
    discount: "% Dto",
    lineBase: "Base Total",
    vatRate: "% I.V.A.",
    vat: "I.V.A.",
    quantity: "Cantidad",
    baseShort: "Base imp.",
    taxBase: "Base Imponible",
    taxType: "Tipo impuesto",
    tax: "Impuesto",
    totals: "Totales",
    totalBase: "Total B.I.",
    totalBaseLong: "Total Base Imponible",
    totalVat: "Total I.V.A.",
    surcharge: "Recargo de equivalencia",
    withholding: "Retención IRPF",
    supplies: "Suplidos",
    total: "Total",
    totalUntaxed: "Total (impuestos no incluidos)",
    information: "Información",
    payBy: {
      transfer: "A pagar por transferencia bancaria",
      cash: "A pagar en efectivo",
      card: "A pagar con tarjeta",
      directDebit: "A pagar por domiciliación bancaria",
      promissory: "A pagar mediante pagaré",
      paypal: "A pagar por PayPal",
    },
    payToAccount: " en la cuenta {account}",
    period: "Periodo",
    operations: {
      exempt: "Operación exenta de IVA.",
      notSubject: "Operación no sujeta a IVA.",
      reverseCharge: "Inversión del sujeto pasivo.",
      intraEu: "Operación intracomunitaria sin IVA: inversión del sujeto pasivo.",
      export: "Exportación exenta de IVA.",
    },
  },
  ca: {
    kinds: { invoice: "Factura", draft: "Factura esborrany", quote: "Pressupost", deliveryNote: "Albarà" },
    rectifyingInvoice: "Factura rectificativa",
    numberOf: {
      invoice: "Número de factura",
      draft: "Número d'esborrany",
      quote: "Número de pressupost",
      deliveryNote: "Número d'albarà",
    },
    date: "Data",
    dueDate: "Data de venciment",
    due: "Venciment",
    validUntil: "Data de validesa",
    client: "Client",
    taxId: "NIF",
    phone: "Telf",
    web: "Url",
    concept: "Concepte",
    units: "Uts.",
    unitBase: "Base Ut.",
    discount: "% Dte",
    lineBase: "Base Total",
    vatRate: "% I.V.A.",
    vat: "I.V.A.",
    quantity: "Quantitat",
    baseShort: "Base imp.",
    taxBase: "Base Imposable",
    taxType: "Tipus impost",
    tax: "Impost",
    totals: "Totals",
    totalBase: "Total B.I.",
    totalBaseLong: "Total Base Imposable",
    totalVat: "Total I.V.A.",
    surcharge: "Recàrrec d'equivalència",
    withholding: "Retenció IRPF",
    supplies: "Suplerts",
    total: "Total",
    totalUntaxed: "Total (impostos no inclosos)",
    information: "Informació",
    payBy: {
      transfer: "A pagar per transferència bancària",
      cash: "A pagar en efectiu",
      card: "A pagar amb targeta",
      directDebit: "A pagar per domiciliació bancària",
      promissory: "A pagar mitjançant pagaré",
      paypal: "A pagar per PayPal",
    },
    payToAccount: " al compte {account}",
    period: "Període",
    operations: {
      exempt: "Operació exempta d'IVA.",
      notSubject: "Operació no subjecta a IVA.",
      reverseCharge: "Inversió del subjecte passiu.",
      intraEu: "Operació intracomunitària sense IVA: inversió del subjecte passiu.",
      export: "Exportació exempta d'IVA.",
    },
  },
  gl: {
    kinds: { invoice: "Factura", draft: "Factura borrador", quote: "Orzamento", deliveryNote: "Albará" },
    rectifyingInvoice: "Factura rectificativa",
    numberOf: {
      invoice: "Número de factura",
      draft: "Número de borrador",
      quote: "Número de orzamento",
      deliveryNote: "Número de albará",
    },
    date: "Data",
    dueDate: "Data de vencemento",
    due: "Vencemento",
    validUntil: "Data de validez",
    client: "Cliente",
    taxId: "NIF",
    phone: "Tlf",
    web: "Url",
    concept: "Concepto",
    units: "Uds.",
    unitBase: "Base Ud.",
    discount: "% Dto",
    lineBase: "Base Total",
    vatRate: "% I.V.E.",
    vat: "I.V.E.",
    quantity: "Cantidade",
    baseShort: "Base imp.",
    taxBase: "Base Impoñible",
    taxType: "Tipo imposto",
    tax: "Imposto",
    totals: "Totais",
    totalBase: "Total B.I.",
    totalBaseLong: "Total Base Impoñible",
    totalVat: "Total I.V.E.",
    surcharge: "Recargo de equivalencia",
    withholding: "Retención IRPF",
    supplies: "Suplidos",
    total: "Total",
    totalUntaxed: "Total (impostos non incluídos)",
    information: "Información",
    payBy: {
      transfer: "A pagar por transferencia bancaria",
      cash: "A pagar en efectivo",
      card: "A pagar con tarxeta",
      directDebit: "A pagar por domiciliación bancaria",
      promissory: "A pagar mediante pagaré",
      paypal: "A pagar por PayPal",
    },
    payToAccount: " na conta {account}",
    period: "Período",
    operations: {
      exempt: "Operación exenta de IVE.",
      notSubject: "Operación non suxeita a IVE.",
      reverseCharge: "Investimento do suxeito pasivo.",
      intraEu: "Operación intracomunitaria sen IVE: investimento do suxeito pasivo.",
      export: "Exportación exenta de IVE.",
    },
  },
  eu: {
    kinds: { invoice: "Faktura", draft: "Faktura zirriborroa", quote: "Aurrekontua", deliveryNote: "Albarana" },
    rectifyingInvoice: "Faktura zuzentzailea",
    numberOf: {
      invoice: "Faktura zenbakia",
      draft: "Zirriborro zenbakia",
      quote: "Aurrekontu zenbakia",
      deliveryNote: "Albaran zenbakia",
    },
    date: "Data",
    dueDate: "Mugaeguna",
    due: "Mugaeguna",
    validUntil: "Baliozkotasun-data",
    client: "Bezeroa",
    taxId: "IFZ",
    phone: "Tel",
    web: "Url",
    concept: "Kontzeptua",
    units: "Unit.",
    unitBase: "Unit. oinarria",
    discount: "% Desk.",
    lineBase: "Oinarria guztira",
    vatRate: "% BEZ",
    vat: "BEZ",
    quantity: "Kopurua",
    baseShort: "Oinarria",
    taxBase: "Zerga-oinarria",
    taxType: "Zerga mota",
    tax: "Zerga",
    totals: "Guztizkoak",
    totalBase: "Oinarria guztira",
    totalBaseLong: "Zerga-oinarria guztira",
    totalVat: "BEZ guztira",
    surcharge: "Baliokidetasun-errekargua",
    withholding: "PFEZ atxikipena",
    supplies: "Suplidoak",
    total: "Guztira",
    totalUntaxed: "Guztira (zergarik gabe)",
    information: "Informazioa",
    payBy: {
      transfer: "Banku-transferentzia bidez ordaintzekoa",
      cash: "Eskudirutan ordaintzekoa",
      card: "Txartelarekin ordaintzekoa",
      directDebit: "Banku-helbideratze bidez ordaintzekoa",
      promissory: "Ordainagiri bidez ordaintzekoa",
      paypal: "PayPal bidez ordaintzekoa",
    },
    payToAccount: ". Kontua: {account}",
    period: "Aldia",
    operations: {
      exempt: "BEZetik salbuetsitako eragiketa.",
      notSubject: "BEZaren mende ez dagoen eragiketa.",
      reverseCharge: "Subjektu pasiboaren inbertsioa.",
      intraEu: "BEZik gabeko Erkidego barneko eragiketa: subjektu pasiboaren inbertsioa.",
      export: "BEZetik salbuetsitako esportazioa.",
    },
  },
  en: {
    kinds: { invoice: "Invoice", draft: "Draft invoice", quote: "Quote", deliveryNote: "Delivery note" },
    rectifyingInvoice: "Corrective invoice",
    numberOf: {
      invoice: "Invoice number",
      draft: "Draft number",
      quote: "Quote number",
      deliveryNote: "Delivery note number",
    },
    date: "Date",
    dueDate: "Due date",
    due: "Due",
    validUntil: "Valid until",
    client: "Bill to",
    taxId: "Tax ID",
    phone: "Tel",
    web: "Url",
    concept: "Description",
    units: "Qty",
    unitBase: "Unit price",
    discount: "Disc. %",
    lineBase: "Net amount",
    vatRate: "VAT %",
    vat: "VAT",
    quantity: "Quantity",
    baseShort: "Net",
    taxBase: "Tax base",
    taxType: "Tax type",
    tax: "Tax",
    totals: "Totals",
    totalBase: "Total net",
    totalBaseLong: "Total tax base",
    totalVat: "Total VAT",
    surcharge: "Equivalence surcharge",
    withholding: "Income tax withholding",
    supplies: "Disbursements",
    total: "Total",
    totalUntaxed: "Total (excluding taxes)",
    information: "Information",
    payBy: {
      transfer: "Payment by bank transfer",
      cash: "Payment in cash",
      card: "Payment by card",
      directDebit: "Payment by direct debit",
      promissory: "Payment by promissory note",
      paypal: "Payment by PayPal",
    },
    payToAccount: " to account {account}",
    period: "Period",
    operations: {
      exempt: "VAT exempt transaction.",
      notSubject: "Transaction not subject to VAT.",
      reverseCharge: "Reverse charge.",
      intraEu: "Intra-Community supply exempt from VAT: reverse charge.",
      export: "Export exempt from VAT.",
    },
  },
  de: {
    kinds: { invoice: "Rechnung", draft: "Rechnungsentwurf", quote: "Angebot", deliveryNote: "Lieferschein" },
    rectifyingInvoice: "Korrekturrechnung",
    numberOf: {
      invoice: "Rechnungsnummer",
      draft: "Entwurfsnummer",
      quote: "Angebotsnummer",
      deliveryNote: "Lieferscheinnummer",
    },
    date: "Datum",
    dueDate: "Fälligkeitsdatum",
    due: "Fällig",
    validUntil: "Gültig bis",
    client: "Kunde",
    taxId: "Steuer-Nr.",
    phone: "Tel.",
    web: "Url",
    concept: "Beschreibung",
    units: "Menge",
    unitBase: "Einzelpreis",
    discount: "% Rabatt",
    lineBase: "Netto",
    vatRate: "% USt.",
    vat: "USt.",
    quantity: "Menge",
    baseShort: "Netto",
    taxBase: "Bemessungsgrundlage",
    taxType: "Steuerart",
    tax: "Steuer",
    totals: "Summen",
    totalBase: "Summe netto",
    totalBaseLong: "Summe Bemessungsgrundlage",
    totalVat: "Summe USt.",
    surcharge: "Ausgleichszuschlag",
    withholding: "IRPF-Einbehalt",
    supplies: "Auslagen",
    total: "Gesamtbetrag",
    totalUntaxed: "Gesamt (ohne Steuern)",
    information: "Informationen",
    payBy: {
      transfer: "Zahlung per Banküberweisung",
      cash: "Barzahlung",
      card: "Zahlung per Karte",
      directDebit: "Zahlung per Lastschrift",
      promissory: "Zahlung per Schuldschein",
      paypal: "Zahlung per PayPal",
    },
    payToAccount: " auf das Konto {account}",
    period: "Zeitraum",
    operations: {
      exempt: "Steuerbefreiter Umsatz.",
      notSubject: "Nicht steuerbarer Umsatz.",
      reverseCharge: "Steuerschuldnerschaft des Leistungsempfängers.",
      intraEu: "Steuerfreie innergemeinschaftliche Lieferung: Steuerschuldnerschaft des Leistungsempfängers.",
      export: "Steuerfreie Ausfuhr.",
    },
  },
  fr: {
    kinds: { invoice: "Facture", draft: "Brouillon de facture", quote: "Devis", deliveryNote: "Bon de livraison" },
    rectifyingInvoice: "Facture rectificative",
    numberOf: {
      invoice: "Numéro de facture",
      draft: "Numéro de brouillon",
      quote: "Numéro de devis",
      deliveryNote: "Numéro de bon de livraison",
    },
    date: "Date",
    dueDate: "Date d'échéance",
    due: "Échéance",
    validUntil: "Valable jusqu'au",
    client: "Client",
    taxId: "NIF",
    phone: "Tél",
    web: "Url",
    concept: "Désignation",
    units: "Qté",
    unitBase: "P.U. HT",
    discount: "% Remise",
    lineBase: "Total HT",
    vatRate: "% TVA",
    vat: "TVA",
    quantity: "Quantité",
    baseShort: "Base HT",
    taxBase: "Base imposable",
    taxType: "Type de taxe",
    tax: "Taxe",
    totals: "Totaux",
    totalBase: "Total HT",
    totalBaseLong: "Total base imposable",
    totalVat: "Total TVA",
    surcharge: "Supplément d'équivalence",
    withholding: "Retenue IRPF",
    supplies: "Débours",
    total: "Total",
    totalUntaxed: "Total (hors taxes)",
    information: "Informations",
    payBy: {
      transfer: "Paiement par virement bancaire",
      cash: "Paiement en espèces",
      card: "Paiement par carte",
      directDebit: "Paiement par prélèvement",
      promissory: "Paiement par billet à ordre",
      paypal: "Paiement par PayPal",
    },
    payToAccount: " sur le compte {account}",
    period: "Période",
    operations: {
      exempt: "Opération exonérée de TVA.",
      notSubject: "Opération non soumise à la TVA.",
      reverseCharge: "Autoliquidation.",
      intraEu: "Livraison intracommunautaire exonérée de TVA : autoliquidation.",
      export: "Exportation exonérée de TVA.",
    },
  },
};

export const pdfLabels = (language: string): PdfLabels => PDF_LABELS[language] ?? PDF_LABELS.es!;

/** "A pagar por transferencia bancaria en la cuenta ES91…"; the account only when the method has one. */
export function paymentText(t: PdfLabels, method: { type: PaymentMethodType; number: string }): string {
  const account = method.number.trim();
  const toAccount = account && method.type !== "cash" ? t.payToAccount.replace("{account}", account) : "";
  return t.payBy[method.type] + toAccount;
}

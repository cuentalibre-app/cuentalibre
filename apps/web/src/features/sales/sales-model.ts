import {
  INVOICE_VAT_RATES,
  newId,
  SURCHARGE_RATES,
  WITHHOLDING_RATES,
  centsToEuros,
  eurosToCents,
  amountOutstanding,
  invoiceTotals,
  lineBase,
  isOverdue,
  laterInvoiceInSeries,
  nextDocumentNumber,
  nextInvoiceNumber,
  paymentStatus,
  periodKey,
  quarterOfMonth,
  sumCents,
  type Cents,
  type InvoiceTotals,
  type OperationType,
  type WithholdingKind,
} from "@fiscalia/core";
import {
  BUILT_IN_INVOICE_SERIES,
  invoiceSeriesOf,
  type Contact,
  type IncomeType,
  type InvoiceSeriesDefinition,
  type Payment,
  type RentalLocation,
  type SalesDocument,
  type SalesKind,
  type SalesLine,
} from "@fiscalia/contracts";
import type { BadgeProps } from "@fiscalia/ui/components/badge";
import { contactsStore } from "@/features/contacts/contacts-store";
import { invoiceSettingsStore } from "./invoice-settings";

export interface KindConfig {
  title: string;
  /** "Factura", for titles. */
  singular: string;
  /** Lowercase noun with article, for sentences: "la factura". */
  noun: string;
  path: string;
  newPath: string;
  newLabel: string;
  createLabel: string;
  empty: string;
  /** Label of `dueOn`, or null when the kind has no such date. */
  dueLabel: string | null;
  numberPrefix: string;
  /** Name of the kind's own numbering series; invoices pick between normal and rectifying series instead. */
  seriesLabel: string;
  /** Whether the document can't be saved without a client. */
  clientRequired: boolean;
  /** Placeholder of the client select; with an optional client it is also the "no client" choice. */
  clientPlaceholder: string;
  /** Statuses that can be set by hand, in workflow order. */
  statuses: StatusKey[];
}

export const KINDS: Record<SalesKind, KindConfig> = {
  invoice: {
    title: "Facturas emitidas",
    singular: "Factura",
    noun: "la factura",
    path: "/ventas/facturas",
    newPath: "/ventas/facturas/nueva",
    newLabel: "Nueva factura",
    createLabel: "Crear factura",
    empty: "No hay facturas en este periodo.",
    dueLabel: "Vencimiento",
    numberPrefix: "",
    seriesLabel: "Facturas normales",
    clientRequired: true,
    clientPlaceholder: "Selecciona el cliente",
    statuses: ["pending", "partial", "overdue", "paid"],
  },
  draft: {
    title: "Borradores",
    singular: "Factura borrador",
    noun: "la factura borrador",
    path: "/ventas/borradores",
    newPath: "/ventas/borradores/nuevo",
    newLabel: "Nueva factura borrador",
    createLabel: "Crear factura borrador",
    empty: "No hay borradores en este periodo.",
    dueLabel: "Fecha de validez",
    numberPrefix: "BOR-",
    seriesLabel: "Facturas borrador",
    clientRequired: false,
    clientPlaceholder: "Selecciona el cliente",
    statuses: [],
  },
  quote: {
    title: "Presupuestos",
    singular: "Presupuesto",
    noun: "el presupuesto",
    path: "/ventas/presupuestos",
    newPath: "/ventas/presupuestos/nuevo",
    newLabel: "Nuevo presupuesto",
    createLabel: "Crear presupuesto",
    empty: "No hay presupuestos en este periodo.",
    dueLabel: "Fecha de validez",
    numberPrefix: "P-",
    seriesLabel: "Presupuestos",
    clientRequired: false,
    clientPlaceholder: "Sin datos de cliente",
    statuses: ["created", "sent", "accepted", "rejected", "invoiced"],
  },
  deliveryNote: {
    title: "Albaranes",
    singular: "Albarán",
    noun: "el albarán",
    path: "/ventas/albaranes",
    newPath: "/ventas/albaranes/nuevo",
    newLabel: "Nuevo albarán",
    createLabel: "Crear albarán",
    empty: "No hay albaranes en este periodo.",
    dueLabel: null,
    numberPrefix: "AL-",
    seriesLabel: "Albaranes",
    clientRequired: true,
    clientPlaceholder: "Selecciona el cliente",
    statuses: ["created", "sent", "accepted", "rejected", "invoiced"],
  },
};

/** What the list shows: the stored status, with "partial" and "overdue" derived for unpaid invoices. */
export type StatusKey = SalesDocument["status"] | "partial" | "overdue" | "draft";

export const STATUS: Record<StatusKey, { label: string; tone: BadgeProps["tone"] }> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending: { label: "Pendiente", tone: "neutral" },
  partial: { label: "Cobro parcial", tone: "warning" },
  overdue: { label: "Vencida", tone: "danger" },
  paid: { label: "Cobrada", tone: "success" },
  created: { label: "Creado", tone: "neutral" },
  sent: { label: "Enviado", tone: "primary" },
  accepted: { label: "Aceptado", tone: "success" },
  rejected: { label: "Rechazado", tone: "danger" },
  invoiced: { label: "Facturado", tone: "neutral" },
};

export function displayStatus(doc: SalesDocument, today: Date): StatusKey {
  if (doc.kind === "draft") return "draft";
  if (doc.kind === "invoice" && isOverdue(doc.dueOn, doc.status === "paid", today)) return "overdue";
  if (doc.kind === "invoice" && doc.status === "pending" && doc.payments?.length) return "partial";
  return doc.status;
}

/** What has been collected of an invoice; a rectifying invoice's refunds are negative. */
export const collectedOf = (doc: SalesDocument): Cents => sumCents((doc.payments ?? []).map((p) => p.amount));

/** What is still to be collected; never negative. */
export const outstandingOf = (doc: SalesDocument): Cents =>
  amountOutstanding(
    documentTotals(doc).total,
    (doc.payments ?? []).map((p) => p.amount),
  );

/**
 * The changes that set an invoice's collections: it is paid once they cover
 * the total. The server derives the same status.
 */
export function withPayments(doc: SalesDocument, payments: Payment[]): Pick<SalesDocument, "payments" | "status"> {
  const status = paymentStatus(
    documentTotals(doc).total,
    payments.map((p) => p.amount),
  );
  return { payments, status: status === "paid" ? "paid" : "pending" };
}

/** A collection of what is still pending, today, by the method last used or the default one. */
export function settlingPayment(doc: SalesDocument, date: string, paymentMethodId: string): Payment {
  return { id: newId(), date, amount: outstandingOf(doc), paymentMethodId };
}

/** Totals of a document; an issued invoice keeps the ones frozen when it was issued. */
export function documentTotals(
  doc: Pick<SalesDocument, "lines" | "withholding" | "supplies"> & { issued?: SalesDocument["issued"] },
): InvoiceTotals {
  return doc.issued?.totals ?? invoiceTotals(doc.lines, WITHHOLDING_RATES[doc.withholding], doc.supplies);
}

/** The client of a document; an issued invoice keeps the fiscal data it was issued with. */
export function clientOf(doc: SalesDocument): Contact {
  // Drafts and quotes can be saved without a client
  if (!doc.clientId) return { id: "", name: "Sin cliente", taxId: "" };
  const current = contactsStore.get("client", doc.clientId);
  if (doc.issued) return { ...current, id: doc.clientId, ...doc.issued.client };
  return current ?? { id: doc.clientId, name: "Cliente eliminado", taxId: "" };
}

/** "2026-0046-estudio-norte-s-l.pdf": number (or draft date) and client, for downloads. */
export function documentFileName(doc: SalesDocument, extension: string) {
  const slug = clientOf(doc)
    .name.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return `${doc.number ?? `borrador-${doc.issuedOn}`}-${slug.replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}.${extension}`;
}

/** Issued invoices, as numbering needs them. */
const issuedInvoices = (docs: SalesDocument[]) =>
  docs.filter((d) => d.kind === "invoice" && d.number !== null) as (SalesDocument & { number: string })[];

/** Which series a document is numbered in, as documents and the form carry it. */
export type SeriesRef = Pick<SalesDocument, "series" | "seriesId">;

/** Every invoice series: the built-in ones, then those created in the settings. */
export function invoiceSeriesList(
  custom: readonly InvoiceSeriesDefinition[] = invoiceSettingsStore.get().series ?? [],
): InvoiceSeriesDefinition[] {
  return [...BUILT_IN_INVOICE_SERIES, ...custom];
}

/** The series of a document; the server keeps a series in use from being removed, so it's always there. */
export function seriesOf(ref: SeriesRef): InvoiceSeriesDefinition {
  return invoiceSeriesOf(ref, invoiceSettingsStore.get().series ?? []) ?? invoiceSeriesOf({ series: ref.series }, [])!;
}

/** How a document names its series, built-in series by their type and custom ones by their id. */
export function seriesRefOf(series: InvoiceSeriesDefinition): SeriesRef {
  const builtIn = BUILT_IN_INVOICE_SERIES.some((s) => s.id === series.id);
  return { series: series.type, seriesId: builtIn ? undefined : series.id };
}

/** The series of a select, grouped by type, with the value each option stands for. */
export function seriesGroups(list: InvoiceSeriesDefinition[]): OptionGroup[] {
  const options = (type: InvoiceSeriesDefinition["type"]) =>
    list.filter((s) => s.type === type).map((s) => ({ value: s.id, label: s.name }));
  return [
    { label: "Series normales", options: options("normal") },
    { label: "Series rectificativas", options: options("rectifying") },
  ];
}

/**
 * Next number of a kind. For invoices it's a forecast of the one the server
 * will assign on issuing; the other kinds keep the number they are given.
 */
export function nextNumber(kind: SalesKind, series: SeriesRef, issuedOn: string, docs: SalesDocument[]): string {
  if (kind === "invoice") return nextInvoiceNumber(seriesOf(series).mask, issuedOn, issuedInvoices(docs));
  const numbers = docs.filter((d) => d.number !== null).map((d) => d.number!);
  return nextDocumentNumber(KINDS[kind].numberPrefix, Number(issuedOn.slice(0, 4)), numbers);
}

/** The invoice of the series dated after `issuedOn` that keeps a new one from being issued, if any. */
export function laterInvoice(series: SeriesRef, issuedOn: string, docs: SalesDocument[]) {
  return laterInvoiceInSeries(seriesOf(series).mask, issuedOn, issuedInvoices(docs));
}

/**
 * One line per tax rate (VAT and surcharge) naming the source document, for invoicing a delivery
 * note without copying its lines. Discounts are folded into each line's amount.
 */
export function groupLinesByTax(doc: SalesDocument): SalesLine[] {
  const name = `${KINDS[doc.kind].singular} ${doc.number ?? ""}`.trim();
  const groups = new Map<string, SalesLine>();
  for (const line of doc.lines) {
    const surchargeRate = line.surchargeRate ?? 0;
    const key = `${line.vatRate}|${surchargeRate}`;
    const group = groups.get(key);
    // Unit prices are in euros; add the line bases as cents so the sum stays exact
    if (group) group.unitPrice = centsToEuros(eurosToCents(group.unitPrice + centsToEuros(lineBase(line))));
    else
      groups.set(key, {
        id: newId(),
        concept: name,
        unitPrice: centsToEuros(lineBase(line)),
        quantity: 1,
        discount: 0,
        vatRate: line.vatRate,
        surchargeRate,
      });
  }
  const lines = [...groups.values()];
  if (lines.length > 1) for (const line of lines) line.concept = `${name} (IVA ${ratePercent(line.vatRate)})`;
  return lines;
}

/** URL period key ("2026-T4") of the quarter a date falls in. */
export function periodKeyOf(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return periodKey({ year: year!, quarter: quarterOfMonth(month! - 1) });
}

export interface Option<T extends string = string> {
  value: T;
  label: string;
  /** Longer explanation, shown as a tooltip or hint. */
  title?: string;
}

/** Options under an optional heading, as in a grouped select. */
export interface OptionGroup<T extends string = string> {
  label?: string;
  options: Option<T>[];
}

/** Accounts of group 7 of the PGC, under their subgroup. */
export const INCOME_TYPE_GROUPS: OptionGroup<IncomeType>[] = [
  {
    label: "70. Venta de mercaderías o servicios",
    options: [
      { value: "700", label: "700. Venta de mercaderías" },
      { value: "705", label: "705. Prestación de servicios" },
      { value: "7098", label: "7098. Otras prestaciones de servicios" },
      { value: "7099", label: "7099. Otras ventas de mercaderías" },
    ],
  },
  {
    label: "74. Subvenciones",
    options: [
      { value: "740", label: "740. Subvenciones a la explotación" },
      { value: "746", label: "746. Subvenciones al capital" },
      { value: "747", label: "747. Otras subvenciones" },
    ],
  },
  { label: "75. Otros ingresos de gestión", options: [{ value: "752", label: "752. Ingresos por arrendamiento" }] },
  { label: "76. Ingresos financieros", options: [{ value: "769", label: "769. Ingresos financieros" }] },
];

export const WITHHOLDING_GROUPS: OptionGroup<WithholdingKind>[] = [
  { options: [{ value: "none", label: "Sin retención" }] },
  {
    label: "Valores actuales",
    options: [
      { value: "modules", label: "1 % · Módulos o actividades ganaderas" },
      { value: "farming", label: "2 % · Sector agrario" },
      { value: "newProfessional", label: "7 % · Profesionales en los dos primeros años de actividad" },
      { value: "professional", label: "15 % · Profesionales" },
      { value: "rental", label: "19 % · Alquileres o intereses (capital mobiliario)" },
      { value: "imageRights", label: "24 % · Cesión de derechos de imagen" },
    ],
  },
  {
    label: "Valores bonificados (Ceuta y Melilla)",
    options: [
      {
        value: "ceutaNewProfessional",
        label: "2,8 % · Profesionales en los dos primeros años de actividad (Ceuta y Melilla)",
      },
      { value: "ceutaProfessional", label: "6 % · Profesionales (de Ceuta y Melilla)" },
      { value: "ceutaRental", label: "7,6 % · Alquiler (Ceuta y Melilla)" },
    ],
  },
  {
    label: "Valores antiguos",
    options: [
      {
        value: "legacyCeutaNewProfessional2018",
        label: "3,5 % · Profesionales Ceuta y Melilla en los dos primeros años (para facturas anteriores 05-Jul-18)",
      },
      {
        value: "legacyCeutaNewProfessional2015",
        label: "4,5 % · Profesionales Ceuta y Melilla en los dos primeros años (para facturas anteriores 12-Jul-15)",
      },
      {
        value: "legacyCeutaProfessional2018",
        label: "7,5 % · Profesionales de Ceuta y Melilla (para facturas anteriores al 05-Jul-18)",
      },
      {
        value: "legacyNewProfessional2015",
        label: "9 % · Profesionales en los 2 primeros años de actividad (para facturas anteriores 12-Jul-15)",
      },
      {
        value: "legacyCeutaProfessional2015",
        label: "9,5 % · Profesionales de Ceuta y Melilla (para facturas anteriores 12-Jul-15)",
      },
      {
        value: "legacyCeutaProfessional2014",
        label: "10,5 % · Profesionales de Ceuta y Melilla (para ejercicios anteriores al 2015)",
      },
      { value: "legacyRental2009", label: "18 % · Alquileres (para ejercicios anteriores al 2010)" },
      {
        value: "legacyRental2015",
        label: "19,5 % · Alquileres o intereses (capital mobiliario) (para ejercicios anteriores al 2016)",
      },
      {
        value: "legacyRentalJuly2015",
        label: "20 % · Alquileres o intereses (capital mobiliario) (para facturas anteriores 12-Jul-15)",
      },
      {
        value: "legacyProfessional2014",
        label: "21 % · Profesionales o alquileres (para ejercicios anteriores al 2015)",
      },
    ],
  },
];

export const OPERATION_TYPES: { value: OperationType; label: string; hint: string }[] = [
  { value: "national", label: "Nacional", hint: "Si el destinatario tiene el domicilio social en España." },
  {
    value: "exempt",
    label: "Nacional exenta",
    hint: "Si la actividad está exenta de IVA: medicina, enseñanza reglada, seguros, etc.",
  },
  { value: "notSubject", label: "Nacional no sujeta", hint: "Si la actividad no está sujeta a IVA." },
  {
    value: "reverseCharge",
    label: "Inversión del sujeto pasivo",
    hint: "Por ejemplo, facturas de importación de servicios, ejecuciones de obra, entrega de chatarra, etc.",
  },
  {
    value: "intraEu",
    label: "Intracomunitaria",
    hint: "Si el destinatario está inscrito en el VIES y es autónomo o sociedad con domicilio fiscal fuera de España pero en la UE.",
  },
  {
    value: "export",
    label: "Exportación",
    hint: "Entrega de mercancías si el destinatario tiene domicilio social en Canarias, Ceuta, Melilla o fuera de la Unión Europea.",
  },
];

export const RENTAL_LOCATIONS: Option<RentalLocation>[] = [
  {
    value: "spain",
    label:
      "Inmueble con referencia catastral situado en cualquier punto del territorio español, con excepción de la Comunidad Autónoma del País Vasco y Comunidad Foral de Navarra",
  },
  {
    value: "basqueCountry",
    label: "Inmueble con referencia catastral situado en la Comunidad Autónoma del País Vasco",
  },
  { value: "navarre", label: "Inmueble con referencia catastral situado en la Comunidad Foral de Navarra" },
  {
    value: "noCadastralRef",
    label: "Inmueble situado en cualquier punto del territorio español, pero sin tener asignada referencia catastral",
  },
  { value: "abroad", label: "Inmueble situado en el extranjero" },
];

/** "7,5 %" */
export const ratePercent = (rate: number) => `${String(Math.round(rate * 10_000) / 100).replace(".", ",")} %`;

export const VAT_RATE_OPTIONS: Option[] = INVOICE_VAT_RATES.map((r) => ({ value: String(r), label: ratePercent(r) }));

const SURCHARGE_HINTS: Record<number, string> = {
  0: "Para los artículos que no tienen recargo de equivalencia",
  0.0026: "Para los artículos con IVA al tipo reducido del 2 %",
  0.005: "Para los artículos con IVA al tipo reducido del 4 %",
  0.0062: "Para los artículos con IVA al tipo reducido del 5 %",
  0.01: "Para los artículos con IVA al tipo reducido del 7,5 %",
  0.014: "Para los artículos con IVA al tipo reducido del 10 %",
  0.0175: "Para la venta de tabaco",
  0.052: "Para los artículos con IVA al tipo general del 21 %",
};

export const SURCHARGE_OPTIONS: Option[] = SURCHARGE_RATES.map((r) => ({
  value: String(r),
  label: ratePercent(r),
  title: SURCHARGE_HINTS[r],
}));

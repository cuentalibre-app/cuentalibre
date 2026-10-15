import {
  WITHHOLDING_RATES,
  invoiceTotals,
  isOverdue,
  nextDocumentNumber,
  periodKey,
  quarterOfMonth,
  type InvoiceTotals,
  type OperationType,
  type WithholdingKind,
} from "@fiscalia/core";
import type { BadgeProps } from "@fiscalia/ui/components/badge";
import { clients, type IncomeType, type InvoiceSeries, type SalesDocument, type SalesKind } from "@/mocks/sales";

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
    statuses: ["pending", "overdue", "paid"],
  },
  draft: {
    title: "Borradores",
    singular: "Borrador",
    noun: "el borrador",
    path: "/ventas/borradores",
    newPath: "/ventas/borradores/nuevo",
    newLabel: "Nuevo borrador",
    createLabel: "Guardar borrador",
    empty: "No hay borradores en este periodo.",
    dueLabel: "Vencimiento",
    numberPrefix: "",
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
    dueLabel: "Válido hasta",
    numberPrefix: "P-",
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
    numberPrefix: "A-",
    statuses: ["created", "sent", "accepted", "rejected", "invoiced"],
  },
};

/** What the list shows: the stored status, with "overdue" derived for unpaid invoices. */
export type StatusKey = SalesDocument["status"] | "overdue" | "draft";

export const STATUS: Record<StatusKey, { label: string; tone: BadgeProps["tone"] }> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending: { label: "Pendiente", tone: "neutral" },
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
  return doc.status;
}

export function documentTotals(doc: Pick<SalesDocument, "lines" | "withholding">): InvoiceTotals {
  return invoiceTotals(doc.lines, WITHHOLDING_RATES[doc.withholding]);
}

const clientsById = new Map(clients.map((c) => [c.id, c]));

export function clientOf(doc: SalesDocument) {
  return clientsById.get(doc.clientId) ?? { id: doc.clientId, name: "Cliente eliminado", taxId: "" };
}

const SERIES_PREFIX: Record<InvoiceSeries, string> = { normal: "", rectifying: "R-" };

export function nextNumber(kind: SalesKind, series: InvoiceSeries, year: number, docs: SalesDocument[]): string {
  const prefix = kind === "invoice" || kind === "draft" ? SERIES_PREFIX[series] : KINDS[kind].numberPrefix;
  const numbers = docs.filter((d) => d.number !== null).map((d) => d.number!);
  return nextDocumentNumber(prefix, year, numbers);
}

/** URL period key ("2026-T4") of the quarter a date falls in. */
export function periodKeyOf(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return periodKey({ year: year!, quarter: quarterOfMonth(month! - 1) });
}

export const SERIES_OPTIONS: { value: InvoiceSeries; label: string }[] = [
  { value: "normal", label: "Facturas normales" },
  { value: "rectifying", label: "Facturas rectificativas" },
];

export const INCOME_TYPES: { value: IncomeType; label: string }[] = [
  { value: "705", label: "705 · Prestación de servicios" },
  { value: "700", label: "700 · Venta de mercaderías" },
  { value: "759", label: "759 · Ingresos por servicios diversos" },
  { value: "740", label: "740 · Subvenciones a la explotación" },
];

export const WITHHOLDING_OPTIONS: { value: WithholdingKind; label: string }[] = [
  { value: "none", label: "Sin retención" },
  { value: "professional", label: "15 % · Profesionales" },
  { value: "newProfessional", label: "7 % · Profesionales en inicio de actividad" },
  { value: "rental", label: "19 % · Alquileres o capital mobiliario" },
  { value: "imageRights", label: "24 % · Derechos de imagen" },
  { value: "modules", label: "1 % · Módulos" },
  { value: "farming", label: "2 % · Actividades agrícolas y ganaderas" },
];

export const OPERATION_TYPES: { value: OperationType; label: string; hint: string }[] = [
  { value: "national", label: "Nacional", hint: "El cliente tiene su domicilio fiscal en España." },
  {
    value: "exempt",
    label: "Nacional exenta",
    hint: "Actividades exentas de IVA: sanidad, enseñanza reglada, seguros…",
  },
  { value: "notSubject", label: "Nacional no sujeta", hint: "Operaciones fuera del ámbito del IVA." },
  {
    value: "reverseCharge",
    label: "Inversión del sujeto pasivo",
    hint: "El cliente declara el IVA: obras, chatarra, servicios importados…",
  },
  {
    value: "intraEu",
    label: "Intracomunitaria",
    hint: "Empresa o autónomo de otro país de la UE, dado de alta en el VIES.",
  },
  { value: "export", label: "Exportación", hint: "Fuera de la UE, Canarias, Ceuta o Melilla." },
];

import { addDays, type InvoiceLine, type OperationType, type WithholdingKind } from "@fiscalia/core";

/** Sample sales documents until there is a backend. Clients and figures are made up. */

export interface Client {
  id: string;
  name: string;
  /** NIF, or VAT number for EU clients. */
  taxId: string;
}

export const clients: Client[] = [
  { id: "c1", name: "Estudio Norte S.L.", taxId: "B12345674" },
  { id: "c2", name: "Agencia Brisa S.L.", taxId: "B87654321" },
  { id: "c3", name: "Talleres Ruiz S.C.", taxId: "J11223344" },
  { id: "c4", name: "Lumen Software S.A.", taxId: "A55667788" },
  { id: "c5", name: "Marta Gil Oliva", taxId: "12345678Z" },
  { id: "c6", name: "Nordlicht GmbH", taxId: "DE123456789" },
];

export type SalesKind = "invoice" | "draft" | "quote" | "deliveryNote";

/**
 * Stored status. Invoices are pending or paid ("overdue" is derived from the
 * due date); quotes and delivery notes follow their own workflow.
 */
export type SalesStatus = "pending" | "paid" | "created" | "sent" | "accepted" | "rejected" | "invoiced";

export type InvoiceSeries = "normal" | "rectifying";

/** Income account in the Spanish chart of accounts (PGC). */
export type IncomeType = "705" | "700" | "759" | "740";

export interface SalesLine extends InvoiceLine {
  id: string;
  concept: string;
}

export interface SalesDocument {
  id: string;
  kind: SalesKind;
  /** Drafts get their number when they are issued. */
  number: string | null;
  series: InvoiceSeries;
  clientId: string;
  /** ISO date (YYYY-MM-DD). */
  issuedOn: string;
  /** Due date for invoices; "valid until" for quotes. */
  dueOn: string | null;
  incomeType: IncomeType;
  withholding: WithholdingKind;
  operationType: OperationType;
  /** Date of the supply when it differs from the issue date. */
  operationOn: string | null;
  /** VAT cash accounting (criterio de caja). */
  cashBasis: boolean;
  /** Property rental, reported in form 115/180. */
  rental: boolean;
  lines: SalesLine[];
  status: SalesStatus;
  /** Printed on the document. */
  publicNotes: string;
  /** Only visible in Fiscalia. */
  privateNotes: string;
}

let lineSeq = 0;
const ln = (concept: string, unitPrice: number, quantity = 1, vatRate = 0.21, discount = 0): SalesLine => ({
  id: `l${++lineSeq}`,
  concept,
  unitPrice,
  quantity,
  discount,
  vatRate,
});

function doc(
  kind: SalesKind,
  number: string | null,
  clientId: string,
  issuedOn: string,
  lines: SalesLine[],
  status: SalesStatus,
  extra: Partial<SalesDocument> = {},
): SalesDocument {
  return {
    id: `${kind}-${number ?? issuedOn}-${lineSeq}`,
    kind,
    number,
    series: "normal",
    clientId,
    issuedOn,
    dueOn: addDays(issuedOn, 30),
    incomeType: "705",
    withholding: "professional",
    operationType: "national",
    operationOn: null,
    cashBasis: false,
    rental: false,
    lines,
    status,
    publicNotes: "",
    privateNotes: "",
    ...extra,
  };
}

const retainer = (month: string) => ln(`Diseño y mantenimiento web · ${month}`, 2_400);
const intl = { withholding: "none", operationType: "intraEu" } as const;

const invoices: SalesDocument[] = [
  doc(
    "invoice",
    "2026-0047",
    "c1",
    "2026-10-02",
    [retainer("octubre 2026"), ln("Horas de consultoría", 65, 12)],
    "pending",
  ),
  doc("invoice", "2026-0046", "c2", "2026-09-28", [ln("Campaña de lanzamiento: diseño de piezas", 1_750)], "pending"),
  doc("invoice", "2026-0045", "c3", "2026-09-10", [ln("Rediseño de catálogo", 875, 1, 0.21, 0.1)], "pending"),
  doc("invoice", "2026-0044", "c6", "2026-09-04", [ln("UX audit · mobile app", 3_200, 1, 0)], "paid", intl),
  doc(
    "invoice",
    "2026-0043",
    "c1",
    "2026-09-01",
    [retainer("septiembre 2026"), ln("Horas de consultoría", 65, 20)],
    "paid",
  ),
  doc("invoice", "2026-0042", "c4", "2026-08-21", [ln("Desarrollo de landing page", 1_900)], "paid"),
  doc("invoice", "2026-0041", "c1", "2026-08-03", [retainer("agosto 2026")], "paid"),
  doc(
    "invoice",
    "2026-0040",
    "c5",
    "2026-07-24",
    [ln("Identidad visual para cafetería", 850), ln("Impresión de cartas", 1.2, 250, 0.21)],
    "paid",
    { withholding: "none" },
  ),
  doc("invoice", "2026-0039", "c2", "2026-07-15", [ln("Banners para redes sociales", 95, 14)], "paid"),
  doc("invoice", "2026-0038", "c1", "2026-07-01", [retainer("julio 2026"), ln("Horas de consultoría", 65, 28)], "paid"),
  doc("invoice", "2026-0037", "c4", "2026-06-26", [ln("Desarrollo de panel de administración", 3_800)], "paid"),
  doc("invoice", "2026-0036", "c1", "2026-06-02", [retainer("junio 2026")], "paid"),
  doc("invoice", "2026-0035", "c3", "2026-05-19", [ln("Fotografía de producto", 45, 40)], "paid"),
  doc("invoice", "2026-0034", "c1", "2026-05-04", [retainer("mayo 2026"), ln("Horas de consultoría", 65, 16)], "paid"),
  doc("invoice", "2026-0033", "c6", "2026-04-22", [ln("Design system workshop", 1_800, 1, 0)], "paid", intl),
  doc("invoice", "2026-0032", "c1", "2026-04-01", [retainer("abril 2026")], "paid"),
  doc("invoice", "2026-0031", "c2", "2026-03-18", [ln("Vídeo corporativo: edición", 2_150)], "paid"),
  doc("invoice", "2026-0030", "c1", "2026-03-02", [retainer("marzo 2026"), ln("Horas de consultoría", 65, 18)], "paid"),
  doc("invoice", "2026-0029", "c4", "2026-02-12", [ln("Prototipo de aplicación", 2_500)], "paid"),
  doc("invoice", "2026-0028", "c1", "2026-02-02", [retainer("febrero 2026")], "paid"),
  doc("invoice", "2026-0027", "c3", "2026-01-20", [ln("Señalética del taller", 1_150)], "paid"),
  doc("invoice", "2026-0026", "c1", "2026-01-02", [retainer("enero 2026"), ln("Horas de consultoría", 65, 10)], "paid"),
  doc("invoice", "R-2026-0001", "c3", "2026-05-27", [ln("Abono parcial · factura 2026-0035", 45, -4)], "paid", {
    series: "rectifying",
  }),
  doc(
    "invoice",
    "2025-0024",
    "c1",
    "2025-12-01",
    [retainer("diciembre 2025"), ln("Horas de consultoría", 65, 22)],
    "paid",
  ),
  doc("invoice", "2025-0023", "c4", "2025-11-14", [ln("Mantenimiento anual de servidores", 1_600)], "paid"),
  doc("invoice", "2025-0022", "c1", "2025-11-03", [retainer("noviembre 2025")], "paid"),
  doc(
    "invoice",
    "2025-0021",
    "c1",
    "2025-10-01",
    [retainer("octubre 2025"), ln("Horas de consultoría", 65, 14)],
    "paid",
  ),
];

const drafts: SalesDocument[] = [
  doc(
    "draft",
    null,
    "c4",
    "2026-10-13",
    [ln("Integración con pasarela de pago", 2_200), ln("Pruebas y puesta en producción", 65, 8)],
    "pending",
    { dueOn: null },
  ),
  doc("draft", null, "c2", "2026-10-09", [ln("Rediseño de newsletter", 480)], "pending"),
];

const quotes: SalesDocument[] = [
  doc(
    "quote",
    "P-2026-0009",
    "c4",
    "2026-10-08",
    [ln("Aplicación móvil · fase 1", 9_500), ln("Soporte post-lanzamiento (horas)", 60, 20)],
    "sent",
    { dueOn: "2026-11-07" },
  ),
  doc("quote", "P-2026-0008", "c2", "2026-09-24", [ln("Campaña navideña: piezas gráficas", 1_400)], "accepted", {
    dueOn: "2026-10-24",
  }),
  doc("quote", "P-2026-0007", "c5", "2026-09-12", [ln("Web para cafetería", 1_250)], "rejected", {
    withholding: "none",
    dueOn: "2026-10-12",
  }),
  doc("quote", "P-2026-0006", "c3", "2026-08-30", [ln("Rediseño de catálogo", 875, 1, 0.21, 0.1)], "invoiced", {
    dueOn: "2026-09-29",
  }),
  doc("quote", "P-2026-0005", "c6", "2026-08-18", [ln("UX audit · mobile app", 3_200, 1, 0)], "invoiced", {
    ...intl,
    dueOn: "2026-09-17",
  }),
  doc("quote", "P-2026-0004", "c1", "2026-07-10", [ln("Migración de web a nuevo CMS", 3_600)], "created", {
    dueOn: "2026-08-09",
  }),
];

const deliveryNotes: SalesDocument[] = [
  doc(
    "deliveryNote",
    "A-2026-0004",
    "c5",
    "2026-10-06",
    [ln("Cartas impresas", 1.2, 250), ln("Tarjetas de visita", 0.18, 500)],
    "created",
    { withholding: "none" },
  ),
  doc("deliveryNote", "A-2026-0003", "c3", "2026-09-08", [ln("Catálogos impresos", 3.5, 300)], "invoiced"),
  doc(
    "deliveryNote",
    "A-2026-0002",
    "c3",
    "2026-05-15",
    [ln("Fotografías de producto en alta resolución", 45, 40)],
    "invoiced",
  ),
  doc("deliveryNote", "A-2026-0001", "c5", "2026-03-04", [ln("Rótulo de escaparate", 320)], "accepted", {
    withholding: "none",
  }),
];

export const initialSalesDocuments: SalesDocument[] = [...invoices, ...drafts, ...quotes, ...deliveryNotes];

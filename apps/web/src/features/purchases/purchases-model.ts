import {
  ASSET_CATEGORIES,
  WITHHOLDING_RATES,
  amortizableValue,
  amountOutstanding,
  cents,
  deductibleAmounts,
  invoiceTotals,
  isOverdue,
  paymentStatus,
  type AmortizationMethod,
  type AmortizedAsset,
  type AssetCategory,
  type AssetCondition,
  type Cents,
  type DeductibleAmounts,
  type InvoiceTotals,
  type PurchaseOperationType,
} from "@cuentalibre/core";
import type { Contact, ExpenseType, PurchaseInvoice } from "@cuentalibre/contracts";
import type { BadgeProps } from "@cuentalibre/ui/components/badge";
import { contactsStore } from "@/features/contacts/contacts-store";
import type { OptionGroup } from "@/features/sales/sales-model";

export const PURCHASES_PATH = "/compras/facturas";
export const NEW_PURCHASE_PATH = "/compras/facturas/nueva";
export const ASSETS_PATH = "/compras/bienes-de-inversion";
export const NEW_ASSET_PATH = "/compras/bienes-de-inversion/nuevo";

/** Edit form of a received invoice, or of an investment good. */
export const purchasePath = (doc: Pick<PurchaseInvoice, "id" | "asset">) =>
  `${doc.asset ? ASSETS_PATH : PURCHASES_PATH}/${doc.id}`;

/** What the list shows: the payment status, with "overdue" derived from the due date. */
export type PurchaseStatus = "pending" | "partial" | "paid" | "overdue";

export const PURCHASE_STATUS: Record<PurchaseStatus, { label: string; tone: BadgeProps["tone"]; hint: string }> = {
  pending: { label: "Pendiente", tone: "primary", hint: "Sin pagos registrados." },
  partial: { label: "Pago parcial", tone: "warning", hint: "Se ha pagado una parte del total." },
  paid: { label: "Pagada", tone: "success", hint: "Los pagos cubren el total de la factura." },
  overdue: { label: "Vencida", tone: "danger", hint: "Ha pasado el vencimiento y no está pagada del todo." },
};

export const PURCHASE_STATUS_ORDER: PurchaseStatus[] = ["pending", "partial", "overdue", "paid"];

export function purchaseTotals(doc: Pick<PurchaseInvoice, "lines" | "withholding">): InvoiceTotals {
  return invoiceTotals(doc.lines, WITHHOLDING_RATES[doc.withholding]);
}

export function purchaseStatus(doc: PurchaseInvoice, today: Date): PurchaseStatus {
  const { total } = purchaseTotals(doc);
  const status = paymentStatus(
    total,
    doc.payments.map((p) => p.amount),
  );
  if (status !== "paid" && isOverdue(doc.dueOn, false, today)) return "overdue";
  return status;
}

export function outstanding(doc: PurchaseInvoice): Cents {
  return amountOutstanding(
    purchaseTotals(doc).total,
    doc.payments.map((p) => p.amount),
  );
}

/**
 * Deductible base and VAT after the imputation percentages. An investment good's VAT is
 * deducted at once, but its base is no expense: it counts through its amortization.
 */
export function deductible(doc: PurchaseInvoice): DeductibleAmounts {
  const amounts = deductibleAmounts(purchaseTotals(doc), doc.imputation, doc.vatImputation);
  return doc.asset ? { ...amounts, base: cents(0) } : amounts;
}

export const isAsset = (doc: Pick<PurchaseInvoice, "asset">) => Boolean(doc.asset);

/** Date an investment good starts being used: the operation date, or the invoice's. */
export const assetStartsOn = (doc: Pick<PurchaseInvoice, "operationOn" | "issuedOn">) =>
  doc.operationOn ?? doc.issuedOn;

/** The amortization inputs of an investment good. Only call it on invoices with `asset`. */
export function assetOf(doc: PurchaseInvoice): AmortizedAsset {
  const totals = purchaseTotals(doc);
  return {
    value: amortizableValue(totals.base, totals.vat, doc.imputation, doc.vatImputation),
    startsOn: assetStartsOn(doc),
    plan: doc.asset!,
  };
}

/** Labels of the simplified amortization table, in its order. */
export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  buildings: "Edificios y otras construcciones",
  installations: "Instalaciones, mobiliario y enseres",
  machinery: "Maquinaria",
  transport: "Elementos de transporte",
  itEquipment: "Equipos para el tratamiento de la información y sistemas y programas informáticos",
  software: "Sistemas y programas de información",
  tools: "Útiles y herramientas",
  cattle: "Ganado vacuno, porcino y ovino",
  horses: "Ganado equino, frutales no cítricos",
  citrus: "Frutales cítricos, viñedos",
  olives: "Olivar",
  research: "Gastos de investigación",
  development: "Desarrollo",
  concessions: "Concesiones administrativas",
  industrialProperty: "Propiedad industrial",
  goodwill: "Fondo de comercio",
  leaseRights: "Derechos de traspaso",
};

export const ASSET_CATEGORY_ORDER = Object.keys(ASSET_CATEGORIES) as AssetCategory[];

export const ASSET_CONDITIONS: { value: AssetCondition; label: string; hint: string }[] = [
  { value: "new", label: "Nuevo", hint: "Se amortiza con los coeficientes de la tabla." },
  {
    value: "used",
    label: "Segunda mano",
    hint: "Puedes aplicar hasta el doble del coeficiente máximo de la tabla.",
  },
  {
    value: "accelerated",
    label: "Amortización acelerada",
    hint: "Para empresas de reducida dimensión: hasta el doble del coeficiente máximo.",
  },
  {
    value: "lowValue",
    label: "Bienes de escaso valor",
    hint: "Elementos de hasta 300 € cada uno (25.000 € al año): se amortizan del todo el año de compra.",
  },
  {
    value: "free",
    label: "Libertad de amortización",
    hint: "Casos que permite la ley (I+D, creación de empleo…): se amortiza del todo el año de compra.",
  },
];

export const AMORTIZATION_METHODS: { value: AmortizationMethod; label: string }[] = [
  { value: "rate", label: "Por coeficiente (valor de amortización anual)" },
  { value: "years", label: "Por período (número de años)" },
];

export function supplierOf(doc: Pick<PurchaseInvoice, "supplierId">): Contact {
  return (
    contactsStore.get("supplier", doc.supplierId) ?? { id: doc.supplierId, name: "Proveedor eliminado", taxId: "" }
  );
}

/** Accounts of group 6 of the PGC, under their subgroup. */
export const EXPENSE_TYPE_GROUPS: OptionGroup<ExpenseType>[] = [
  {
    label: "60. Compras",
    options: [
      { value: "600", label: "600. Compras de mercaderías (materiales)" },
      { value: "602", label: "602. Otros aprovisionamientos" },
      { value: "607", label: "607. Trabajos realizados por otras empresas (no profesionales independientes)" },
    ],
  },
  {
    label: "62. Servicios exteriores",
    options: [
      { value: "621", label: "621. Arrendamientos y cánones (alquileres)" },
      { value: "622", label: "622. Reparaciones y conservación" },
      { value: "623", label: "623. Servicios de profesionales independientes" },
      {
        value: "6231",
        label: "6231. Servicios de profesionales sin alta en actividad económica (cursos, conferencias…)",
      },
      { value: "624", label: "624. Transportes (gasolina, abono de transporte…)" },
      { value: "625", label: "625. Primas de seguros" },
      { value: "626", label: "626. Servicios bancarios y similares (comisiones TPV, transferencias…)" },
      { value: "627", label: "627. Publicidad, propaganda y relaciones públicas (comidas de empresa…)" },
      { value: "628", label: "628. Suministros (agua, luz, gas)" },
      { value: "629", label: "629. Otros servicios" },
      { value: "6291", label: "6291. Comunicaciones (internet, móvil…)" },
      { value: "6292", label: "6292. Viajes, estancias y desplazamientos" },
      { value: "6293", label: "6293. Material de oficina" },
      { value: "6294", label: "6294. Material informático" },
      { value: "6295", label: "6295. Gastos de manutención del autónomo pagados electrónicamente" },
      { value: "6297", label: "6297. Afiliaciones (colegios profesionales, revistas y suscripciones)" },
    ],
  },
  { label: "63. Tributos", options: [{ value: "631", label: "631. Otros tributos (IBI, tasa de basuras…)" }] },
  {
    label: "64. Gastos de personal",
    options: [
      { value: "640", label: "640. Sueldos y salarios (de los empleados)" },
      { value: "641", label: "641. Indemnizaciones" },
      { value: "642", label: "642. Seguridad Social a cargo de la empresa" },
      { value: "6421", label: "6421. Seguridad Social de los empleados" },
      { value: "6422", label: "6422. Seguridad Social del titular (y aportaciones a mutualidades)" },
      { value: "649", label: "649. Otros gastos sociales" },
    ],
  },
  {
    label: "66. Gastos financieros",
    options: [
      { value: "660", label: "660. Gastos financieros (intereses y comisiones de préstamos)" },
      { value: "662", label: "662. Intereses de deudas a largo plazo" },
      { value: "663", label: "663. Intereses de deudas a corto plazo" },
    ],
  },
  {
    label: "68. Dotaciones para amortizaciones",
    options: [
      { value: "680", label: "680. Amortización del inmovilizado intangible" },
      { value: "681", label: "681. Amortización del inmovilizado material" },
      { value: "682", label: "682. Amortización de las inversiones inmobiliarias" },
    ],
  },
];

const EXPENSE_TYPE_LABELS = new Map(EXPENSE_TYPE_GROUPS.flatMap((g) => g.options.map((o) => [o.value, o.label])));

/** "6291. Comunicaciones (internet, móvil…)" */
export const expenseTypeLabel = (type: ExpenseType) => EXPENSE_TYPE_LABELS.get(type) ?? type;

/** "Comunicaciones", without the account number or the examples. */
export const expenseTypeShortLabel = (type: ExpenseType) =>
  expenseTypeLabel(type)
    .replace(/^\d+\.\s*/, "")
    .replace(/\s*\(.*\)$/, "");

export const PURCHASE_OPERATION_TYPES: { value: PurchaseOperationType; label: string; hint: string }[] = [
  { value: "national", label: "Nacional", hint: "Si el proveedor tiene el domicilio social en España." },
  {
    value: "exempt",
    label: "Nacional exenta",
    hint: "Si la actividad del proveedor está exenta de IVA: medicina, enseñanza reglada, seguros, etc.",
  },
  { value: "notSubject", label: "Nacional no sujeta", hint: "Si la operación no está sujeta a IVA." },
  {
    value: "reverseCharge",
    label: "Inversión del sujeto pasivo",
    hint: "El proveedor factura sin IVA y lo autorrepercutes tú: servicios de fuera de España, ejecuciones de obra, chatarra…",
  },
  {
    value: "intraEu",
    label: "Intracomunitaria",
    hint: "Si el proveedor está inscrito en el VIES y tiene domicilio fiscal en otro país de la UE.",
  },
  {
    value: "import",
    label: "Importación",
    hint: "Si el proveedor está en Canarias, Ceuta, Melilla o fuera de la UE. El IVA se paga en aduana con el DUA.",
  },
];

/** The expense type last used with a supplier, to prefill the next invoice. */
export function lastExpenseType(supplierId: string, invoices: PurchaseInvoice[]): ExpenseType | null {
  const latest = invoices
    .filter((d) => d.supplierId === supplierId)
    .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))[0];
  return latest?.expenseType ?? null;
}

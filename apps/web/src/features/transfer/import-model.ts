import {
  WITHHOLDING_RATES,
  cents,
  centsToEuros,
  eurosToCents,
  groupRows,
  invoiceTotals,
  isDuplicateExpense,
  isDuplicatePurchase,
  isValidImputation,
  normalizeTaxId,
  operationChargesVat,
  parseAmount,
  parseDate,
  parsePercent,
  purchaseCarriesVat,
  sumBy,
  surchargeRateFromPercent,
  vatRateFromPercent,
  withholdingFromPercent,
  type Cents,
  type OperationType,
  type Period,
  type PurchaseOperationType,
  type WithholdingKind,
} from "@fiscalia/core";
import { contactsStore } from "@/features/contacts/contacts-store";
import { EXPENSES_PATH, expenseIdentity } from "@/features/purchases/expenses-model";
import { expensesStore } from "@/features/purchases/expenses-store";
import { EXPENSE_TYPE_GROUPS, PURCHASES_PATH, PURCHASE_OPERATION_TYPES } from "@/features/purchases/purchases-model";
import { purchasesStore } from "@/features/purchases/purchases-store";
import { INCOME_TYPE_GROUPS, KINDS, OPERATION_TYPES, documentTotals } from "@/features/sales/sales-model";
import { salesStore } from "@/features/sales/sales-store";
import { METHOD_TYPES, defaultPaymentMethodId } from "@/features/settings/settings-model";
import { settingsStore } from "@/features/settings/settings-store";
import type { Cell } from "@/lib/xlsx";
import type { Contact, ContactRole } from "@/mocks/contacts";
import type { Expense, OtherPayee } from "@/mocks/expenses";
import type { ExpenseType, Payment, PurchaseInvoice, PurchaseLine } from "@/mocks/purchases";
import type { IncomeType, SalesDocument, SalesLine } from "@/mocks/sales";

/*
 * Importing issued invoices, received invoices and expenses from a spreadsheet
 * with Contasimple's columns, so a file exported there (or its sample filled in
 * by hand) comes in as-is. Invoices take one row per concept: consecutive rows
 * with the same number belong to the same invoice.
 */

export type ImportKind = "sales" | "purchases" | "expenses";

const CONCEPT_COLUMNS = [
  "Concepto - Inicio servicio",
  "Concepto - Fin servicio",
  "Concepto - Descripción",
  "Concepto - Descripción detallada",
  "Concepto - Base imponible unitaria",
  "Concepto - Cantidad",
  "Concepto - % descuento",
  "Concepto - Total base imponible",
  "Concepto - % IVA",
  "Concepto - Cuota IVA",
  "Concepto - % RE",
  "Concepto - Cuota RE",
  "Concepto - % Retención",
  "Concepto - Cuota Retención",
];

const contactColumns = (who: "Cliente" | "Proveedor") =>
  [
    "NIF",
    "Nombre o Razón Social",
    "Dirección",
    "Cód. Postal",
    "Población",
    "Provincia",
    "País",
    "Telf",
    "Fax",
    "Email",
  ].map((c) => `${who} - ${c}`);

const paymentColumns = (prefix: "Cobro" | "Pago", noun: "cobro" | "pago") => [
  `${prefix} - Fecha`,
  `${prefix} - Importe`,
  `${prefix} - Método de ${noun}`,
  `${prefix} - Tipo de método de ${noun}`,
  `${prefix} - Número de cuenta o tarjeta`,
];

const SAMPLE_CONTACT = [
  "B00000000",
  "Nombre de empresa de ejemplo",
  "Calle de ejemplo",
  "08080",
  "Barcelona",
  "Barcelona",
  "España",
  "933333333",
  "",
  "email@ejemplo.com",
];

export interface ImportKindConfig {
  label: string;
  /** Value of ?tipo= that preselects it. */
  param: string;
  columns: string[];
  /** Columns a file must have to be read as this kind. */
  required: string[];
  sample: Cell[][];
  sampleName: string;
  listPath: string;
  listLabel: string;
  noun: [singular: string, plural: string];
}

export const IMPORT_KINDS: Record<ImportKind, ImportKindConfig> = {
  sales: {
    label: "Facturas emitidas",
    param: "emitidas",
    columns: [
      "Serie",
      "Número",
      "Período",
      "Número de factura que rectifica (sólo para facturas rectificativas)",
      "Fecha factura",
      "Fecha vencimiento",
      "Estado",
      "Tipo ingreso",
      "Notas privadas",
      "Notas en la factura",
      "Fecha operación",
      "Tipo operación",
      ...CONCEPT_COLUMNS,
      ...contactColumns("Cliente"),
      ...paymentColumns("Cobro", "cobro"),
    ],
    required: ["Número", "Fecha factura", "Concepto - Base imponible unitaria"],
    sample: [
      // prettier-ignore
      ["Facturas normales", "F-2026-0001", "2026-1T", "", "15/01/2026", "14/02/2026", "Cobrada", "705", "Anotaciones solo visibles por ti", "Texto impreso en la factura", "", "Nacional", "01/01/2026", "31/01/2026", "Diseño web", "Maquetación de la página de inicio", "1250", "2", "10", "2250", "21", "472,5", "", "", "15", "337,5", ...SAMPLE_CONTACT, "20/01/2026", "2385", "Ingreso/Transferencia", "Ingreso/Transferencia", ""],
      // prettier-ignore
      ["Facturas normales", "F-2026-0001", "", "", "", "", "", "", "", "", "", "", "", "", "Hosting anual", "", "100", "1", "0", "100", "21", "21", "", "", "15", "15", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ],
    sampleName: "plantilla-facturas-emitidas",
    listPath: KINDS.invoice.path,
    listLabel: "facturas emitidas",
    noun: ["factura", "facturas"],
  },
  purchases: {
    label: "Facturas recibidas",
    param: "recibidas",
    columns: [
      "Número",
      "Período",
      "Fecha factura",
      "Fecha vencimiento",
      "Estado",
      "Tipo de gasto",
      "% Imputación",
      "Imputación a IVA",
      "Número DUA/H7 (solo para facturas de importación)",
      "Notas privadas",
      "Notas en la factura",
      "Fecha operación",
      "Tipo operación",
      ...CONCEPT_COLUMNS,
      ...contactColumns("Proveedor"),
      ...paymentColumns("Pago", "pago"),
    ],
    required: ["Número", "Fecha factura", "Concepto - Base imponible unitaria"],
    sample: [
      // prettier-ignore
      ["FR-2026-0001", "2026-1T", "10/01/2026", "09/02/2026", "Pagada", "6294", "100", "", "", "Portátil de trabajo", "", "", "Nacional", "", "", "Ratón inalámbrico", "", "45", "2", "0", "90", "21", "18,9", "", "", "", "", ...SAMPLE_CONTACT, "12/01/2026", "108,9", "Tarjeta", "Tarjeta", ""],
    ],
    sampleName: "plantilla-facturas-recibidas",
    listPath: PURCHASES_PATH,
    listLabel: "facturas recibidas",
    noun: ["factura", "facturas"],
  },
  expenses: {
    label: "Gastos",
    param: "gastos",
    columns: [
      "Número recibo",
      "Período",
      "Fecha",
      "Importe",
      "% Imputación",
      "Tipo de gasto",
      "Concepto",
      "Notas privadas",
      "NIF",
      "Proveedor - Nombre o Razón Social",
      "Proveedor - Dirección",
      "Proveedor - Cód. Postal",
      "Proveedor - Población",
      "Proveedor - Provincia",
      "Proveedor - País",
      "Cliente - Teléfono",
      "Proveedor - Fax",
      "Proveedor - Email",
      "Método de pago",
      "Tipo de método de pago",
      "Número de cuenta o tarjeta",
    ],
    required: ["Fecha", "Importe", "Concepto"],
    sample: [
      // prettier-ignore
      ["123456", "2026-1T", "17/01/2026", "12,50", "100", "626", "Comisión de mantenimiento de la cuenta", "", "A28000115", "Banco de ejemplo S.A.", "", "", "", "", "España", "", "", "", "Cuenta principal", "Recibo bancario", ""],
    ],
    sampleName: "plantilla-gastos",
    listPath: EXPENSES_PATH,
    listLabel: "gastos",
    noun: ["gasto", "gastos"],
  },
};

/** Header text compared without accents, case or extra spaces. */
const norm = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Looks a cell up by column name in a row of the file. */
type Getter = (row: string[], column: string) => string;

function columnGetter(header: string[]): { get: Getter; has: (column: string) => boolean } {
  const index = new Map(header.map((h, i) => [norm(h), i] as const));
  // Contasimple's expense sample calls the phone column "Cliente - Teléfono"; accept either spelling
  const aliases: Record<string, string[]> = {
    [norm("Cliente - Teléfono")]: [norm("Proveedor - Teléfono"), norm("Proveedor - Telf")],
  };
  const find = (column: string) => {
    const key = norm(column);
    if (index.has(key)) return index.get(key)!;
    return (aliases[key] ?? []).map((a) => index.get(a)).find((i) => i !== undefined);
  };
  return {
    get: (row, column) => {
      const i = find(column);
      return i === undefined ? "" : (row[i] ?? "").trim();
    },
    has: (column) => find(column) !== undefined,
  };
}

/** One document of the file, ready to import when it has no errors. */
export interface ImportItem {
  /** Spreadsheet row numbers (1 is the header). */
  rows: number[];
  number: string;
  date: string;
  contactName: string;
  total: Cents;
  errors: string[];
  warnings: string[];
  /** Adds the document to its store. */
  commit: () => void;
}

export interface ImportPreview {
  kind: ImportKind;
  items: ImportItem[];
  /** Problems with the file itself (missing columns…). */
  fileErrors: string[];
  /** Contacts the file will create when imported. */
  newContacts: Contact[];
}

interface Context {
  isLocked: (isoDate: string) => Period | null;
}

const blank = (row: string[]) => row.every((c) => !c.trim());

/** Payment method by its name, or by its type ("Tarjeta"), or the default one. */
function paymentMethodFor(name: string, type: string, warnings: string[]): string {
  const methods = settingsStore.get().paymentMethods;
  const byName = methods.find((m) => norm(m.name) === norm(name));
  if (byName) return byName.id;
  const typeValue = METHOD_TYPES.find((t) => norm(t.label) === norm(type) || norm(t.label) === norm(name))?.value;
  const byType = typeValue && methods.find((m) => m.type === typeValue && m.active);
  if (byType) return byType.id;
  if (name || type) warnings.push(`No hay ningún método de pago llamado «${name || type}»: se usa el predeterminado.`);
  return defaultPaymentMethodId();
}

const INCOME_TYPES = new Set(INCOME_TYPE_GROUPS.flatMap((g) => g.options.map((o) => o.value)));
const EXPENSE_TYPES = new Set(EXPENSE_TYPE_GROUPS.flatMap((g) => g.options.map((o) => o.value)));

/** "705", "705. Prestación de servicios" or "Prestación de servicios" → the account code. */
function accountCode(text: string, labels: { value: string; label: string }[]): string | null {
  const code = /^(\d{3,4})\b/.exec(text.trim())?.[1];
  if (code) return labels.some((l) => l.value === code) ? code : null;
  const match = labels.find((l) => norm(l.label.replace(/^\d+\.\s*/, "").replace(/\s*\(.*\)$/, "")) === norm(text));
  return match?.value ?? null;
}

function operationFor<T extends string>(text: string, options: { value: T; label: string }[]): T | null {
  return options.find((o) => norm(o.label) === norm(text) || o.value === text)?.value ?? null;
}

/** "Pagada", "Cobrado", "Pagado"… */
const isPaidStatus = (text: string) => /^(pagad|cobrad)[oa]s?$/.test(norm(text));

/** Contacts found by tax ID, or by name when there is none; new ones are kept until the import. */
class ContactResolver {
  readonly created: Contact[] = [];
  constructor(private role: ContactRole) {}

  resolve(get: (column: string) => string, prefix: "Cliente" | "Proveedor"): Contact | null {
    const taxId = get(`${prefix} - NIF`) || (prefix === "Proveedor" ? get("NIF") : "");
    const name = get(`${prefix} - Nombre o Razón Social`);
    const pool = [...contactsStore.all(this.role), ...this.created];
    const found = taxId
      ? pool.find((c) => c.taxId && normalizeTaxId(c.taxId) === normalizeTaxId(taxId))
      : name
        ? pool.find((c) => norm(c.name) === norm(name))
        : undefined;
    if (found) return found;
    if (!name) return null;
    const contact: Contact = {
      id: crypto.randomUUID(),
      name,
      taxId: taxId.toUpperCase(),
      address: get(`${prefix} - Dirección`) || undefined,
      postalCode: get(`${prefix} - Cód. Postal`) || undefined,
      city: get(`${prefix} - Población`) || undefined,
      province: get(`${prefix} - Provincia`) || undefined,
      country: get(`${prefix} - País`) || undefined,
      phone: get(`${prefix} - Telf`) || get("Cliente - Teléfono") || undefined,
      fax: get(`${prefix} - Fax`) || undefined,
      email: get(`${prefix} - Email`) || undefined,
    };
    this.created.push(contact);
    return contact;
  }
}

interface ParsedLines {
  lines: SalesLine[];
  withholding: WithholdingKind;
}

/** Concepts of an invoice's rows. Withholding is per invoice here, so every concept must agree. */
function parseLines(
  rows: string[][],
  get: Getter,
  chargesVat: boolean,
  errors: string[],
  warnings: string[],
  rowNumbers: number[],
): ParsedLines {
  const lines: SalesLine[] = [];
  const withholdings = new Set<WithholdingKind>();
  rows.forEach((row, i) => {
    const at = `fila ${rowNumbers[i]}`;
    const concept = get(row, "Concepto - Descripción");
    const unit = get(row, "Concepto - Base imponible unitaria");
    // A row with no concept only carries a payment
    if (!concept && !unit) return;
    const unitPrice = parseAmount(unit);
    if (unitPrice === null) {
      errors.push(`Base imponible unitaria no válida en la ${at}.`);
      return;
    }
    const quantity = get(row, "Concepto - Cantidad") ? parseAmount(get(row, "Concepto - Cantidad")) : 1;
    if (quantity === null) errors.push(`Cantidad no válida en la ${at}.`);
    const discountText = get(row, "Concepto - % descuento");
    const discount = discountText ? parsePercent(discountText) : 0;
    if (discount === null || discount < 0 || discount > 100) errors.push(`Descuento no válido en la ${at}.`);
    const vatText = get(row, "Concepto - % IVA");
    const vatPercent = vatText ? parsePercent(vatText) : chargesVat ? 21 : 0;
    const vatRate = vatPercent === null ? null : vatRateFromPercent(vatPercent);
    if (vatRate === null) errors.push(`Tipo de IVA no válido en la ${at}: «${vatText}».`);
    const reText = get(row, "Concepto - % RE");
    const rePercent = reText ? parsePercent(reText) : 0;
    const surchargeRate = rePercent === null ? null : surchargeRateFromPercent(rePercent);
    if (surchargeRate === null) errors.push(`Recargo de equivalencia no válido en la ${at}.`);
    const whText = get(row, "Concepto - % Retención");
    const whPercent = whText ? parsePercent(whText) : 0;
    const withholding = whPercent === null ? null : withholdingFromPercent(whPercent);
    if (withholding === null) errors.push(`Retención no válida en la ${at}: «${whText}».`);
    else withholdings.add(withholding);
    const from = get(row, "Concepto - Inicio servicio");
    const to = get(row, "Concepto - Fin servicio");
    if (from && !parseDate(from)) errors.push(`Inicio de servicio no válido en la ${at}.`);
    if (to && !parseDate(to)) errors.push(`Fin de servicio no válido en la ${at}.`);
    const line: SalesLine = {
      id: crypto.randomUUID(),
      concept,
      detail: get(row, "Concepto - Descripción detallada") || undefined,
      serviceFrom: parseDate(from) ?? undefined,
      serviceTo: parseDate(to) ?? undefined,
      unitPrice: unitPrice,
      quantity: quantity ?? 1,
      discount: (discount ?? 0) / 100,
      vatRate: vatRate ?? 0,
      surchargeRate: surchargeRate || undefined,
    };
    const stated = parseAmount(get(row, "Concepto - Total base imponible"));
    const computed = invoiceTotals([line]).base;
    if (stated !== null && Math.abs(eurosToCents(stated) - computed) > 1)
      warnings.push(
        `En la ${at} la base total del archivo (${stated}) no cuadra con la calculada (${centsToEuros(computed)}).`,
      );
    lines.push(line);
  });
  if (lines.length === 0) errors.push("No tiene ningún concepto.");
  if (withholdings.size > 1)
    errors.push("Los conceptos tienen retenciones distintas; usa la misma en toda la factura.");
  return { lines, withholding: [...withholdings][0] ?? "none" };
}

function requiredDate(text: string, label: string, errors: string[]): string {
  if (!text) {
    errors.push(`Falta la ${label}.`);
    return "";
  }
  const iso = parseDate(text);
  if (!iso) errors.push(`${label[0]!.toUpperCase()}${label.slice(1)} no válida: «${text}».`);
  return iso ?? "";
}

function optionalDate(text: string, label: string, errors: string[]): string | null {
  if (!text) return null;
  const iso = parseDate(text);
  if (!iso) errors.push(`${label} no válida: «${text}».`);
  return iso;
}

function lockedError(date: string, ctx: Context, errors: string[]) {
  const locked = date ? ctx.isLocked(date) : null;
  if (locked) errors.push(`El ${locked.quarter}.º trimestre de ${locked.year} está cerrado.`);
}

function parseSales(body: { row: string[]; line: number }[], get: Getter, ctx: Context): ImportPreview {
  const contacts = new ContactResolver("client");
  const accepted: SalesDocument[] = [];
  const items = groupRows(body, (r) => `${get(r.row, "Serie")}|${get(r.row, "Número")}`.replace(/^\|$/, "")).map(
    (group): ImportItem => {
      const rows = group.map((g) => g.row);
      const first = rows[0]!;
      const at = (column: string) => get(first, column);
      const errors: string[] = [];
      const warnings: string[] = [];
      const number = at("Número");
      if (!number) errors.push("Falta el número de la factura.");
      const issuedOn = requiredDate(at("Fecha factura"), "fecha de la factura", errors);
      const dueOn = optionalDate(at("Fecha vencimiento"), "Fecha de vencimiento", errors);
      const operationOn = optionalDate(at("Fecha operación"), "Fecha de operación", errors);
      const rectifying = norm(at("Serie")).includes("rectificativa");
      const operationType: OperationType | null = at("Tipo operación")
        ? operationFor(at("Tipo operación"), OPERATION_TYPES)
        : "national";
      if (!operationType) errors.push(`Tipo de operación desconocido: «${at("Tipo operación")}».`);
      const incomeType = (
        at("Tipo ingreso")
          ? accountCode(
              at("Tipo ingreso"),
              INCOME_TYPE_GROUPS.flatMap((g) => g.options),
            )
          : "705"
      ) as IncomeType | null;
      if (!incomeType || !INCOME_TYPES.has(incomeType))
        errors.push(`Tipo de ingreso desconocido: «${at("Tipo ingreso")}».`);
      const client = contacts.resolve((c) => at(c), "Cliente");
      if (!client) errors.push("Falta el cliente: indica su NIF o su nombre.");
      const { lines, withholding } = parseLines(
        rows,
        get,
        operationChargesVat(operationType ?? "national"),
        errors,
        warnings,
        group.map((g) => g.line),
      );

      let rectifiesId: string | undefined;
      const rectifiesNumber = at("Número de factura que rectifica (sólo para facturas rectificativas)");
      if (rectifiesNumber) {
        rectifiesId = salesStore.all().find((d) => d.kind === "invoice" && d.number === rectifiesNumber)?.id;
        if (!rectifiesId) warnings.push(`No se encuentra la factura ${rectifiesNumber} que rectifica.`);
      }

      const year = issuedOn.slice(0, 4);
      const taken = (d: SalesDocument) =>
        d.kind === "invoice" && d.number === number && d.issuedOn.slice(0, 4) === year;
      if (number && issuedOn && salesStore.all().some(taken)) errors.push(`Ya existe la factura ${number} en ${year}.`);
      else if (number && issuedOn && accepted.some(taken))
        errors.push(`La factura ${number} está repetida en el archivo.`);
      lockedError(issuedOn, ctx, errors);

      // The last payment row gives the collection; invoices here hold a single one
      const paymentRow = [...rows].reverse().find((r) => get(r, "Cobro - Fecha"));
      const paidOn = paymentRow ? optionalDate(get(paymentRow, "Cobro - Fecha"), "Fecha de cobro", errors) : null;
      const paid = Boolean(paidOn) || isPaidStatus(at("Estado"));
      const paymentMethodId = paid
        ? paymentMethodFor(
            paymentRow ? get(paymentRow, "Cobro - Método de cobro") : "",
            paymentRow ? get(paymentRow, "Cobro - Tipo de método de cobro") : "",
            warnings,
          )
        : undefined;

      const doc: SalesDocument = {
        id: crypto.randomUUID(),
        kind: "invoice",
        number,
        series: rectifying ? "rectifying" : "normal",
        clientId: client?.id ?? "",
        issuedOn,
        dueOn,
        incomeType: incomeType ?? "705",
        withholding,
        operationType: operationType ?? "national",
        operationOn,
        cashBasis: false,
        rental: incomeType === "752",
        rectifiesId,
        lines,
        status: paid ? "paid" : "pending",
        paidOn: paid ? (paidOn ?? issuedOn) : undefined,
        paymentMethodId,
        publicNotes: at("Notas en la factura"),
        privateNotes: at("Notas privadas"),
      };
      if (errors.length === 0) accepted.push(doc);
      return {
        rows: group.map((g) => g.line),
        number,
        date: issuedOn,
        contactName: client?.name ?? "",
        total: errors.length ? cents(0) : documentTotals(doc).total,
        errors,
        warnings,
        commit: () => salesStore.add(doc),
      };
    },
  );
  return { kind: "sales", items, fileErrors: [], newContacts: contacts.created };
}

function parsePurchases(body: { row: string[]; line: number }[], get: Getter, ctx: Context): ImportPreview {
  const contacts = new ContactResolver("supplier");
  const accepted: PurchaseInvoice[] = [];
  const items = groupRows(body, (r) => get(r.row, "Número")).map((group): ImportItem => {
    const rows = group.map((g) => g.row);
    const first = rows[0]!;
    const at = (column: string) => get(first, column);
    const errors: string[] = [];
    const warnings: string[] = [];
    const number = at("Número");
    const issuedOn = requiredDate(at("Fecha factura"), "fecha de la factura", errors);
    const dueOn = optionalDate(at("Fecha vencimiento"), "Fecha de vencimiento", errors);
    const operationOn = optionalDate(at("Fecha operación"), "Fecha de operación", errors);
    const operationType: PurchaseOperationType | null = at("Tipo operación")
      ? operationFor(at("Tipo operación"), PURCHASE_OPERATION_TYPES)
      : "national";
    if (!operationType) errors.push(`Tipo de operación desconocido: «${at("Tipo operación")}».`);
    const expenseType = (
      at("Tipo de gasto")
        ? accountCode(
            at("Tipo de gasto"),
            EXPENSE_TYPE_GROUPS.flatMap((g) => g.options),
          )
        : "600"
    ) as ExpenseType | null;
    if (!expenseType || !EXPENSE_TYPES.has(expenseType))
      errors.push(`Tipo de gasto desconocido: «${at("Tipo de gasto")}».`);
    const imputation = at("% Imputación") ? parsePercent(at("% Imputación")) : 100;
    if (imputation === null || !isValidImputation(imputation))
      errors.push("La imputación debe ser un número entero entre 0 y 100.");
    const vatImputation = at("Imputación a IVA") ? parsePercent(at("Imputación a IVA")) : null;
    if (at("Imputación a IVA") && (vatImputation === null || !isValidImputation(vatImputation)))
      errors.push("La imputación a IVA debe ser un número entero entre 0 y 100.");
    const supplier = contacts.resolve((c) => at(c), "Proveedor");
    if (!supplier) errors.push("Falta el proveedor: indica su NIF o su nombre.");
    const { lines, withholding } = parseLines(
      rows,
      get,
      purchaseCarriesVat(operationType ?? "national"),
      errors,
      warnings,
      group.map((g) => g.line),
    );
    const totals = invoiceTotals(lines, WITHHOLDING_RATES[withholding]);

    if (supplier && number && issuedOn) {
      const candidate = { supplierId: supplier.id, number, issuedOn };
      if (isDuplicatePurchase(candidate, purchasesStore.all()))
        errors.push(`Ya has registrado la factura ${number} de este proveedor este año.`);
      else if (isDuplicatePurchase(candidate, accepted))
        errors.push(`La factura ${number} está repetida en el archivo.`);
    }
    if (!number) errors.push("Falta el número de la factura.");
    lockedError(issuedOn, ctx, errors);

    const payments: Payment[] = [];
    for (const row of rows) {
      const date = get(row, "Pago - Fecha");
      if (!date) continue;
      const iso = optionalDate(date, "Fecha de pago", errors);
      const amountText = get(row, "Pago - Importe");
      const amount = amountText ? parseAmount(amountText) : null;
      if (amountText && amount === null) errors.push(`Importe de pago no válido: «${amountText}».`);
      if (!iso) continue;
      payments.push({
        id: crypto.randomUUID(),
        date: iso,
        amount: amount === null ? cents(totals.total - sumBy(payments, (p) => p.amount)) : eurosToCents(amount),
        paymentMethodId: paymentMethodFor(
          get(row, "Pago - Método de pago"),
          get(row, "Pago - Tipo de método de pago"),
          warnings,
        ),
      });
    }
    if (payments.length === 0 && isPaidStatus(at("Estado")) && issuedOn)
      payments.push({
        id: crypto.randomUUID(),
        date: issuedOn,
        amount: totals.total,
        paymentMethodId: defaultPaymentMethodId(),
      });
    if (Math.abs(sumBy(payments, (p) => p.amount)) > Math.abs(totals.total))
      errors.push("Los pagos suman más que el total de la factura.");

    const notes = [at("Notas privadas"), at("Notas en la factura")].filter(Boolean).join(" · ");
    const doc: PurchaseInvoice = {
      id: crypto.randomUUID(),
      supplierId: supplier?.id ?? "",
      number,
      issuedOn,
      bookedOn: issuedOn,
      dueOn,
      expenseType: expenseType ?? "600",
      imputation: imputation ?? 100,
      vatImputation,
      withholding,
      operationType: operationType ?? "national",
      operationOn,
      customsDocument:
        operationType === "import" ? at("Número DUA/H7 (solo para facturas de importación)") || undefined : undefined,
      cashBasis: false,
      rental: expenseType === "621" && withholding === "rental",
      lines: lines as PurchaseLine[],
      payments,
      privateNotes: notes,
    };
    if (errors.length === 0) accepted.push(doc);
    return {
      rows: group.map((g) => g.line),
      number,
      date: issuedOn,
      contactName: supplier?.name ?? "",
      total: errors.length ? cents(0) : totals.total,
      errors,
      warnings,
      commit: () => purchasesStore.add(doc),
    };
  });
  return { kind: "purchases", items, fileErrors: [], newContacts: contacts.created };
}

function parseExpenses(body: { row: string[]; line: number }[], get: Getter, ctx: Context): ImportPreview {
  const accepted: Expense[] = [];
  const items = body.map(({ row, line }): ImportItem => {
    const at = (column: string) => get(row, column);
    const errors: string[] = [];
    const warnings: string[] = [];
    const date = requiredDate(at("Fecha"), "fecha", errors);
    const amount = parseAmount(at("Importe"));
    if (amount === null) errors.push(at("Importe") ? `Importe no válido: «${at("Importe")}».` : "Falta el importe.");
    const imputation = at("% Imputación") ? parsePercent(at("% Imputación")) : 100;
    if (imputation === null || !isValidImputation(imputation))
      errors.push("La imputación debe ser un número entero entre 0 y 100.");
    const expenseType = (
      at("Tipo de gasto")
        ? accountCode(
            at("Tipo de gasto"),
            EXPENSE_TYPE_GROUPS.flatMap((g) => g.options),
          )
        : "629"
    ) as ExpenseType | null;
    if (!expenseType || !EXPENSE_TYPES.has(expenseType))
      errors.push(`Tipo de gasto desconocido: «${at("Tipo de gasto")}».`);
    const concept = at("Concepto");
    if (!concept) errors.push("Falta el concepto.");
    lockedError(date, ctx, errors);

    // A saved supplier when the NIF matches; otherwise a one-off payee, as the expense form allows
    const taxId = at("NIF");
    const name = at("Proveedor - Nombre o Razón Social");
    const supplier = taxId
      ? contactsStore.all("supplier").find((c) => c.taxId && normalizeTaxId(c.taxId) === normalizeTaxId(taxId))
      : undefined;
    const otherPayee: OtherPayee | undefined =
      !supplier && (taxId || name) ? { name, taxId: taxId.toUpperCase() } : undefined;

    const methodName = at("Método de pago");
    const methodType = at("Tipo de método de pago");
    const expense: Expense = {
      id: crypto.randomUUID(),
      date,
      number: at("Número recibo"),
      concept,
      amount: eurosToCents(amount ?? 0),
      expenseType: expenseType ?? "629",
      imputation: imputation ?? 100,
      supplierId: supplier?.id ?? null,
      otherPayee,
      payment:
        methodName || methodType ? { date, paymentMethodId: paymentMethodFor(methodName, methodType, warnings) } : null,
      rental: false,
      privateNotes: at("Notas privadas"),
    };
    if (errors.length === 0) {
      const identity = expenseIdentity(expense);
      const known = [...expensesStore.all(), ...accepted].map(expenseIdentity);
      if (isDuplicateExpense({ ...identity, id: undefined }, known)) errors.push("Este gasto ya está registrado.");
      else accepted.push(expense);
    }
    return {
      rows: [line],
      number: expense.number,
      date,
      contactName: supplier?.name ?? name,
      total: errors.length ? cents(0) : expense.amount,
      errors,
      warnings,
      commit: () => expensesStore.add(expense),
    };
  });
  return { kind: "expenses", items, fileErrors: [], newContacts: [] };
}

/** Reads the rows of a file (header first) as documents of `kind`, with what's wrong with each. */
export function previewImport(kind: ImportKind, table: string[][], ctx: Context): ImportPreview {
  const headerIndex = table.findIndex((row) => !blank(row));
  const empty: ImportPreview = { kind, items: [], fileErrors: [], newContacts: [] };
  if (headerIndex < 0) return { ...empty, fileErrors: ["El archivo está vacío."] };
  const header = table[headerIndex]!;
  const { get, has } = columnGetter(header);
  const missing = IMPORT_KINDS[kind].required.filter((c) => !has(c));
  if (missing.length)
    return {
      ...empty,
      fileErrors: [
        `Faltan columnas: ${missing.map((c) => `«${c}»`).join(", ")}. Descarga la plantilla de ${IMPORT_KINDS[kind].label.toLowerCase()} para ver el formato.`,
      ],
    };
  const body = table
    .map((row, i) => ({ row, line: i + 1 }))
    .slice(headerIndex + 1)
    .filter((r) => !blank(r.row));
  if (body.length === 0) return { ...empty, fileErrors: ["El archivo no tiene filas debajo de la cabecera."] };
  if (kind === "sales") return parseSales(body, get, ctx);
  if (kind === "purchases") return parsePurchases(body, get, ctx);
  return parseExpenses(body, get, ctx);
}

/** Adds the valid documents, and the contacts they need, to the stores. Returns how many were imported. */
export function commitImport(preview: ImportPreview): number {
  const valid = preview.items.filter((i) => i.errors.length === 0);
  const role: ContactRole = preview.kind === "sales" ? "client" : "supplier";
  const used = new Set(valid.map((i) => i.contactName));
  for (const contact of preview.newContacts) if (used.has(contact.name)) contactsStore.add(role, contact);
  for (const item of valid) item.commit();
  return valid.length;
}

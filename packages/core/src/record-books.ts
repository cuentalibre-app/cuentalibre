import {
  accumulatedAmortization,
  amortizationBetween,
  yearlyRate,
  type AmortizedAsset,
  type AssetCategory,
  type AssetCondition,
} from "./assets";
import { COUNTRY_CODES, EU_VAT_PREFIXES, SPAIN, normalizeTaxId } from "./contacts";
import { filerTaxId, type AeatFiler } from "./aeat-files";
import { splitVatNumber } from "./informative-returns";
import { isInPeriod } from "./ledger";
import { cents, centsToEuros, roundHundredths, sumBy, type Cents } from "./money";
import { quarterOfMonth } from "./period";
import {
  expenseBox100,
  type RateAmounts,
  type TaxableExpense,
  type TaxablePurchase,
  type TaxableSale,
} from "./tax-returns";

/*
 * The income tax record books (libros registro del IRPF) in the AEAT's standard
 * format, which Renta WEB imports to fill section D1 of form 100: a workbook
 * with the sales and income book (INGRESOS), the purchases and expenses book
 * (GASTOS) and the investment goods book (BIENES-INVERSIÓN). Renta WEB only
 * reads the first two; the third completes the books.
 *
 * The entries are the same documents form 100 adds up, so the totals Renta WEB
 * computes agree with the page: income by the sales' bases, expenses by their
 * deductible part under the concept of their box, and amortizations as entries
 * without an invoice. VAT-only columns stay empty, as in books kept apart from
 * the VAT ones (type D).
 */

/** A date cell: the books want real dates, which the workbook shows as dd/mm/yyyy. */
export interface BookDate {
  date: string;
}

/** Amounts in euros, rates in percent. */
export type BookCell = string | number | BookDate | null;

export interface RecordBook {
  /** Sheet name, as the format requires it. */
  name: "INGRESOS" | "GASTOS" | "BIENES-INVERSIÓN";
  /** The three header rows of the AEAT's template. */
  header: string[][];
  rows: BookCell[][];
}

/** A client or supplier, as the books identify them. */
export interface BookParty {
  taxId: string;
  name: string;
  /** Spanish name of the country, as contacts store it; Spain when missing. */
  country?: string;
}

/** The activity every entry belongs to: one activity, as the returns assume. */
export interface BookActivity {
  /** Activity type of forms 036/037: A01…A05, B01…B06 or C. */
  type: string;
  /** IAE epígrafe ("763", "861.1"); empty outside the IAE. */
  code: string;
}

export interface IncomeEntry extends TaxableSale {
  number: string;
  /** Date of the operation, when it isn't the issue date. */
  operationOn?: string | null;
  client: BookParty | null;
  /** Withholding rate as a fraction. */
  withholdingRate: number;
}

export interface PurchaseEntry extends TaxablePurchase {
  /** The supplier's number. */
  number: string;
  issuedOn: string;
  operationOn?: string | null;
  supplier: BookParty | null;
  withholding: Cents;
  /** Withholding rate as a fraction. */
  withholdingRate: number;
}

/** An expense without an invoice, or the amortization of an investment good. */
export interface ExpenseEntry extends TaxableExpense {
  /** What was paid; the deductible part is `expense`. */
  amount: Cents;
  number: string;
  payee: BookParty | null;
}

export interface InvestmentEntry {
  /** The supplier's invoice number. */
  number: string;
  issuedOn: string;
  supplier: BookParty | null;
  description: string;
  /** Licence plate or cadastral reference. */
  identifier: string;
  /** Price paid, without the VAT. */
  acquisition: Cents;
  asset: AmortizedAsset;
}

export interface RecordBookEntries {
  sales: IncomeEntry[];
  purchases: PurchaseEntry[];
  expenses: ExpenseEntry[];
  investments: InvestmentEntry[];
}

/** Concept of each expense box of form 100 (the boxes of `EXPENSE_BOXES_100`). */
const EXPENSE_CONCEPTS: Record<string, string> = {
  "0181": "G01",
  "0182": "G02",
  "0183": "G03",
  "0184": "G04",
  "0185": "G05",
  "0186": "G45",
  "0187": "G07",
  "0188": "G08",
  "0189": "G09",
  "0190": "G10",
  "0191": "G11",
  "0192": "G12",
  "0193": "G13",
  "0194": "GY4",
  "0198": "G18",
  "0199": "G19",
  "0200": "G20",
  "0202": "G22",
  "0203": "G24",
  "0205": "G25",
  "0206": "G26",
  "0208": "GY8",
  "0227": "G38",
  "0214": "G34",
  "0215": "G35",
  "0216": "G36",
  "0217": "G37",
};

/** Accounts with a more precise concept than their box's, which still adds to the same box. */
const ACCOUNT_CONCEPTS: Record<string, string> = { "662": "G23" };

/** Concept of an expense account, so Renta WEB adds it to the same box as form 100. */
export function expenseConcept(account: string): string {
  return ACCOUNT_CONCEPTS[account] ?? EXPENSE_CONCEPTS[expenseBox100(account)]!;
}

/** Income concept: form 100 adds every sale to box 0171, operating income. */
const INCOME_CONCEPT = "I01";

/** Kind of good of the investment goods book. */
const ASSET_KINDS: Record<AssetCategory, string> = {
  buildings: "12",
  installations: "25",
  machinery: "21",
  transport: "22",
  itEquipment: "23",
  software: "33",
  tools: "28",
  cattle: "41",
  horses: "42",
  citrus: "43",
  olives: "44",
  research: "39",
  development: "39",
  concessions: "39",
  industrialProperty: "31",
  goodwill: "39",
  leaseRights: "32",
};

/** Amortization method: linear by the table, or the regime that lets it go faster. */
const AMORTIZATION_METHODS: Record<AssetCondition, string> = {
  new: "01",
  used: "08",
  accelerated: "07",
  lowValue: "06",
  free: "06",
};

/** Name the AEAT gives unidentified customers of simplified invoices. */
const FINAL_CONSUMER = "VENTAS A CONSUMIDOR FINAL";

const INCOME_HEADER = [
  ["Autoliquidación", "", "Actividad", "", "", "Tipo de Factura", "Concepto de\nIngreso", "Ingreso Computable", "Fecha\nExpedición", "Fecha\nOperación", "Identificación de la Factura", "", "", "NIF Destinatario", "", "", "Nombre\nDestinatario", "Clave de Operación", "Calificación de la Operación", "Operación\nExenta", "Total\nFactura", "Base\nImponible", "Tipo\nde IVA", "Cuota IVA\nRepercutida", "Tipo de\nRecargo Eq.", "Cuota Recargo Eq.", "Cobro (Operación Criterio de Caja de IVA y/o artículo 7.2.1º de Reglamento del IRPF)", "", "", "", "Tipo Retención\ndel IRPF", "Importe Retenido\ndel IRPF", "Registro Acuerdo Facturación", "Inmueble", "", "Referencia Externa"],
  ["Ejercicio", "Periodo", "Código", "Tipo", "Grupo o Epígrafe del IAE", "", "", "", "", "", "Serie", "Número", "Número-Final", "Tipo", "Código País", "Identificación", "", "", "", "", "", "", "", "", "", "", "Fecha", "Importe", "Medio Utilizado", "Identificación Medio Utilizado", "", "", "", "Situación", "Referencia Catastral", ""],
  ["Decimal (4,0)", "Alfanumérico (2)", "Alfanumérico (1)", "Alfanumérico (2)", "Alfanumérico (4)", "Alfanumérico (2)", "Alfanumérico (3)", "Decimal(12,2)", "Fecha(dd/mm/yyyy)", "Fecha(dd/mm/yyyy)", "Alfanumérico (20)", "Alfanumérico (20)", "Alfanumérico (20)", "Alfanumérico (2)", "Alfanumérico (2)", "Alfanumérico (20)", "Alfanumérico (40)", "Alfanumérico (2)", "Alfanumérico (2)", "Alfanumérico (2)", "Decimal(12,2)", "Decimal(12,2)", "Decimal(4,2)", "Decimal(12,2)", "Decimal(4,2)", "Decimal(12,2)", "Fecha(dd/mm/yyyy)", "Decimal(12,2)", "Alfanumérico (2)", "Alfanumérico (34)", "Decimal(4,2)", "Decimal(12,2)", "Alfanumérico (15)", "Alfanumérico (1)", "Alfanumérico (20)", "Alfanumérico (40)"],
]; // prettier-ignore

const EXPENSE_HEADER = [
  ["Autoliquidación", "", "Actividad", "", "", "Tipo de Factura", "Concepto de\nGasto", "Gasto Deducible", "Fecha\nExpedición", "Fecha\nOperación", "Identificación Factura del Expedidor", "", "Fecha\nRecepción", "Número\nRecepción", "Número\nRecepción Final", "NIF Expedidor", "", "", "Nombre\nExpedidor", "Clave de\nOperación", "Bien de Inversión", "Inversión del Sujeto Pasivo", "Deducible en Periodo Posterior", "Periodo Deducción", "", "Total\nFactura", "Base\nImponible", "Tipo\nde IVA", "Cuota IVA\nSoportado", "Cuota Deducible", "Tipo de\nRecargo Eq.", "Cuota\nRecargo Eq.", "Pago (Operación Criterio de Caja de IVA y/o artículo 7.2.1º de Reglamento del IRPF)", "", "", "", "Tipo Retención\ndel IRPF", "Importe Retenido\ndel IRPF", "Registro Acuerdo Facturación", "Inmueble", "", "Referencia Externa"],
  ["Ejercicio", "Periodo", "Código", "Tipo", "Grupo o Epígrafe del IAE", "", "", "", "", "", "(Serie-Número)", "Número-Final", "", "", "", "Tipo", "Código País", "Identificación", "", "", "", "", "", "Ejercicio", "Periodo", "", "", "", "", "", "", "", "Fecha", "Importe", "Medio Utilizado", "Identificación Medio Utilizado", "", "", "", "Situación", "Referencia Catastral", ""],
  ["Decimal (4,0)", "Alfanumérico (2)", "Alfanumérico (1)", "Alfanumérico (2)", "Alfanumérico (4)", "Alfanumérico (2)", "Alfanumérico (3)", "Decimal(12,2)", "Fecha(dd/mm/yyyy)", "Fecha(dd/mm/yyyy)", "Alfanumérico (40)", "Alfanumérico (20)", "Fecha(dd/mm/yyyy)", "Alfanumérico (20)", "Alfanumérico (20)", "Alfanumérico (2)", "Alfanumérico (2)", "Alfanumérico (20)", "Alfanumérico (40)", "Alfanumérico (2)", "Alfanumérico (1)", "Alfanumérico (1)", "Alfanumérico (1)", "Decimal (4,0)", "Alfanumérico (2)", "Decimal(12,2)", "Decimal(12,2)", "Decimal(4,2)", "Decimal(12,2)", "Decimal(12,2)", "Decimal(4,2)", "Decimal(12,2)", "Fecha(dd/mm/yyyy)", "Decimal(12,2)", "Alfanumérico (2)", "Alfanumérico (34)", "Decimal(4,2)", "Decimal(12,2)", "Alfanumérico (15)", "Alfanumérico (1)", "Alfanumérico (20)", "Alfanumérico (40)"],
]; // prettier-ignore

const INVESTMENT_HEADER = [
  ["Autoliquidación", "", "Actividad", "", "", "Tipo de Bien", "Descripción del Bien", "", "Fecha Inicio\nUtilización", "Valor Adquisición", "Valor\nAmortizable", "Método de\nAmortización", "Porcentaje de\nAmortización", "Amortización", "", "", "", "Fecha\nExpedición", "Identificación Factura del Expedidor", "", "Número\nRecepción", "Número\nRecepción Final", "NIF Expedidor", "", "", "Nombre\nExpedidor", "Año de Inicio Utilización", "", "", "", "Regularización Anual", "", "", "Baja del Bien", "", "Identificación de la Factura de Transmisión del Bien", "", "", "Registro Acuerdo Facturación", "Referencia Externa"],
  ["Ejercicio", "Periodo", "Código", "Tipo", "Grupo o Epígrafe del IAE", "", "Identificador", "Literal", "", "", "", "", "", "Acumulada al Inicio", "Cuota Resultante", "Acumulada al final", "Pendiente", "", "(Serie-Número)", "Número-Final", "", "", "Tipo", "Código País", "Identificación", "", "Base Imponible", "Tipo de IVA", "Prorrata Definitiva", "Cuota Deducible", "Prorrata Definitiva", "Cuota Deducible", "Cuota a Regularizar", "Fecha", "Causa", "Serie", "Número", "Número-Final", "", ""],
  ["Decimal (4,0)", "Alfanumérico (2)", "Alfanumérico (1)", "Alfanumérico (2)", "Alfanumérico (4)", "Alfanumérico (2)", "Alfanumérico (40)", "Alfanumérico (160)", "Fecha(dd/mm/yyyy)", "Decimal(12,2)", "Decimal(12,2)", "Alfanumérico (2)", "Decimal (4,2)", "Decimal(12,2)", "Decimal(12,2)", "Decimal(12,2)", "Decimal(12,2)", "Fecha(dd/mm/yyyy)", "Alfanumérico (40)", "Alfanumérico (20)", "Alfanumérico (20)", "Alfanumérico (20)", "Alfanumérico (2)", "Alfanumérico (2)", "Alfanumérico (20)", "Alfanumérico (40)", "Decimal(12,2)", "Decimal(4,2)", "Decimal(5,2)", "Decimal(12,2)", "Decimal(5,2)", "Decimal(12,2)", "Decimal(12,2)", "Fecha(dd/mm/yyyy)", "Alfanumérico (2)", "Alfanumérico (20)", "Alfanumérico (20)", "Alfanumérico (20)", "Alfanumérico (15)", "Alfanumérico (40)"],
]; // prettier-ignore

const eur = (amount: Cents) => centsToEuros(amount);
const percent = (fraction: number) => roundHundredths(fraction * 100);
const day = (isoDate: string | null | undefined): BookDate | null => (isoDate ? { date: isoDate } : null);
const quarterCode = (isoDate: string) => `${quarterOfMonth(Number(isoDate.slice(5, 7)) - 1)}T`;
const text = (value: string, length: number) => value.trim().slice(0, length);

/** Code, type and IAE group of the activity: "A", "05", "7631". */
function activityCells(activity: BookActivity): BookCell[] {
  const code = activity.type.slice(0, 1);
  const type = activity.type.slice(1, 3);
  return [code, type || null, activity.code.replace(/\D/g, "").slice(0, 4) || null];
}

/**
 * How the books identify a party: a Spanish NIF on its own; an EU VAT number with type 02;
 * anyone else by the tax ID of their country (04) and its ISO code.
 */
function partyCells(party: BookParty | null): [BookCell, BookCell, BookCell] {
  const country = party?.country || SPAIN;
  const taxId = normalizeTaxId(party?.taxId ?? "");
  if (!taxId) return [null, null, null];
  if (country === SPAIN) return [null, null, filerTaxId(taxId)];
  if (country in EU_VAT_PREFIXES) {
    const vat = splitVatNumber(taxId, country);
    return ["02", COUNTRY_CODES[country] ?? null, text(vat.code + vat.number, 20)];
  }
  return ["04", COUNTRY_CODES[country] ?? null, text(party!.taxId, 20)];
}

/**
 * Splits an amount over the lines of an invoice in proportion to their bases, so each line
 * carries its part and the lines add up to the amount. The last line takes the rounding.
 */
function spread(amount: Cents, lines: RateAmounts[]): Cents[] {
  const total = sumBy(lines, (l) => l.base);
  let left = amount;
  return lines.map((line, i) => {
    if (i === lines.length - 1) return left;
    const part = total === 0 ? cents(0) : cents((amount * line.base) / total);
    left = cents(left - part);
    return part;
  });
}

/** Lines of an invoice: one per VAT rate, or a single empty one when it has none. */
const linesOf = (rates: RateAmounts[]): RateAmounts[] =>
  rates.length ? rates : [{ rate: 0, base: cents(0), vat: cents(0) }];

const byDate = <T extends { date: string; number: string }>(entries: T[]) =>
  [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));

function incomeRows(sale: IncomeEntry, activity: BookCell[]): BookCell[][] {
  const identified = Boolean(normalizeTaxId(sale.client?.taxId ?? ""));
  const type = identified ? (sale.rectifying ? "R1" : "F1") : sale.rectifying ? "R5" : "F2";
  const [idType, country, id] = partyCells(sale.client);
  const name = identified ? text(sale.client!.name, 40) : FINAL_CONSUMER;
  const operationOn = sale.operationOn && sale.operationOn !== sale.date ? sale.operationOn : null;
  return linesOf(sale.vatBreakdown).map((line, i) => [
    Number(sale.date.slice(0, 4)),
    quarterCode(sale.date),
    ...activity,
    type,
    INCOME_CONCEPT,
    eur(line.base),
    day(sale.date),
    day(operationOn),
    null,
    text(sale.number, 20),
    null,
    idType,
    country,
    id,
    name,
    null,
    null,
    null,
    eur(cents(line.base + line.vat)),
    eur(line.base),
    percent(line.rate),
    eur(line.vat),
    null,
    null,
    null,
    null,
    null,
    null,
    // The withholding belongs to the invoice: only on its first line
    i === 0 && sale.withholding ? percent(sale.withholdingRate) : null,
    i === 0 && sale.withholding ? eur(sale.withholding) : null,
  ]);
}

function purchaseRows(purchase: PurchaseEntry, receipt: number, activity: BookCell[]): BookCell[][] {
  const identified = Boolean(normalizeTaxId(purchase.supplier?.taxId ?? ""));
  const type = purchase.creditNote ? (identified ? "R1" : "R5") : identified ? "F1" : "F2";
  const [idType, country, id] = partyCells(purchase.supplier);
  const lines = linesOf(purchase.vatBreakdown);
  const expenses = spread(purchase.expense, lines);
  const operationOn = purchase.operationOn && purchase.operationOn !== purchase.issuedOn ? purchase.operationOn : null;
  return lines.map((line, i) => [
    Number(purchase.date.slice(0, 4)),
    quarterCode(purchase.date),
    ...activity,
    type,
    // A purchase that isn't an expense, such as an investment good, carries no concept
    purchase.expense ? expenseConcept(purchase.account) : null,
    eur(expenses[i]!),
    day(purchase.issuedOn),
    day(operationOn),
    text(purchase.number, 40),
    null,
    null,
    String(receipt),
    null,
    idType,
    country,
    id,
    text(purchase.supplier?.name ?? "", 40) || null,
    null,
    null,
    null,
    null,
    null,
    null,
    eur(cents(line.base + line.vat)),
    eur(line.base),
    percent(line.rate),
    eur(line.vat),
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    i === 0 && purchase.withholding ? percent(purchase.withholdingRate) : null,
    i === 0 && purchase.withholding ? eur(purchase.withholding) : null,
  ]);
}

/** An entry without an invoice (SF): the amount paid as its base, without VAT. */
function expenseRow(expense: ExpenseEntry, receipt: number, activity: BookCell[]): BookCell[] {
  const [idType, country, id] = partyCells(expense.payee);
  return [
    Number(expense.date.slice(0, 4)),
    quarterCode(expense.date),
    ...activity,
    "SF",
    expense.expense ? expenseConcept(expense.account) : null,
    eur(expense.expense),
    day(expense.date),
    null,
    text(expense.number, 40) || null,
    null,
    null,
    String(receipt),
    null,
    idType,
    country,
    id,
    text(expense.payee?.name ?? "", 40) || null,
    null,
    null,
    null,
    null,
    null,
    null,
    eur(expense.amount),
    eur(expense.amount),
    0,
    0,
  ];
}

function investmentRow(entry: InvestmentEntry, year: number, activity: BookCell[]): BookCell[] {
  const { asset } = entry;
  const [idType, country, id] = partyCells(entry.supplier);
  const atStart = accumulatedAmortization(asset, `${year - 1}-12-31`);
  const atEnd = accumulatedAmortization(asset, `${year}-12-31`);
  return [
    year,
    "0A",
    ...activity,
    ASSET_KINDS[asset.plan.category],
    text(entry.identifier, 40) || null,
    text(entry.description, 160) || null,
    day(asset.startsOn),
    eur(entry.acquisition),
    eur(asset.value),
    AMORTIZATION_METHODS[asset.plan.condition],
    roundHundredths(yearlyRate(asset.plan)),
    eur(atStart),
    eur(amortizationBetween(asset, `${year}-01-01`, `${year}-12-31`)),
    eur(atEnd),
    eur(cents(asset.value - atEnd)),
    day(entry.issuedOn),
    text(entry.number, 40),
    null,
    null,
    null,
    idType,
    country,
    id,
    text(entry.supplier?.name ?? "", 40) || null,
  ];
}

/**
 * The year's record books. Income and expenses are the entries dated in the year; the
 * investment goods are those bought in it or still being amortized.
 */
export function recordBooks(entries: RecordBookEntries, year: number, activity: BookActivity): RecordBook[] {
  const inYear = (date: string) => isInPeriod(date, { year, quarter: null });
  const cells = activityCells(activity);

  const sales = byDate(entries.sales.filter((s) => inYear(s.date)));
  const purchases = byDate(entries.purchases.filter((p) => inYear(p.date)));
  const expenses = byDate(entries.expenses.filter((e) => inYear(e.date)));
  // Entries without an invoice are numbered apart from the invoices
  const expenseRows = [
    ...purchases.flatMap((p, i) => purchaseRows(p, i + 1, cells).map((row) => ({ date: p.date, row }))),
    ...expenses.map((e, i) => ({ date: e.date, row: expenseRow(e, i + 1, cells) })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const investments = entries.investments
    .filter(
      (e) =>
        e.asset.startsOn <= `${year}-12-31` &&
        (inYear(e.issuedOn) || amortizationBetween(e.asset, `${year}-01-01`, `${year}-12-31`) !== 0),
    )
    .sort((a, b) => a.asset.startsOn.localeCompare(b.asset.startsOn));

  return [
    { name: "INGRESOS", header: INCOME_HEADER, rows: sales.flatMap((s) => incomeRows(s, cells)) },
    { name: "GASTOS", header: EXPENSE_HEADER, rows: expenseRows.map((r) => r.row) },
    {
      name: "BIENES-INVERSIÓN",
      header: INVESTMENT_HEADER,
      rows: investments.map((e) => investmentRow(e, year, cells)),
    },
  ];
}

/**
 * Name the format gives the file: year, NIF, D (the income tax books) and the taxpayer's
 * name, "2026" "12345678Z" "D" "MARTIN GARCIA, LUCIA".
 */
export function recordBooksFileName(year: number, filer: AeatFiler): string {
  const name = [filer.surnames.trim().replace(/\s+/g, " "), filer.name.trim()].filter(Boolean).join(", ");
  return `${year}${filerTaxId(filer.taxId)}D${name.replace(/[\\/:*?"<>|]/g, "")}.xlsx`;
}

import {
  accumulatedAmortization,
  amortizationBetween,
  applyRate,
  cents,
  centsToEuros,
  formatSpanishDate,
  lineBase,
  quarterOfMonth,
  roundHundredths,
  sumBy,
  WITHHOLDING_RATES,
  yearlyRate,
  type Cents,
  type InvoiceLine,
} from "@fiscalia/core";
import type { Contact, Expense, PurchaseInvoice, SalesDocument, SalesLine } from "@fiscalia/contracts";
import { deductibleOf, EXPENSE_STATUS, expenseStatus, payeeOf } from "@/features/purchases/expenses-model";
import {
  ASSET_CATEGORY_LABELS,
  ASSET_CONDITIONS,
  PURCHASE_OPERATION_TYPES,
  PURCHASE_STATUS,
  assetOf,
  assetStartsOn,
  deductible,
  expenseTypeLabel,
  outstanding,
  purchaseStatus,
  purchaseTotals,
  supplierOf,
} from "@/features/purchases/purchases-model";
import {
  INCOME_TYPE_GROUPS,
  OPERATION_TYPES,
  STATUS,
  clientOf,
  displayStatus,
  documentTotals,
  seriesOf,
} from "@/features/sales/sales-model";
import { paymentMethodName } from "@/features/settings/settings-model";
import type { Cell, Sheet } from "@/lib/xlsx";

/*
 * Rows of every listing that can be exported: the official register books
 * (libros registro) of VAT and income tax, and the advanced export. Amounts
 * are numbers in euros, dates dd/mm/yyyy and rates whole percentages, as
 * Spanish spreadsheets and the tax office's book format expect.
 */

/** ISO range, both ends included. */
export interface DateRange {
  from: string;
  to: string;
}

const inRange = (isoDate: string, range: DateRange) => isoDate >= range.from && isoDate <= range.to;
const date = (isoDate: string | null | undefined): Cell => (isoDate ? formatSpanishDate(isoDate) : null);
const percent = (fraction: number) => roundHundredths(fraction * 100);
const eur = (amount: Cents): number => centsToEuros(amount);
/** Empty cell for a zero amount. */
const eurOrNull = (amount: Cents): number | null => (amount ? centsToEuros(amount) : null);
const quarterCode = (isoDate: string) => `${quarterOfMonth(Number(isoDate.slice(5, 7)) - 1)}T`;

const INCOME_TYPE_LABELS = new Map(INCOME_TYPE_GROUPS.flatMap((g) => g.options.map((o) => [o.value, o.label])));
const incomeTypeLabel = (type: string) => INCOME_TYPE_LABELS.get(type as never) ?? type;
const operationLabel = (type: string) => OPERATION_TYPES.find((o) => o.value === type)?.label ?? type;
const purchaseOperationLabel = (type: string) => PURCHASE_OPERATION_TYPES.find((o) => o.value === type)?.label ?? type;
const methodName = (id: string | undefined) => (id ? (paymentMethodName(id) ?? id) : null);

interface RateRow {
  rate: number;
  base: Cents;
  vat: Cents;
  surchargeRate: number;
  surcharge: Cents;
}

/** Base, VAT and surcharge per VAT rate, as the register books list an invoice: one row per rate. */
function byRate(lines: InvoiceLine[]): RateRow[] {
  const groups = new Map<number, InvoiceLine[]>();
  for (const line of lines) groups.set(line.vatRate, [...(groups.get(line.vatRate) ?? []), line]);
  const rows = [...groups]
    .sort(([a], [b]) => b - a)
    .map(([rate, group]) => {
      const base = sumBy(group, lineBase);
      const surcharge = cents(group.reduce((acc, l) => acc + lineBase(l) * (l.surchargeRate ?? 0), 0));
      return {
        rate,
        base,
        vat: applyRate(base, rate),
        surchargeRate: group.find((l) => l.surchargeRate)?.surchargeRate ?? 0,
        surcharge,
      };
    });
  return rows.length ? rows : [{ rate: 0, base: cents(0), vat: cents(0), surchargeRate: 0, surcharge: cents(0) }];
}

const describe = (lines: SalesLine[]) =>
  lines
    .map((l) => l.concept)
    .filter(Boolean)
    .join(" · ");

const issuedInvoices = (documents: SalesDocument[], range: DateRange) =>
  documents
    .filter((d) => d.kind === "invoice" && inRange(d.issuedOn, range))
    .sort((a, b) => a.issuedOn.localeCompare(b.issuedOn) || (a.number ?? "").localeCompare(b.number ?? ""));

const receivedInvoices = (purchases: PurchaseInvoice[], range: DateRange, assets: boolean) =>
  purchases
    .filter((p) => Boolean(p.asset) === assets && inRange(p.bookedOn, range))
    .sort((a, b) => a.bookedOn.localeCompare(b.bookedOn) || a.number.localeCompare(b.number));

/* ───────────────────────── Register books ───────────────────────── */

const ISSUED_HEADER = [
  "Ejercicio",
  "Periodo",
  "Fecha de expedición",
  "Fecha de operación",
  "Serie",
  "Número",
  "NIF del destinatario",
  "Nombre del destinatario",
  "Tipo de operación",
  "Base imponible",
  "Tipo de IVA (%)",
  "Cuota de IVA repercutida",
  "Tipo de recargo (%)",
  "Cuota de recargo",
  "Total factura",
];

function issuedRows(doc: SalesDocument): Cell[][] {
  const client = clientOf(doc);
  const totals = documentTotals(doc);
  return byRate(doc.lines).map((r, i) => [
    Number(doc.issuedOn.slice(0, 4)),
    quarterCode(doc.issuedOn),
    date(doc.issuedOn),
    date(doc.operationOn),
    seriesOf(doc).name,
    doc.number ?? "",
    client.taxId,
    client.name,
    operationLabel(doc.operationType),
    eur(r.base),
    percent(r.rate),
    eur(r.vat),
    r.surchargeRate ? percent(r.surchargeRate) : null,
    eurOrNull(r.surcharge),
    // The total belongs to the invoice: only on its first row
    i === 0 ? eur(totals.total) : null,
  ]);
}

const RECEIVED_HEADER = [
  "Ejercicio",
  "Periodo",
  "Nº de recepción",
  "Fecha de expedición",
  "Fecha de registro contable",
  "Fecha de operación",
  "Número de factura",
  "NIF del emisor",
  "Nombre del emisor",
  "Tipo de operación",
  "Base imponible",
  "Tipo de IVA (%)",
  "Cuota de IVA soportada",
  "Cuota deducible",
  "Tipo de recargo (%)",
  "Cuota de recargo",
  "Total factura",
];

function receivedRows(doc: PurchaseInvoice, receipt: number): Cell[][] {
  const supplier = supplierOf(doc);
  const share = (doc.vatImputation ?? doc.imputation) / 100;
  const total = purchaseTotals(doc).total;
  return byRate(doc.lines).map((r, i) => [
    Number(doc.bookedOn.slice(0, 4)),
    quarterCode(doc.bookedOn),
    receipt,
    date(doc.issuedOn),
    date(doc.bookedOn),
    date(doc.operationOn),
    doc.number,
    supplier.taxId,
    supplier.name,
    purchaseOperationLabel(doc.operationType),
    eur(r.base),
    percent(r.rate),
    eur(r.vat),
    eur(applyRate(r.vat, share)),
    r.surchargeRate ? percent(r.surchargeRate) : null,
    eurOrNull(r.surcharge),
    i === 0 ? eur(total) : null,
  ]);
}

const ASSET_VAT_HEADER = [
  "Ejercicio",
  "Periodo",
  "Fecha de expedición",
  "Fecha de inicio de utilización",
  "Número de factura",
  "NIF del proveedor",
  "Nombre del proveedor",
  "Descripción del bien",
  "Identificación del bien",
  "Base imponible",
  "Tipo de IVA (%)",
  "Cuota de IVA soportada",
  "Cuota deducible",
  "Prorrata anual definitiva (%)",
];

function assetVatRows(doc: PurchaseInvoice): Cell[][] {
  const supplier = supplierOf(doc);
  const share = (doc.vatImputation ?? doc.imputation) / 100;
  return byRate(doc.lines).map((r) => [
    Number(doc.bookedOn.slice(0, 4)),
    quarterCode(doc.bookedOn),
    date(doc.issuedOn),
    date(assetStartsOn(doc)),
    doc.number,
    supplier.taxId,
    supplier.name,
    describe(doc.lines),
    doc.asset?.identifier ?? "",
    eur(r.base),
    percent(r.rate),
    eur(r.vat),
    eur(applyRate(r.vat, share)),
    100,
  ]);
}

const AMORTIZATION_HEADER = [
  "Fecha de inicio de utilización",
  "Número de factura",
  "NIF del proveedor",
  "Nombre del proveedor",
  "Descripción del bien",
  "Tipo de bien",
  "Valor de adquisición",
  "Coeficiente anual (%)",
  "Amortización del periodo",
  "Amortización acumulada",
  "Valor pendiente de amortizar",
];

/** Investment goods with amortization in the range, or bought in it. */
function amortizationRows(purchases: PurchaseInvoice[], range: DateRange): Cell[][] {
  return purchases
    .filter((p) => p.asset && assetStartsOn(p) <= range.to)
    .map((doc) => ({ doc, asset: assetOf(doc) }))
    .map(({ doc, asset }) => ({ doc, asset, amount: amortizationBetween(asset, range.from, range.to) }))
    .filter(({ doc, amount }) => amount !== 0 || inRange(doc.bookedOn, range))
    .sort((a, b) => a.asset.startsOn.localeCompare(b.asset.startsOn))
    .map(({ doc, asset, amount }) => {
      const supplier = supplierOf(doc);
      const accumulated = accumulatedAmortization(asset, range.to);
      return [
        date(asset.startsOn),
        doc.number,
        supplier.taxId,
        supplier.name,
        describe(doc.lines),
        ASSET_CATEGORY_LABELS[asset.plan.category],
        eur(asset.value),
        roundHundredths(yearlyRate(asset.plan)),
        eur(amount),
        eur(accumulated),
        eur(cents(asset.value - accumulated)),
      ];
    });
}

const yearRange = (year: number): DateRange => ({ from: `${year}-01-01`, to: `${year}-12-31` });

/** VAT books: issued invoices, received invoices and investment goods. */
export function vatBooks(documents: SalesDocument[], purchases: PurchaseInvoice[], year: number): Sheet[] {
  const range = yearRange(year);
  return [
    { name: "Facturas expedidas", header: ISSUED_HEADER, rows: issuedInvoices(documents, range).flatMap(issuedRows) },
    {
      name: "Facturas recibidas",
      header: RECEIVED_HEADER,
      rows: receivedInvoices(purchases, range, false).flatMap((d, i) => receivedRows(d, i + 1)),
    },
    {
      name: "Bienes de inversión",
      header: ASSET_VAT_HEADER,
      rows: receivedInvoices(purchases, range, true).flatMap(assetVatRows),
    },
  ];
}

const INCOME_HEADER = [
  "Ejercicio",
  "Periodo",
  "Fecha",
  "Número",
  "NIF del cliente",
  "Nombre del cliente",
  "Concepto de ingreso",
  "Ingreso íntegro",
  "Retención IRPF",
  "Total factura",
];

function incomeRow(doc: SalesDocument): Cell[] {
  const client = clientOf(doc);
  const totals = documentTotals(doc);
  return [
    Number(doc.issuedOn.slice(0, 4)),
    quarterCode(doc.issuedOn),
    date(doc.issuedOn),
    doc.number ?? "",
    client.taxId,
    client.name,
    incomeTypeLabel(doc.incomeType),
    eur(totals.base),
    eurOrNull(totals.withholding),
    eur(totals.total),
  ];
}

const EXPENSE_HEADER = [
  "Ejercicio",
  "Periodo",
  "Fecha",
  "Número",
  "NIF",
  "Nombre",
  "Concepto de gasto",
  "Importe del gasto",
  "Imputación (%)",
  "Gasto deducible",
  "Retención IRPF",
  "Con factura",
];

function purchaseExpenseRow(doc: PurchaseInvoice): Cell[] {
  const supplier = supplierOf(doc);
  const totals = purchaseTotals(doc);
  return [
    Number(doc.bookedOn.slice(0, 4)),
    quarterCode(doc.bookedOn),
    date(doc.bookedOn),
    doc.number,
    supplier.taxId,
    supplier.name,
    expenseTypeLabel(doc.expenseType),
    eur(totals.base),
    doc.imputation,
    eur(deductible(doc).base),
    eurOrNull(totals.withholding),
    "Sí",
  ];
}

function expenseRow(expense: Expense): Cell[] {
  const payee = payeeOf(expense);
  return [
    Number(expense.date.slice(0, 4)),
    quarterCode(expense.date),
    date(expense.date),
    expense.number,
    payee?.taxId ?? "",
    payee?.name ?? "",
    expenseTypeLabel(expense.expenseType),
    eur(expense.amount),
    expense.imputation,
    eur(deductibleOf(expense)),
    null,
    "No",
  ];
}

function expenseRows(purchases: PurchaseInvoice[], expenses: Expense[], range: DateRange): Cell[][] {
  const rows = [
    ...receivedInvoices(purchases, range, false).map((d) => ({ date: d.bookedOn, row: purchaseExpenseRow(d) })),
    ...expenses.filter((e) => inRange(e.date, range)).map((e) => ({ date: e.date, row: expenseRow(e) })),
  ];
  return rows.sort((a, b) => a.date.localeCompare(b.date)).map((r) => r.row);
}

/** Income tax books: income, expenses (invoices and expenses without one) and investment goods. */
export function incomeTaxBooks(
  documents: SalesDocument[],
  purchases: PurchaseInvoice[],
  expenses: Expense[],
  year: number,
): Sheet[] {
  const range = yearRange(year);
  return [
    { name: "Ingresos", header: INCOME_HEADER, rows: issuedInvoices(documents, range).map(incomeRow) },
    { name: "Gastos", header: EXPENSE_HEADER, rows: expenseRows(purchases, expenses, range) },
    { name: "Bienes de inversión", header: AMORTIZATION_HEADER, rows: amortizationRows(purchases, range) },
  ];
}

/**
 * The unified VAT and income tax books, as the tax office's format joins them: each
 * issued invoice with its income, each received invoice or expense with its
 * deductible part, and each investment good with its VAT and amortization.
 */
export function unifiedBooks(
  documents: SalesDocument[],
  purchases: PurchaseInvoice[],
  expenses: Expense[],
  year: number,
): Sheet[] {
  const range = yearRange(year);
  const income = issuedInvoices(documents, range).flatMap((doc) => {
    const totals = documentTotals(doc);
    return issuedRows(doc).map((row, i) => [
      ...row,
      incomeTypeLabel(doc.incomeType),
      i === 0 ? eur(totals.base) : null,
      i === 0 ? eurOrNull(totals.withholding) : null,
    ]);
  });

  const invoiceRows = receivedInvoices(purchases, range, false).flatMap((doc, n) => {
    const totals = purchaseTotals(doc);
    return receivedRows(doc, n + 1).map((row, i) => ({
      date: doc.bookedOn,
      row: [
        ...row,
        expenseTypeLabel(doc.expenseType),
        i === 0 ? eur(deductible(doc).base) : null,
        i === 0 ? eurOrNull(totals.withholding) : null,
      ],
    }));
  });
  const expenseOnlyRows = expenses
    .filter((e) => inRange(e.date, range))
    .map((e) => {
      const payee = payeeOf(e);
      const row: Cell[] = [
        Number(e.date.slice(0, 4)),
        quarterCode(e.date),
        null,
        date(e.date),
        date(e.date),
        null,
        e.number,
        payee?.taxId ?? "",
        payee?.name ?? "",
        "Gasto sin factura",
        eur(e.amount),
        null,
        null,
        null,
        null,
        null,
        eur(e.amount),
        expenseTypeLabel(e.expenseType),
        eur(deductibleOf(e)),
        null,
      ];
      return { date: e.date, row };
    });

  const assets = receivedInvoices(purchases, range, true);
  const amortizationByNumber = new Map(amortizationRows(assets, range).map((row) => [row[1], row] as const));
  const assetRows = assets.flatMap((doc) =>
    assetVatRows(doc).map((row, i) => {
      const amortization = amortizationByNumber.get(doc.number);
      return [...row, ...(i === 0 && amortization ? amortization.slice(5) : [null, null, null, null, null, null])];
    }),
  );
  // Goods bought in earlier years still being amortized appear only with their amortization
  const olderAssets = amortizationRows(
    purchases.filter((p) => p.asset && p.bookedOn < range.from),
    range,
  ).map((a) => [
    year,
    null,
    null,
    a[0]!,
    a[1]!,
    a[2]!,
    a[3]!,
    a[4]!,
    null,
    null,
    null,
    null,
    null,
    null,
    ...a.slice(5),
  ]);

  return [
    {
      name: "Ingresos",
      header: [...ISSUED_HEADER, "Concepto de ingreso", "Ingreso computable", "Retención IRPF"],
      rows: income,
    },
    {
      name: "Gastos",
      header: [...RECEIVED_HEADER, "Concepto de gasto", "Gasto deducible", "Retención IRPF"],
      rows: [...invoiceRows, ...expenseOnlyRows].sort((a, b) => a.date.localeCompare(b.date)).map((r) => r.row),
    },
    {
      name: "Bienes de inversión",
      header: [...ASSET_VAT_HEADER, ...AMORTIZATION_HEADER.slice(5)],
      rows: [...assetRows, ...olderAssets],
    },
  ];
}

/* ───────────────────────── Advanced export ───────────────────────── */

const DETAIL_HEADER = [
  "Número",
  "Fecha",
  "NIF",
  "Nombre",
  "Concepto",
  "Descripción detallada",
  "Inicio servicio",
  "Fin servicio",
  "Precio unitario",
  "Cantidad",
  "Descuento (%)",
  "Base imponible",
  "Tipo de IVA (%)",
  "Cuota de IVA",
  "Tipo de recargo (%)",
];

function detailRows(number: string, isoDate: string, contact: Contact, lines: SalesLine[]): Cell[][] {
  return lines.map((l) => [
    number,
    date(isoDate),
    contact.taxId,
    contact.name,
    l.concept,
    l.detail ?? "",
    date(l.serviceFrom),
    date(l.serviceTo),
    l.unitPrice,
    l.quantity,
    percent(l.discount),
    eur(lineBase(l)),
    percent(l.vatRate),
    eur(applyRate(lineBase(l), l.vatRate)),
    l.surchargeRate ? percent(l.surchargeRate) : null,
  ]);
}

export interface AdvancedOptions {
  invoices: boolean;
  invoiceDetail: boolean;
  payments: boolean;
  amortizations: boolean;
  expenses: boolean;
  quotes: DateRange | null;
  quoteDetail: boolean;
  deliveryNotes: DateRange | null;
  deliveryNoteDetail: boolean;
  contacts: boolean;
}

export interface AdvancedData {
  documents: SalesDocument[];
  purchases: PurchaseInvoice[];
  expenses: Expense[];
  clients: Contact[];
  suppliers: Contact[];
}

function salesListing(docs: SalesDocument[], today: Date): Cell[][] {
  return docs.map((doc) => {
    const client = clientOf(doc);
    const totals = documentTotals(doc);
    return [
      doc.number ?? "",
      date(doc.issuedOn),
      date(doc.dueOn),
      client.taxId,
      client.name,
      STATUS[displayStatus(doc, today)].label,
      eur(totals.base),
      eur(totals.vat),
      eurOrNull(totals.surcharge),
      eurOrNull(totals.withholding),
      eur(totals.total),
    ];
  });
}

const SALES_LISTING_HEADER = [
  "Número",
  "Fecha",
  "Vencimiento / validez",
  "NIF del cliente",
  "Nombre del cliente",
  "Estado",
  "Base imponible",
  "IVA",
  "Recargo",
  "Retención",
  "Total",
];

function purchaseListing(docs: PurchaseInvoice[], today: Date, assets: boolean): Cell[][] {
  return docs.map((doc) => {
    const supplier = supplierOf(doc);
    const totals = purchaseTotals(doc);
    const ded = deductible(doc);
    const row: Cell[] = [
      doc.number,
      date(doc.issuedOn),
      date(doc.bookedOn),
      date(doc.dueOn),
      supplier.taxId,
      supplier.name,
      expenseTypeLabel(doc.expenseType),
      purchaseOperationLabel(doc.operationType),
      PURCHASE_STATUS[purchaseStatus(doc, today)].label,
      eur(totals.base),
      eur(totals.vat),
      eurOrNull(totals.withholding),
      eur(totals.total),
      eur(outstanding(doc)),
      doc.imputation,
      assets ? null : eur(ded.base),
      eur(ded.vat),
    ];
    if (assets && doc.asset) {
      const asset = assetOf(doc);
      row.push(
        ASSET_CATEGORY_LABELS[doc.asset.category],
        ASSET_CONDITIONS.find((c) => c.value === doc.asset!.condition)?.label ?? "",
        roundHundredths(yearlyRate(doc.asset)),
        eur(asset.value),
        doc.asset.identifier ?? "",
      );
    }
    return row;
  });
}

const PURCHASE_LISTING_HEADER = [
  "Número",
  "Fecha de factura",
  "Fecha contable",
  "Vencimiento",
  "NIF del proveedor",
  "Nombre del proveedor",
  "Tipo de gasto",
  "Tipo de operación",
  "Estado",
  "Base imponible",
  "IVA",
  "Retención",
  "Total",
  "Pendiente de pago",
  "Imputación (%)",
  "Gasto deducible",
  "IVA deducible",
];

const ASSET_LISTING_HEADER = [
  ...PURCHASE_LISTING_HEADER,
  "Tipo de bien",
  "Estado de uso",
  "Coeficiente anual (%)",
  "Valor amortizable",
  "Identificación del bien",
];

/** The listings picked in the advanced export, for the invoices and expenses of `range`. */
export function advancedSheets(data: AdvancedData, options: AdvancedOptions, range: DateRange, today: Date): Sheet[] {
  const sheets: Sheet[] = [];
  const issued = issuedInvoices(data.documents, range);
  const received = receivedInvoices(data.purchases, range, false);
  const assets = receivedInvoices(data.purchases, range, true);

  if (options.invoices) {
    sheets.push(
      {
        name: "Facturas emitidas",
        header: [...SALES_LISTING_HEADER, "Serie", "Tipo de ingreso", "Tipo de operación"],
        rows: salesListing(issued, today).map((row, i) => [
          ...row,
          seriesOf(issued[i]!).name,
          incomeTypeLabel(issued[i]!.incomeType),
          operationLabel(issued[i]!.operationType),
        ]),
      },
      { name: "Facturas recibidas", header: PURCHASE_LISTING_HEADER, rows: purchaseListing(received, today, false) },
      { name: "Bienes de inversión", header: ASSET_LISTING_HEADER, rows: purchaseListing(assets, today, true) },
    );
    if (options.invoiceDetail) {
      sheets.push(
        {
          name: "Detalle facturas emitidas",
          header: DETAIL_HEADER,
          rows: issued.flatMap((d) => detailRows(d.number ?? "", d.issuedOn, clientOf(d), d.lines)),
        },
        {
          name: "Detalle facturas recibidas",
          header: DETAIL_HEADER,
          rows: [...received, ...assets].flatMap((d) => detailRows(d.number, d.bookedOn, supplierOf(d), d.lines)),
        },
      );
    }
    if (options.payments) {
      sheets.push(
        {
          name: "Cobros",
          header: [
            "Número de factura",
            "NIF del cliente",
            "Nombre del cliente",
            "Fecha de cobro",
            "Importe",
            "Método de cobro",
          ],
          rows: issued.flatMap((d) => {
            const client = clientOf(d);
            return (d.payments ?? []).map((p) => [
              d.number ?? "",
              client.taxId,
              client.name,
              date(p.date),
              eur(p.amount),
              methodName(p.paymentMethodId),
            ]);
          }),
        },
        {
          name: "Pagos",
          header: [
            "Número de factura",
            "NIF del proveedor",
            "Nombre del proveedor",
            "Fecha de pago",
            "Importe",
            "Método de pago",
          ],
          rows: [...received, ...assets].flatMap((d) => {
            const supplier = supplierOf(d);
            return d.payments.map((p) => [
              d.number,
              supplier.taxId,
              supplier.name,
              date(p.date),
              eur(p.amount),
              methodName(p.paymentMethodId),
            ]);
          }),
        },
      );
    }
  }

  if (options.amortizations)
    sheets.push({
      name: "Amortizaciones",
      header: AMORTIZATION_HEADER,
      rows: amortizationRows(data.purchases, range),
    });

  if (options.expenses)
    sheets.push({
      name: "Gastos",
      header: [
        "Número",
        "Fecha",
        "Concepto",
        "NIF",
        "Pagado a",
        "Tipo de gasto",
        "Importe",
        "Imputación (%)",
        "Gasto deducible",
        "Estado",
        "Fecha de pago",
        "Método de pago",
      ],
      rows: data.expenses
        .filter((e) => inRange(e.date, range))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => {
          const payee = payeeOf(e);
          return [
            e.number,
            date(e.date),
            e.concept,
            payee?.taxId ?? "",
            payee?.name ?? "",
            expenseTypeLabel(e.expenseType),
            eur(e.amount),
            e.imputation,
            eur(deductibleOf(e)),
            EXPENSE_STATUS[expenseStatus(e)].label,
            date(e.payment?.date),
            methodName(e.payment?.paymentMethodId),
          ];
        }),
    });

  const salesKind = (kind: SalesDocument["kind"], kindRange: DateRange) =>
    data.documents
      .filter((d) => d.kind === kind && inRange(d.issuedOn, kindRange))
      .sort((a, b) => a.issuedOn.localeCompare(b.issuedOn));

  for (const [kind, title, detailTitle, kindRange, detail] of [
    ["quote", "Presupuestos", "Detalle presupuestos", options.quotes, options.quoteDetail],
    ["deliveryNote", "Albaranes", "Detalle albaranes", options.deliveryNotes, options.deliveryNoteDetail],
  ] as const) {
    if (!kindRange) continue;
    const docs = salesKind(kind, kindRange);
    sheets.push({ name: title, header: SALES_LISTING_HEADER, rows: salesListing(docs, today) });
    if (detail)
      sheets.push({
        name: detailTitle,
        header: DETAIL_HEADER,
        rows: docs.flatMap((d) => detailRows(d.number ?? "", d.issuedOn, clientOf(d), d.lines)),
      });
  }

  if (options.contacts) {
    const row = (type: string) => (c: Contact) => [
      type,
      c.name,
      c.taxId,
      c.address ?? "",
      c.postalCode ?? "",
      c.city ?? "",
      c.province ?? "",
      c.country ?? "España",
      c.email ?? "",
      c.phone ?? "",
      c.mobile ?? "",
      c.website ?? "",
      c.withholding ? percent(WITHHOLDING_RATES[c.withholding]) : null,
      (c.tags ?? []).join(", "),
    ];
    sheets.push({
      name: "Clientes y proveedores",
      header: [
        "Tipo",
        "Nombre o razón social",
        "NIF",
        "Dirección",
        "Código postal",
        "Población",
        "Provincia",
        "País",
        "Email",
        "Teléfono",
        "Móvil",
        "Web",
        "Retención (%)",
        "Etiquetas",
      ],
      rows: [...data.clients.map(row("Cliente")), ...data.suppliers.map(row("Proveedor"))],
    });
  }

  return sheets;
}

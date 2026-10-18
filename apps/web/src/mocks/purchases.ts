import {
  WITHHOLDING_RATES,
  type AmortizationPlan,
  addDays,
  eurosToCents,
  invoiceTotals,
  type Cents,
  type PurchaseOperationType,
  type WithholdingKind,
} from "@fiscalia/core";
import type { Attachment, RentalLocation, SalesLine } from "./sales";

/** Sample received invoices until there is a backend. Figures are made up. */

/** Expense account in the Spanish chart of accounts (PGC), group 6. */
export type ExpenseType =
  | "600"
  | "602"
  | "607"
  | "621"
  | "622"
  | "623"
  | "6231"
  | "624"
  | "625"
  | "626"
  | "627"
  | "628"
  | "629"
  | "6291"
  | "6292"
  | "6293"
  | "6294"
  | "6295"
  | "6297"
  | "631"
  | "640"
  | "641"
  | "642"
  | "6421"
  | "6422"
  | "649"
  | "660"
  | "662"
  | "663"
  | "680"
  | "681"
  | "682";

export type PurchaseLine = SalesLine;

export interface Payment {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** A credit note has negative payments (refunds). */
  amount: Cents;
  paymentMethodId: string;
}

/** What turns a received invoice into an investment good: how it is amortized. */
export interface InvestmentAsset extends AmortizationPlan {
  /** Licence plate or cadastral reference, for vehicles and real estate. */
  identifier?: string;
}

export interface PurchaseInvoice {
  id: string;
  supplierId: string;
  /** The supplier's own number. */
  number: string;
  /** Issue date printed on the invoice (ISO). */
  issuedOn: string;
  /** Date it is booked on, which decides its quarter; later than `issuedOn` when it arrives late. */
  bookedOn: string;
  dueOn: string | null;
  expenseType: ExpenseType;
  /** Whole percentage (0–100) that counts as an expense. */
  imputation: number;
  /** Whole percentage of VAT that can be deducted; null means the same as `imputation`. */
  vatImputation: number | null;
  withholding: WithholdingKind;
  operationType: PurchaseOperationType;
  /** Date of the supply when it differs from the issue date. */
  operationOn: string | null;
  /** Customs document (DUA, or H7 under 150 €) of an import. */
  customsDocument?: string;
  /** The supplier applies VAT cash accounting (criterio de caja). */
  cashBasis: boolean;
  /** Property rental, reported in forms 115/180. */
  rental: boolean;
  rentalLocation?: RentalLocation;
  cadastralRef?: string;
  /** Invoice a credit note corrects. */
  rectifiesId?: string;
  lines: PurchaseLine[];
  payments: Payment[];
  privateNotes: string;
  tags?: string[];
  attachments?: Attachment[];
  /** Investment good: amortized over the years instead of an expense the day it is bought. */
  asset?: InvestmentAsset;
}

let seq = 0;

interface Recurring {
  supplierId: string;
  day: number;
  /** Number for the nth invoice of a year. */
  number: (year: number, month: number, n: number) => string;
  concept: (month: string) => string;
  base: (year: number, month: number) => number;
  extra?: Partial<PurchaseInvoice>;
  vatRate?: number;
  paymentMethodId?: string;
  /** Days until the payment is charged; null leaves it unpaid. */
  paidAfter?: number;
}

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function invoice(
  supplierId: string,
  number: string,
  issuedOn: string,
  lines: [concept: string, unitPrice: number, quantity?: number, vatRate?: number][],
  extra: Partial<PurchaseInvoice> & { paidOn?: string | null; paymentMethodId?: string } = {},
): PurchaseInvoice {
  const { paidOn = issuedOn, paymentMethodId = "bank1", ...rest } = extra;
  const docLines = lines.map(([concept, unitPrice, quantity = 1, vatRate = 0.21]) => ({
    id: `pl${++seq}`,
    concept,
    unitPrice,
    quantity,
    discount: 0,
    vatRate,
  }));
  const doc: PurchaseInvoice = {
    id: `p${++seq}`,
    supplierId,
    number,
    issuedOn,
    bookedOn: issuedOn,
    dueOn: null,
    expenseType: "629",
    imputation: 100,
    vatImputation: null,
    withholding: "none",
    operationType: "national",
    operationOn: null,
    cashBasis: false,
    rental: false,
    lines: docLines,
    payments: [],
    privateNotes: "",
    ...rest,
  };
  if (paidOn) {
    const { total } = invoiceTotals(doc.lines, WITHHOLDING_RATES[doc.withholding]);
    doc.payments = [{ id: `pay${++seq}`, date: paidOn, amount: total, paymentMethodId }];
  }
  return doc;
}

const RECURRING: Recurring[] = [
  {
    supplierId: "s1",
    day: 1,
    number: (y, _m, n) => `LN-${y}-${String(40 + n).padStart(4, "0")}`,
    concept: (m) => `Puesto fijo en coworking · ${m}`,
    base: (y) => (y === 2025 ? 260 : 280),
    extra: { expenseType: "621", dueOn: null },
  },
  {
    supplierId: "s2",
    day: 3,
    number: (y, _m, n) => `${y}/${String(n).padStart(3, "0")}`,
    concept: (m) => `Asesoría fiscal y contable · ${m}`,
    base: () => 60,
    extra: { expenseType: "623", withholding: "professional" },
    paymentMethodId: "transfer",
    paidAfter: 5,
  },
  {
    supplierId: "s3",
    day: 8,
    number: (y, m) => `TM${String(y).slice(2)}${String(m + 1).padStart(2, "0")}-0081342`,
    concept: (m) => `Fibra y móvil · ${m}`,
    base: (_y, m) => 45 + (m % 3) * 2.5,
    // Line shared with home: half of it is business use
    extra: { expenseType: "6291", imputation: 50 },
    paidAfter: 10,
  },
  {
    supplierId: "s4",
    day: 12,
    number: (y, m) => `IEE${y}${String(m + 1).padStart(2, "0")}04417`,
    concept: () => "Creative Cloud · plan Todas las aplicaciones",
    base: (y) => (y === 2025 ? 56.98 : 60.49),
    vatRate: 0,
    extra: { expenseType: "6297", operationType: "intraEu" },
    paymentMethodId: "card",
    paidAfter: 0,
  },
  {
    supplierId: "s5",
    day: 2,
    number: (y, m) => `EUINES${String(y).slice(2)}-${String(310_000 + m * 911 + y).slice(-6)}`,
    concept: (m) => `AWS · servicios en la nube · ${m}`,
    base: (y, m) => Math.round((38 + ((m * 7 + y) % 5) * 4.35) * 100) / 100,
    vatRate: 0,
    extra: { expenseType: "629", operationType: "reverseCharge" },
    paymentMethodId: "card",
    paidAfter: 0,
  },
  {
    supplierId: "s11",
    day: 1,
    number: (y, _m, n) => `ALM-${y}-${String(n).padStart(2, "0")}`,
    concept: (m) => `Alquiler de almacén · ${m}`,
    base: (y) => (y === 2025 ? 180 : 190),
    extra: {
      expenseType: "621",
      withholding: "rental",
      rental: true,
      rentalLocation: "spain",
      cadastralRef: "9872023VH5797S0001WX",
    },
    paymentMethodId: "transfer",
    paidAfter: 4,
  },
];

/** Months with sample invoices: January 2025 to October 2026. */
const MONTHS: [year: number, month: number][] = [
  ...Array.from({ length: 12 }, (_, m): [number, number] => [2025, m]),
  ...Array.from({ length: 10 }, (_, m): [number, number] => [2026, m]),
];

const recurring = RECURRING.flatMap((r) =>
  MONTHS.flatMap(([year, month]) => {
    const issuedOn = iso(year, month, r.day);
    // October 2026 is in progress: only what has arrived by mid-month
    if (issuedOn > "2026-10-14") return [];
    const label = `${MONTH_NAMES[month]} ${year}`;
    const n = month + 1;
    const latest = year === 2026 && month === 9;
    const paidOn =
      latest && r.supplierId !== "s4" && r.supplierId !== "s5" ? null : addDays(issuedOn, r.paidAfter ?? 1);
    return [
      invoice(
        r.supplierId,
        r.number(year, month, n),
        issuedOn,
        [[r.concept(label), r.base(year, month), 1, r.vatRate]],
        {
          ...r.extra,
          dueOn: r.supplierId === "s2" || r.supplierId === "s3" ? addDays(issuedOn, 15) : null,
          paidOn,
          paymentMethodId: r.paymentMethodId,
        },
      ),
    ];
  }),
);

const occasional: PurchaseInvoice[] = [
  invoice("s8", "POL-2025-118823", "2025-01-15", [["Seguro de responsabilidad civil profesional · anual", 285, 1, 0]], {
    expenseType: "625",
    operationType: "exempt",
  }),
  invoice("s8", "POL-2026-120417", "2026-01-15", [["Seguro de responsabilidad civil profesional · anual", 298, 1, 0]], {
    expenseType: "625",
    operationType: "exempt",
  }),
  invoice(
    "s9",
    "TP-25-004512",
    "2025-03-21",
    [
      ['Monitor 27" 4K', 289.26],
      ["Teclado mecánico", 74.38],
    ],
    {
      expenseType: "6294",
      paymentMethodId: "card",
    },
  ),
  invoice("s9", "TP-26-001877", "2026-02-09", [["Disco SSD externo 2 TB", 123.97]], {
    expenseType: "6294",
    paymentMethodId: "card",
  }),
  invoice(
    "s7",
    "T-2025-0331",
    "2025-04-04",
    [
      ["Cuadernos y material de oficina", 18.6],
      ["Tóner impresora", 41.32],
    ],
    {
      expenseType: "6293",
      paymentMethodId: "cash",
    },
  ),
  invoice("s7", "T-2026-0152", "2026-05-11", [["Material de oficina", 26.45]], {
    expenseType: "6293",
    paymentMethodId: "cash",
  }),
  invoice("s7", "T-2026-0409", "2026-09-17", [["Archivadores y papel", 22.31]], {
    expenseType: "6293",
    paymentMethodId: "cash",
  }),
  invoice("s6", "LP-2026-07731", "2026-07-22", [["Gasolina sin plomo 95", 57.85]], {
    expenseType: "624",
    imputation: 50,
    privateNotes: "Visita a cliente en Zaragoza; coche de uso mixto.",
    paymentMethodId: "card",
  }),
  invoice("s6", "LP-2026-09104", "2026-09-05", [["Gasolina sin plomo 95", 61.4]], {
    expenseType: "624",
    imputation: 50,
    paymentMethodId: "card",
  }),
  invoice(
    "s10",
    "TS-2026-0388",
    "2026-06-18",
    [
      ["Tableta gráfica · base imponible en aduana", 340],
      ["Despacho aduanero", 35],
    ],
    {
      expenseType: "6294",
      operationType: "import",
      customsDocument: "26ES00281140123456",
      privateNotes: "Tableta comprada a un proveedor de fuera de la UE; el IVA se pagó en aduana.",
    },
  ),
  // Credit note for an AWS overcharge in July
  invoice("s5", "EUCNES26-004118", "2026-08-20", [["Abono · ajuste de facturación de julio", -6.5, 1, 0]], {
    expenseType: "629",
    operationType: "reverseCharge",
    paymentMethodId: "card",
    privateNotes: "Reembolsado en la tarjeta.",
  }),
  // Arrived late: issued in September, booked in October
  invoice("s9", "TP-26-005230", "2026-09-29", [["Licencia de software de copias de seguridad · 1 año", 59.5]], {
    bookedOn: "2026-10-06",
    expenseType: "6294",
    paidOn: "2026-10-06",
    paymentMethodId: "card",
    tags: ["Software"],
  }),
  // Overdue: the supplier is still waiting
  invoice("s7", "T-2026-0398", "2026-09-02", [["Impresión de tarjetas de visita", 38]], {
    expenseType: "627",
    dueOn: "2026-10-02",
    paidOn: null,
  }),
  // Partially paid
  invoice("s9", "TP-26-005102", "2026-09-24", [["Portátil de trabajo · reparación de placa base", 412.4]], {
    expenseType: "622",
    dueOn: "2026-10-24",
    paidOn: null,
    tags: ["Equipo"],
  }),
];

/** Investment goods: amortized over the years instead of an expense the day they are bought. */
const assets: PurchaseInvoice[] = [
  invoice("s9", "TP-25-001204", "2025-02-10", [['Portátil MacBook Pro 14" M4', 1_652.89]], {
    expenseType: "681",
    paymentMethodId: "card",
    asset: { category: "itEquipment", condition: "new", method: "rate", value: 26 },
    tags: ["Equipo"],
  }),
  invoice("s9", "TP-25-006630", "2025-11-18", [["Mesa elevable y silla ergonómica", 694.21]], {
    expenseType: "681",
    paymentMethodId: "card",
    asset: { category: "installations", condition: "new", method: "years", value: 10 },
  }),
  invoice("s9", "TP-26-002291", "2026-04-07", [["Cámara web 4K para videollamadas", 165.29]], {
    expenseType: "681",
    paymentMethodId: "card",
    asset: { category: "itEquipment", condition: "lowValue", method: "rate", value: 100 },
  }),
  invoice("s9", "TP-26-005318", "2026-10-03", [["Licencia perpetua de software de maquetación", 826.45]], {
    expenseType: "680",
    dueOn: "2026-11-02",
    paidOn: null,
    asset: { category: "software", condition: "new", method: "rate", value: 33 },
  }),
];

const partial = occasional.find((p) => p.number === "TP-26-005102")!;
partial.payments = [{ id: `pay${++seq}`, date: "2026-09-30", amount: eurosToCents(200), paymentMethodId: "transfer" }];

/** Received invoices, newest first. */
export const initialPurchaseInvoices: PurchaseInvoice[] = [...recurring, ...occasional, ...assets].sort((a, b) =>
  b.bookedOn.localeCompare(a.bookedOn),
);

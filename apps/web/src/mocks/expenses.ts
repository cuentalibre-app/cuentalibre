import { eurosToCents } from "@cuentalibre/core";
import type { Expense, ExpenseType, OtherPayee } from "@cuentalibre/contracts";

/** Sample expenses without an invoice until there is a backend. Names, tax IDs and figures are made up. */

let seq = 0;

export const SOCIAL_SECURITY: OtherPayee = { name: "Tesorería General de la Seguridad Social", taxId: "Q2827003A" };
const BANK: OtherPayee = { name: "Banco Meseta S.A.", taxId: "A28000115" };

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

function expense(
  date: string,
  concept: string,
  /** Euros. */
  amount: number,
  expenseType: ExpenseType,
  extra: Partial<Expense> & { paidOn?: string | null; paymentMethodId?: string } = {},
): Expense {
  const { paidOn = date, paymentMethodId = "bank1", ...rest } = extra;
  return {
    id: `e${++seq}`,
    date,
    number: "",
    concept,
    amount: eurosToCents(amount),
    expenseType,
    imputation: 100,
    supplierId: null,
    payment: paidOn ? { date: paidOn, paymentMethodId } : null,
    rental: false,
    privateNotes: "",
    ...rest,
  };
}

/** Last day of a month, as an ISO date: the social security fee is charged then. */
const monthEnd = (year: number, month: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${new Date(Date.UTC(year, month + 1, 0)).getUTCDate()}`;

/** Expenses after this date have not been charged yet. */
const CHARGED_UNTIL = "2026-10-21";

/** Monthly self-employed fee (RETA), January 2025 to December 2026. */
const socialSecurity = [
  ...Array.from({ length: 12 }, (_, m): [number, number] => [2025, m]),
  ...Array.from({ length: 12 }, (_, m): [number, number] => [2026, m]),
].map(([year, month]) =>
  expense(
    monthEnd(year, month),
    `Cuota de autónomos · ${MONTH_NAMES[month]} ${year}`,
    year === 2025 ? 286 : 294,
    "6422",
    {
      otherPayee: SOCIAL_SECURITY,
      tags: ["Seguridad Social"],
      paidOn: monthEnd(year, month) > CHARGED_UNTIL ? null : monthEnd(year, month),
    },
  ),
);

/** Quarterly account fee, charged on the last day of the quarter. */
const bankFees = [
  [2025, 2],
  [2025, 5],
  [2025, 8],
  [2025, 11],
  [2026, 2],
  [2026, 5],
  [2026, 8],
  [2026, 11],
].map(([year, month]) =>
  expense(monthEnd(year!, month!), "Comisión de mantenimiento de la cuenta", 15, "626", {
    otherPayee: BANK,
    paidOn: monthEnd(year!, month!) > CHARGED_UNTIL ? null : monthEnd(year!, month!),
  }),
);

const occasional: Expense[] = [
  expense("2025-02-14", "Tasa de solicitud de marca nacional", 127.88, "631", {
    otherPayee: { name: "Oficina Española de Patentes y Marcas", taxId: "Q2819013J" },
    number: "TASA-2025-778120",
  }),
  expense("2025-06-05", "Parking · reunión con cliente", 9.6, "6292", { paymentMethodId: "card" }),
  expense("2026-01-20", "Cuota anual del colegio profesional", 180, "6297", {
    otherPayee: { name: "Colegio Oficial de Diseñadores", taxId: "Q2800571H" },
    number: "C-2026-0412",
    paymentMethodId: "transfer",
  }),
  expense("2026-04-09", "Taxi al aeropuerto · viaje a cliente en Barcelona", 32.5, "6292", {
    paymentMethodId: "card",
    privateNotes: "Ticket sin NIF del taxista.",
  }),
  expense("2026-07-15", "Comida de trabajo con cliente", 46.8, "627", {
    otherPayee: { name: "Restaurante La Corrala", taxId: "B87112231" },
    number: "T-58812",
    paymentMethodId: "card",
  }),
  expense("2026-08-12", "Reserva de sala de reuniones · ticket", 24, "621", {
    supplierId: "s1",
    paymentMethodId: "card",
  }),
  expense("2026-09-22", "Parking · rodaje en exteriores", 14.2, "6292", {
    supplierId: "s6",
    paymentMethodId: "card",
    tags: ["Desplazamientos"],
  }),
  // The home's electricity, partly used for the business
  expense("2026-10-02", "Luz de la vivienda · septiembre", 68.4, "628", {
    otherPayee: { name: "Eléctrica del Centro S.A.", taxId: "A28945616" },
    number: "EC-2610-55102",
    imputation: 6,
    privateNotes: "Trabajo en casa: el 20 % de la vivienda, y de los suministros se deduce el 30 % de esa parte.",
  }),
  // Pending: will be charged at the end of the month
  expense("2026-10-10", "Inscripción en congreso de diseño", 95, "6297", {
    otherPayee: { name: "Asociación de Diseñadores de Madrid", taxId: "G28654325" },
    paidOn: null,
  }),
  // November and December 2026 are ahead: recorded in advance, not charged yet
  expense("2026-11-03", "Luz de la vivienda · octubre", 72.15, "628", {
    otherPayee: { name: "Eléctrica del Centro S.A.", taxId: "A28945616" },
    number: "EC-2611-57318",
    imputation: 6,
    paidOn: null,
  }),
  expense("2026-11-19", "Tren a Valencia · taller con cliente", 58.3, "6292", {
    otherPayee: { name: "Ferrocarriles Peninsulares S.A.", taxId: "A86868189" },
    number: "FP-26-8841203",
    paymentMethodId: "card",
    paidOn: null,
    tags: ["Desplazamientos"],
  }),
  expense("2026-12-02", "Luz de la vivienda · noviembre", 81.9, "628", {
    otherPayee: { name: "Eléctrica del Centro S.A.", taxId: "A28945616" },
    number: "EC-2612-59904",
    imputation: 6,
    paidOn: null,
  }),
  expense("2026-12-17", "Comida de Navidad con clientes", 112.4, "627", {
    otherPayee: { name: "Restaurante La Corrala", taxId: "B87112231" },
    number: "T-61207",
    paymentMethodId: "card",
    paidOn: null,
  }),
];

/** Expenses, newest first. */
export const initialExpenses: Expense[] = [...socialSecurity, ...bankFees, ...occasional].sort((a, b) =>
  b.date.localeCompare(a.date),
);

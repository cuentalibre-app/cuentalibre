import { addDays, cents, eurosToCents, type Cents } from "@fiscalia/core";
import type { BankMovement, ManualPayment } from "@fiscalia/contracts";

/** Sample bank movements until there is a backend and bank sync. Concepts and figures are made up. */

/** What the sample statement needs to know about each recorded payment. */
export interface SamplePayment {
  key: string;
  source: "sale" | "purchase" | "expense" | "manual";
  date: string;
  amount: Cents;
  accountId: string | null;
  counterparty: string;
  reference: string;
}

const MAIN_ACCOUNT = "acc-main";
/** The statement starts here; earlier payments were never imported. */
const STATEMENT_FROM = "2026-04-01";
/** Movements up to this date are already reconciled; later ones wait on the reconciliation page. */
const RECONCILED_UNTIL = "2026-08-31";
const OPENING_BALANCE = eurosToCents(9_450.32);

export const initialManualPayments: ManualPayment[] = [
  {
    id: "mp1",
    date: "2026-07-01",
    amount: eurosToCents(-1_500),
    paymentMethodId: "transfer",
    description: "Traspaso a la cuenta de ahorro para el IRPF",
  },
];

function conceptOf(payment: SamplePayment): string {
  const name = payment.counterparty.toUpperCase();
  if (payment.source === "sale") return `TRANSFERENCIA DE ${name}`;
  if (payment.source === "manual") return "TRASPASO A CUENTA 0049 **** 7731";
  if (name.includes("SEGURIDAD SOCIAL")) return "RECIBO TGSS CUOTA AUTONOMOS";
  if (name.includes("BANCO")) return "COMISION MANTENIMIENTO CUENTA";
  return `RECIBO ${name}`;
}

/** Movements the bank adds on its own, never recorded in Fiscalia. */
const UNRECORDED: Omit<BankMovement, "id" | "accountId" | "balance" | "source" | "paymentKeys">[] = [
  { date: "2026-06-30", concept: "LIQUIDACION INTERESES", reference: "", amount: eurosToCents(0.42) },
  { date: "2026-09-18", concept: "DEVOLUCION RECIBO COMISION TRANSFERENCIA", reference: "", amount: eurosToCents(2.5) },
  { date: "2026-10-06", concept: "COMPRA TARJ. 4821 AMAZON EU SARL", reference: "", amount: eurosToCents(-36.29) },
];

/**
 * The main account's statement since April, built from the recorded payments so the
 * reconciliation page has real matches: collections arrive a day or two late, receipts
 * are charged on the day.
 */
export function sampleMovements(payments: SamplePayment[], today: string): BankMovement[] {
  const fromPayments = payments
    .filter((p) => p.accountId === MAIN_ACCOUNT && p.date >= STATEMENT_FROM && p.date <= today)
    .map((p, i) => {
      const date = p.source === "sale" ? addDays(p.date, 1 + (i % 2)) : p.date;
      return {
        date: date > today ? today : date,
        concept: conceptOf(p),
        reference: p.source === "sale" ? p.reference : "",
        amount: p.amount,
        paymentKeys: date <= RECONCILED_UNTIL ? [p.key] : [],
      };
    });

  const sorted = [...fromPayments, ...UNRECORDED.map((m) => ({ ...m, paymentKeys: [] }))].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  let balance = OPENING_BALANCE;
  return sorted.map((m, i) => {
    balance = cents(balance + m.amount);
    return { ...m, id: `mv${i + 1}`, accountId: MAIN_ACCOUNT, balance, source: "import" as const };
  });
}

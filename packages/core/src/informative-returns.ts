import { EU_VAT_PREFIXES, normalizeTaxId } from "./contacts";
import { roundCents, WITHHOLDING_RATES, type OperationType } from "./invoices";
import { isInPeriod } from "./ledger";
import type { Quarter } from "./period";
import type { PurchaseOperationType } from "./purchases";
import type { Boxes } from "./tax-returns";

/*
 * Withholding returns (111, 190, 115, 180) and informative returns about
 * third parties (347, 349), from issued and received invoices and expenses.
 *
 * Scope, as in the reference app: withholdings come only from received invoices
 * (no payroll, prizes or payments in kind), one return per period with no
 * supplementary ones, and operations are taken as invoiced.
 */

/** An issued or received invoice, or an expense, as these returns see it. */
export interface PartyOperation {
  id: string;
  /** ISO date that decides the period: issue date for sales, booking date for purchases. */
  date: string;
  side: "sale" | "purchase";
  /** Client or supplier; empty when the expense was paid to someone not saved as a supplier. */
  contactId: string;
  /** The contact is not based in Spain. */
  abroad: boolean;
  operation: OperationType | PurchaseOperationType;
  /** Goods rather than services: form 349 tells deliveries and acquisitions of goods apart. */
  goods: boolean;
  base: number;
  /** Base plus VAT and surcharge, before withholding: what form 347 adds up. */
  total: number;
  /** IRPF withheld on the invoice. */
  withholding: number;
  /** Withholding rate as a fraction: 0.15 is 15 %. */
  withholdingRate: number;
  /** Property rental (forms 115 and 180). */
  rental: boolean;
  /** Expense or income account of the PGC: 6231 (sporadic services) counts as earned income. */
  account: string;
  /** Rented property: cadastral reference and where it is. */
  cadastralRef?: string;
  rentalLocation?: RentalLocation;
  /** Collected or paid in cash. */
  cash: number;
}

export type RentalLocation = "spain" | "basqueCountry" | "navarre" | "noCadastralRef" | "abroad";

const inQuarter = (date: string, year: number, quarter: Quarter) => isInPeriod(date, { year, quarter });
const inYear = (date: string, year: number) => isInPeriod(date, { year, quarter: null });

const sum = <T>(items: T[], value: (item: T) => number) => roundCents(items.reduce((acc, i) => acc + value(i), 0));

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

/* ─────────────────── Forms 111 and 190: professionals' withholdings ─────────────────── */

/** Sporadic services (courses, talks, seminars) count as earned income, as the reference app assumes. */
export const EARNED_INCOME_ACCOUNT = "6231";

/** Received invoices with withholding, other than rentals. */
function withheldPurchases(ops: PartyOperation[]): PartyOperation[] {
  return ops.filter((o) => o.side === "purchase" && !o.rental && o.withholding !== 0);
}

/**
 * Key of form 190: F for courses, talks and literary or scientific works (earned income),
 * G for professional activities.
 */
export type PerceptorKey190 = "F" | "G";

export interface Perceptor {
  contactId: string;
  key: PerceptorKey190;
  /** Subkey of the key: G01 general rate, G02 reduced rate of new professionals, G04 Ceuta and Melilla. */
  subkey: string;
  base: number;
  withholding: number;
  /** Rate as a fraction when every document shares it; null when they differ. */
  rate: number | null;
  documentIds: string[];
}

const CEUTA_RATES = [WITHHOLDING_RATES.ceutaProfessional, WITHHOLDING_RATES.ceutaNewProfessional];

function subkeyOf(key: PerceptorKey190, rate: number): string {
  if (key === "F") return "01";
  if (CEUTA_RATES.some((r) => Math.abs(r - rate) < 1e-9)) return "04";
  return Math.abs(rate - WITHHOLDING_RATES.newProfessional) < 1e-9 ? "02" : "01";
}

function commonRate(ops: PartyOperation[]): number | null {
  const first = ops[0]!.withholdingRate;
  return ops.every((o) => Math.abs(o.withholdingRate - first) < 1e-9) ? first : null;
}

/** Withholdings per perceptor and key, largest first. */
function perceptors(ops: PartyOperation[]): Perceptor[] {
  const groups = groupBy(ops, (o) => `${o.contactId}|${o.account === EARNED_INCOME_ACCOUNT ? "F" : "G"}`);
  return [...groups.entries()]
    .map(([k, group]) => {
      const key = k.split("|")[1] as PerceptorKey190;
      const rate = commonRate(group);
      return {
        contactId: group[0]!.contactId,
        key,
        subkey: subkeyOf(key, rate ?? group[0]!.withholdingRate),
        base: sum(group, (o) => o.base),
        withholding: sum(group, (o) => o.withholding),
        rate,
        documentIds: group.map((o) => o.id),
      };
    })
    .sort((a, b) => b.withholding - a.withholding);
}

export interface Model111 {
  boxes: Boxes;
  perceptors: Perceptor[];
  documentIds: string[];
}

/**
 * Form 111 for a quarter. Box 01–03: earned income (sporadic services), 07–09: professional
 * activities, 25–27 (image rights) stay at zero. Perceptors are counted once per section.
 */
export function model111(ops: PartyOperation[], year: number, quarter: Quarter): Model111 {
  const docs = withheldPurchases(ops).filter((o) => inQuarter(o.date, year, quarter));
  const work = docs.filter((o) => o.account === EARNED_INCOME_ACCOUNT);
  const activities = docs.filter((o) => o.account !== EARNED_INCOME_ACCOUNT);
  const people = (group: PartyOperation[]) => new Set(group.map((o) => o.contactId)).size;

  const boxes: Boxes = {
    "01": people(work),
    "02": sum(work, (o) => o.base),
    "03": sum(work, (o) => o.withholding),
    "07": people(activities),
    "08": sum(activities, (o) => o.base),
    "09": sum(activities, (o) => o.withholding),
    "25": 0,
    "26": 0,
    "27": 0,
  };
  boxes["28"] = roundCents(boxes["03"]! + boxes["09"]! + boxes["27"]!);
  // Box 29 only applies to supplementary returns
  boxes["30"] = boxes["28"]!;
  return { boxes, perceptors: perceptors(docs), documentIds: docs.map((o) => o.id) };
}

export interface Model190 {
  perceptors: Perceptor[];
  base: number;
  withholding: number;
  /** What the four 111 of the year paid, which should match the withholding. */
  paid: number[];
}

/** Form 190: the year's withholdings, one record per perceptor and key. */
export function model190(ops: PartyOperation[], year: number): Model190 {
  const docs = withheldPurchases(ops).filter((o) => inYear(o.date, year));
  return {
    perceptors: perceptors(docs),
    base: sum(docs, (o) => o.base),
    withholding: sum(docs, (o) => o.withholding),
    paid: ([1, 2, 3, 4] as const).map((q) => model111(ops, year, q).boxes["30"]!),
  };
}

/* ─────────────────────── Forms 115 and 180: rental withholdings ─────────────────────── */

/** Rates expected on a rental: 19 %, or 7,6 % in Ceuta and Melilla. */
export const RENTAL_RATES = [WITHHOLDING_RATES.rental, WITHHOLDING_RATES.ceutaRental];

const rentals = (ops: PartyOperation[]) => ops.filter((o) => o.side === "purchase" && o.rental);

export interface Model115 {
  boxes: Boxes;
  documentIds: string[];
}

/** Form 115 for a quarter: rentals of urban property with withholding. */
export function model115(ops: PartyOperation[], year: number, quarter: Quarter): Model115 {
  const docs = rentals(ops).filter((o) => o.withholding !== 0 && inQuarter(o.date, year, quarter));
  const boxes: Boxes = {
    "01": new Set(docs.map((o) => o.contactId)).size,
    "02": sum(docs, (o) => o.base),
    "03": sum(docs, (o) => o.withholding),
    // Box 04 only applies to supplementary returns
    "04": 0,
  };
  boxes["05"] = boxes["03"]!;
  return { boxes, documentIds: docs.map((o) => o.id) };
}

/** Where the property is, as form 180 codes it. */
export const PROPERTY_SITUATION: Record<RentalLocation, string> = {
  spain: "1",
  basqueCountry: "2",
  navarre: "2",
  noCadastralRef: "3",
  abroad: "4",
};

export interface Landlord {
  contactId: string;
  cadastralRef: string;
  /** Situation code of form 180 (1–4). */
  situation: string;
  base: number;
  withholding: number;
  rate: number | null;
  documentIds: string[];
}

export interface Model180 {
  landlords: Landlord[];
  base: number;
  withholding: number;
  /** What the four 115 of the year paid. */
  paid: number[];
  /** Rentals with a withholding rate other than 19 % (or 7,6 % in Ceuta and Melilla), zero included. */
  unusual: PartyOperation[];
}

/**
 * Form 180: one record per landlord and property. Unlike the reference app, which lumps all of a
 * landlord's invoices together, properties are told apart by their cadastral reference.
 */
export function model180(ops: PartyOperation[], year: number): Model180 {
  const yearRentals = rentals(ops).filter((o) => inYear(o.date, year));
  const docs = yearRentals.filter((o) => o.withholding !== 0);
  const groups = groupBy(docs, (o) => `${o.contactId}|${o.cadastralRef ?? ""}`);
  const landlords = [...groups.values()]
    .map((group) => ({
      contactId: group[0]!.contactId,
      cadastralRef: group[0]!.cadastralRef ?? "",
      situation: PROPERTY_SITUATION[group[0]!.rentalLocation ?? "spain"],
      base: sum(group, (o) => o.base),
      withholding: sum(group, (o) => o.withholding),
      rate: commonRate(group),
      documentIds: group.map((o) => o.id),
    }))
    .sort((a, b) => b.withholding - a.withholding);
  return {
    landlords,
    base: sum(docs, (o) => o.base),
    withholding: sum(docs, (o) => o.withholding),
    paid: ([1, 2, 3, 4] as const).map((q) => model115(ops, year, q).boxes["05"]!),
    unusual: yearRentals.filter((o) => !RENTAL_RATES.some((r) => Math.abs(r - o.withholdingRate) < 1e-9)),
  };
}

/* ───────────────────── Form 347: operations with third parties ───────────────────── */

/** Yearly total, VAT included, above which a client or supplier is reported. */
export const THRESHOLD_347 = 3_005.06;
/** Cash collected from one person above which the amount is reported too. */
export const CASH_THRESHOLD_347 = 6_000;

/** Operations other forms already report: intra-EU (349), imports and exports (customs). */
const OUTSIDE_347: (OperationType | PurchaseOperationType)[] = ["intraEu", "export", "import"];

/** Why an operation is left out of form 347; null when it counts. */
export function excludedFrom347(
  op: PartyOperation,
  excludedContactIds: ReadonlySet<string> = new Set(),
): string | null {
  if (!op.contactId) return "Sin cliente ni proveedor identificado";
  if (excludedContactIds.has(op.contactId)) return "Contacto excluido en la configuración";
  if (op.withholding !== 0) return "Lleva retención: se declara en el 190 o el 180";
  if (OUTSIDE_347.includes(op.operation) || op.abroad) return "Operación con el extranjero";
  return null;
}

/** Key of form 347: A purchases, B sales. */
export type Key347 = "A" | "B";

export interface Declared347 {
  contactId: string;
  key: Key347;
  total: number;
  /** Total per quarter, as the form asks. */
  quarters: [number, number, number, number];
  /** Cash collected, reported when above 6.000 €; zero otherwise. */
  cash: number;
  documentIds: string[];
}

export interface Model347 {
  /** Clients and suppliers above the threshold, largest first. */
  declared: Declared347[];
  /** The rest, to see how close each one is. */
  belowThreshold: Declared347[];
  /** Operations of the year left out, with the reason. */
  excluded: { op: PartyOperation; reason: string }[];
}

export function model347(
  ops: PartyOperation[],
  year: number,
  excludedContactIds: ReadonlySet<string> = new Set(),
): Model347 {
  const yearOps = ops.filter((o) => inYear(o.date, year));
  const excluded: Model347["excluded"] = [];
  const counted: PartyOperation[] = [];
  for (const op of yearOps) {
    const reason = excludedFrom347(op, excludedContactIds);
    if (reason) excluded.push({ op, reason });
    else counted.push(op);
  }
  // Sales and purchases with the same person are reported apart
  const groups = groupBy(counted, (o) => `${o.contactId}|${o.side}`);
  const all = [...groups.values()]
    .map((group): Declared347 => {
      const quarters = ([1, 2, 3, 4] as const).map((q) =>
        sum(
          group.filter((o) => inQuarter(o.date, year, q)),
          (o) => o.total,
        ),
      ) as Declared347["quarters"];
      const key: Key347 = group[0]!.side === "sale" ? "B" : "A";
      const cash = key === "B" ? sum(group, (o) => o.cash) : 0;
      return {
        contactId: group[0]!.contactId,
        key,
        total: sum(group, (o) => o.total),
        quarters,
        cash: cash > CASH_THRESHOLD_347 ? cash : 0,
        documentIds: group.map((o) => o.id),
      };
    })
    .sort((a, b) => b.total - a.total);
  return {
    declared: all.filter((d) => Math.abs(d.total) > THRESHOLD_347),
    belowThreshold: all.filter((d) => Math.abs(d.total) <= THRESHOLD_347),
    excluded,
  };
}

/* ───────────────────── Form 349: intra-EU operations ───────────────────── */

/**
 * Key of form 349: E deliveries of goods, A acquisitions of goods, S services rendered,
 * I services acquired.
 */
export type Key349 = "E" | "A" | "S" | "I";

export type Periodicity349 = "quarterly" | "bimonthly" | "monthly";

/** The period of a 349: its months (0-based) within the year. */
export interface Period349 {
  year: number;
  months: number[];
}

function key349(op: PartyOperation): Key349 {
  if (op.side === "sale") return op.goods ? "E" : "S";
  return op.goods ? "A" : "I";
}

/**
 * Country code and number of an EU VAT number, as form 349 splits them: from the number's own
 * prefix, or else from the contact's country. Greece is EL.
 */
export function splitVatNumber(taxId: string, country?: string): { code: string; number: string } {
  const id = normalizeTaxId(taxId);
  const prefixes = Object.values(EU_VAT_PREFIXES);
  const own = id.slice(0, 2);
  if (/^[A-Z]{2}/.test(id) && prefixes.includes(own) && own !== "ES") return { code: own, number: id.slice(2) };
  return { code: (country && EU_VAT_PREFIXES[country]) || "", number: id };
}

export interface Operation349 {
  contactId: string;
  key: Key349;
  base: number;
  documentIds: string[];
}

export interface Model349 {
  operations: Operation349[];
  /** Number of operators (box "número total de operadores"). */
  operators: number;
  /** Sum of the bases. */
  total: number;
}

export function model349(ops: PartyOperation[], period: Period349): Model349 {
  const docs = ops.filter((o) => {
    if (o.operation !== "intraEu") return false;
    const [y, m] = o.date.split("-").map(Number);
    return y === period.year && period.months.includes(m! - 1);
  });
  const groups = groupBy(docs, (o) => `${o.contactId}|${key349(o)}`);
  const operations = [...groups.values()]
    .map((group) => ({
      contactId: group[0]!.contactId,
      key: key349(group[0]!),
      base: sum(group, (o) => o.base),
      documentIds: group.map((o) => o.id),
    }))
    .sort((a, b) => a.key.localeCompare(b.key) || b.base - a.base);
  return {
    operations,
    operators: new Set(operations.map((o) => `${o.contactId}|${o.key}`)).size,
    total: sum(operations, (o) => o.base),
  };
}

/** Months a 349 covers: a quarter, the first two months of a quarter (bimonthly), or one month. */
export function periods349(year: number, periodicity: Periodicity349): { key: string; months: number[] }[] {
  if (periodicity === "monthly")
    return Array.from({ length: 12 }, (_, m) => ({ key: `${year}-M${m + 1}`, months: [m] }));
  return ([1, 2, 3, 4] as const).map((q) => {
    const first = (q - 1) * 3;
    return {
      key: `${year}-T${q}`,
      months: periodicity === "bimonthly" ? [first, first + 1] : [first, first + 1, first + 2],
    };
  });
}

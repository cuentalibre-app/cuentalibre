import { applyRate, cents, eurosToCents, type Cents } from "./money";

/*
 * Products and services of the catalog: their prices, and the stock of those
 * whose units are counted. Stock is never stored as a number: it is the sum of
 * the product's movements (initial stock, manual regularizations and the ones
 * documents make), so deleting a movement keeps every figure consistent.
 */

/** Units of measure a product can be sold in. */
export const CATALOG_UNITS = [
  ["uds", "unidades"],
  ["dec", "decenas"],
  ["cent", "centenas"],
  ["mill", "millares"],
  ["mg", "miligramos"],
  ["g", "gramos"],
  ["kg", "kilogramos"],
  ["t", "toneladas"],
  ["ml", "mililitros"],
  ["cl", "centilitros"],
  ["dl", "decilitros"],
  ["l", "litros"],
  ["m3", "metros cúbicos"],
  ["min", "minutos"],
  ["h", "horas"],
  ["d", "días"],
  ["1/2d", "medios días"],
  ["jornadas", "jornadas"],
  ["1/2j", "medias jornadas"],
  ["semana", "semanas"],
  ["mes", "meses"],
  ["trimestre", "trimestres"],
  ["semestre", "semestres"],
  ["año", "años"],
  ["letra", "letras"],
  ["palabra", "palabras"],
  ["frase", "frases"],
  ["página", "páginas"],
  ["mm", "milímetros"],
  ["cm", "centímetros"],
  ["m", "metros"],
  ["km", "kilómetros"],
] as const;

export type CatalogUnit = (typeof CATALOG_UNITS)[number][0];

export function isCatalogUnit(code: string): code is CatalogUnit {
  return CATALOG_UNITS.some(([c]) => c === code);
}

export interface PriceBreakdown {
  /** Unit base after the discount. */
  base: Cents;
  vat: Cents;
  surcharge: Cents;
  /** What the buyer pays per unit (P.V.P.). */
  total: Cents;
}

/**
 * A unit price (decimal euros) split into its parts, in cents. `discount`, `vatRate` and `surchargeRate`
 * are fractions (0.1 for 10 %).
 */
export function priceBreakdown(price: number, { discount = 0, vatRate = 0, surchargeRate = 0 } = {}): PriceBreakdown {
  const base = eurosToCents(price * (1 - discount));
  const vat = applyRate(base, vatRate);
  const surcharge = applyRate(base, surchargeRate);
  return { base, vat, surcharge, total: cents(base + vat + surcharge) };
}

/**
 * Equivalence surcharge rates that go with each VAT rate. The historical VAT rates
 * (7 %, 8 %, 16 %, 18 %) had surcharges no longer offered (1 % and 4 %), so only
 * "no surcharge" fits them, except 7 % and 8 %, whose 1 % matches today's.
 */
const SURCHARGE_FOR_VAT: Record<number, readonly number[]> = {
  0.21: [0.052, 0.0175],
  0.18: [],
  0.16: [],
  0.1: [0.014],
  0.08: [0.01],
  0.075: [0.01],
  0.07: [0.01],
  0.05: [0.0062],
  0.04: [0.005],
  0.02: [0.0026],
  0: [],
};

/** Whether a surcharge rate can go with a VAT rate. No surcharge always can. */
export function surchargeFitsVat(vatRate: number, surchargeRate: number): boolean {
  if (surchargeRate === 0) return true;
  const key = Object.keys(SURCHARGE_FOR_VAT)
    .map(Number)
    .find((r) => Math.abs(r - vatRate) < 0.00005);
  return key !== undefined && SURCHARGE_FOR_VAT[key]!.some((s) => Math.abs(s - surchargeRate) < 0.00005);
}

/* Stock */

/** Where a stock movement comes from. Automatic ones are made by the program, manual ones by the user. */
export type StockMovementKind = "invoice" | "deliveryNote" | "initial" | "import" | "settings" | "deleted" | "manual";

/** Reason of a manual regularization. */
export type StockReason = "loss" | "found" | "purchase" | "sale" | "supplierReturn" | "settings" | "undefined";

export interface StockMovement {
  id: string;
  productId: string;
  /** Units added (positive) or taken (negative). */
  quantity: number;
  /** ISO date and time, so movements of the same day keep their order. */
  at: string;
  kind: StockMovementKind;
  reason?: StockReason;
  comments?: string;
  /** Document that made it, for automatic movements of invoices and delivery notes. */
  documentId?: string;
}

/** Rounds away floating point noise from summed decimal quantities (0.1 + 0.2). */
const roundQty = (n: number) => Math.round(n * 1e6) / 1e6;

/** Current stock of a product: the sum of its movements. */
export function stockOf(movements: readonly StockMovement[], productId: string): number {
  return roundQty(movements.reduce((acc, m) => (m.productId === productId ? acc + m.quantity : acc), 0));
}

/** Movements in chronological order, each with the product's stock right after it. */
export function withStockAfter<T extends StockMovement>(movements: readonly T[]): (T & { stockAfter: number })[] {
  const running = new Map<string, number>();
  return [...movements]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((m) => {
      const stockAfter = roundQty((running.get(m.productId) ?? 0) + m.quantity);
      running.set(m.productId, stockAfter);
      return { ...m, stockAfter };
    });
}

export type StockLevel = "negative" | "zero" | "positive";

export function stockLevel(stock: number): StockLevel {
  return stock < 0 ? "negative" : stock === 0 ? "zero" : "positive";
}

/** "out": no stock left (zero or owed); "low": under the alarm's minimum; "ok" otherwise. */
export type StockAlarm = "out" | "low" | "ok";

export function stockAlarm(stock: number, minUnits: number): StockAlarm {
  if (stock <= 0) return "out";
  return stock < minUnits ? "low" : "ok";
}

/* Stock and documents */

/** Units of each product in a document's lines; lines without a product don't count. */
export function quantitiesByProduct(lines: readonly { productId?: string; quantity: number }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines)
    if (line.productId) totals.set(line.productId, roundQty((totals.get(line.productId) ?? 0) + line.quantity));
  return totals;
}

/**
 * Stock change a document makes when it goes from taking `before` units of each product
 * to taking `after`: selling takes units out, so the change is before − after.
 */
export function stockChanges(
  before: ReadonlyMap<string, number>,
  after: ReadonlyMap<string, number>,
): Map<string, number> {
  const changes = new Map<string, number>();
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const change = roundQty((before.get(id) ?? 0) - (after.get(id) ?? 0));
    if (change !== 0) changes.set(id, change);
  }
  return changes;
}

/** When each kind of document moves stock, as set in the catalog settings. */
export interface StockRules {
  invoices: "never" | "createEdit";
  deliveryNotes: "never" | "createEdit" | "invoice";
  quotes: "never" | "deliveryNote" | "invoice";
  drafts: "never" | "invoice";
}

export type StockDocumentKind = "invoice" | "draft" | "quote" | "deliveryNote";

/**
 * Whether a document takes stock, given its kind and the kind of document it was made
 * from (a quote turned into a delivery note, a draft issued as an invoice…). An invoice
 * made from a delivery note that already took the stock doesn't take it again.
 */
export function documentTakesStock(
  kind: StockDocumentKind,
  origin: StockDocumentKind | undefined,
  rules: StockRules,
): boolean {
  switch (kind) {
    case "invoice": {
      if (origin === "deliveryNote") {
        if (rules.deliveryNotes === "createEdit") return false;
        if (rules.deliveryNotes === "invoice") return true;
      }
      if (origin === "quote" && rules.quotes === "invoice") return true;
      if (origin === "draft" && rules.drafts === "invoice") return true;
      return rules.invoices === "createEdit";
    }
    case "deliveryNote":
      return rules.deliveryNotes === "createEdit" || (origin === "quote" && rules.quotes === "deliveryNote");
    case "quote":
    case "draft":
      return false;
  }
}

/**
 * Products that a sale would leave below zero although they can't be sold without stock.
 * `available` is each product's stock counting back what this same document already took.
 */
export function stockShortages(
  wanted: ReadonlyMap<string, number>,
  available: ReadonlyMap<string, number>,
): { productId: string; wanted: number; available: number }[] {
  return [...wanted]
    .filter(([id, qty]) => available.has(id) && qty > available.get(id)!)
    .map(([productId, qty]) => ({ productId, wanted: qty, available: available.get(productId)! }));
}

/* Families */

export interface CatalogFamily {
  id: string;
  name: string;
  /** Null for a top-level family. */
  parentId: string | null;
}

/** Names from the top-level family down to this one. */
export function familyPath(families: readonly CatalogFamily[], id: string | null | undefined): string[] {
  const byId = new Map(families.map((f) => [f.id, f]));
  const path: string[] = [];
  const seen = new Set<string>();
  let current = id ? byId.get(id) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/** The family and all its subfamilies, at any depth. */
export function familyWithDescendants(families: readonly CatalogFamily[], id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of families)
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
  }
  return ids;
}

/**
 * Finds a family path such as ["Diseño", "Web"] (from an import's "Diseño|Web"),
 * creating the families that are missing. Names compare without case or accents.
 * Returns the deepest family's id and the families to add.
 */
export function resolveFamilyPath(
  families: readonly CatalogFamily[],
  names: readonly string[],
  newId: () => string,
): { id: string | null; created: CatalogFamily[] } {
  const key = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  const all = [...families];
  const created: CatalogFamily[] = [];
  let parentId: string | null = null;
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    let found = all.find((f) => f.parentId === parentId && key(f.name) === key(name));
    if (!found) {
      found = { id: newId(), name, parentId };
      all.push(found);
      created.push(found);
    }
    parentId = found.id;
  }
  return { id: parentId, created };
}

/** "Sí", "si", "yes", "1", "x" → true; "No", "0" → false; empty → null. Anything else is undefined (invalid). */
export function parseYesNo(text: string): boolean | null | undefined {
  const s = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
  if (s === "") return null;
  if (["si", "s", "yes", "y", "1", "x", "true", "verdadero"].includes(s)) return true;
  if (["no", "n", "0", "false", "falso"].includes(s)) return false;
  return undefined;
}

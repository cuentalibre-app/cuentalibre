import { useSyncExternalStore } from "react";
import {
  documentTakesStock,
  newId,
  quantitiesByProduct,
  stockChanges,
  stockOf,
  stockShortages,
  type CatalogFamily,
  type StockDocumentKind,
  type StockMovement,
  type StockReason,
} from "@fiscalia/core";
import {
  initialCatalogSettings,
  initialFamilies,
  initialMovements,
  initialProducts,
  type CatalogSettings,
  type Product,
} from "@/mocks/catalog";
import type { SalesDocument } from "@/mocks/sales";

/**
 * In-memory catalog: products, families, stock movements and the catalog settings.
 * Changes apply instantly and last until reload, like the other stores.
 */
export interface CatalogState {
  products: Product[];
  /** Deleted products, kept so their stock movements still show a name. */
  removed: Product[];
  families: CatalogFamily[];
  movements: StockMovement[];
  settings: CatalogSettings;
  /** Units each sales document has taken from stock, and its kind when it took them. */
  taken: Record<string, { kind: StockDocumentKind; origin?: StockDocumentKind; quantities: Record<string, number> }>;
}

let state: CatalogState = {
  products: initialProducts,
  removed: [],
  families: initialFamilies,
  movements: initialMovements,
  settings: initialCatalogSettings,
  taken: {},
};
const listeners = new Set<() => void>();

function commit(changes: Partial<CatalogState>) {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCatalog(): CatalogState {
  return useSyncExternalStore(subscribe, () => state);
}

const now = () => new Date().toISOString().slice(0, 19);

const movement = (
  productId: string,
  quantity: number,
  fields: Omit<StockMovement, "id" | "productId" | "quantity" | "at">,
) => ({ id: newId(), productId, quantity, at: now(), ...fields }) satisfies StockMovement;

export const catalogStore = {
  get: () => state,
  product: (id: string) => state.products.find((p) => p.id === id) ?? state.removed.find((p) => p.id === id),

  /** `initialStock` only counts when the product has stock control. */
  addProduct(product: Product, initialStock = 0) {
    commit({
      products: [...state.products, product],
      movements:
        product.stock && initialStock !== 0
          ? [...state.movements, movement(product.id, initialStock, { kind: "initial" })]
          : state.movements,
    });
  },

  /** Turning stock control on records `initialStock` as a settings movement. */
  updateProduct(id: string, product: Product, initialStock = 0) {
    const before = state.products.find((p) => p.id === id);
    const enabling = before && !before.stock && product.stock && initialStock !== 0;
    commit({
      products: state.products.map((p) => (p.id === id ? product : p)),
      movements: enabling ? [...state.movements, movement(id, initialStock, { kind: "settings" })] : state.movements,
    });
  },

  setActive: (id: string, active: boolean) =>
    commit({ products: state.products.map((p) => (p.id === id ? { ...p, active } : p)) }),

  /** Units left in stock go out with a "Producto eliminado" movement. */
  removeProducts(ids: string[]) {
    const gone = state.products.filter((p) => ids.includes(p.id));
    const closing = gone
      .filter((p) => p.stock && stockOf(state.movements, p.id) !== 0)
      .map((p) => movement(p.id, -stockOf(state.movements, p.id), { kind: "deleted" }));
    commit({
      products: state.products.filter((p) => !ids.includes(p.id)),
      removed: [...state.removed, ...gone],
      movements: [...state.movements, ...closing],
    });
  },

  /** "Borrar catálogo": every product, and the families too when asked. */
  clear(withFamilies: boolean) {
    catalogStore.removeProducts(state.products.map((p) => p.id));
    if (withFamilies) commit({ families: [] });
  },

  addFamily(name: string, parentId: string | null): CatalogFamily {
    const family = { id: newId(), name: name.trim(), parentId };
    commit({ families: [...state.families, family] });
    return family;
  },
  renameFamily: (id: string, name: string) =>
    commit({ families: state.families.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)) }),
  /** Only families without subfamilies; their products are left without a family. */
  removeFamily(id: string) {
    commit({
      families: state.families.filter((f) => f.id !== id),
      products: state.products.map((p) => (p.familyId === id ? { ...p, familyId: null } : p)),
    });
  },
  addFamilies: (families: CatalogFamily[]) => commit({ families: [...state.families, ...families] }),

  regularize(productId: string, quantity: number, reason: StockReason, comments: string) {
    commit({
      movements: [
        ...state.movements,
        movement(productId, quantity, { kind: "manual", reason, comments: comments.trim() || undefined }),
      ],
    });
  },
  removeMovement: (id: string) => commit({ movements: state.movements.filter((m) => m.id !== id) }),

  /** Adds new products and replaces existing ones (same id) in one go, with their stock movements. */
  importProducts(products: Product[], movements: StockMovement[], families: CatalogFamily[]) {
    const byId = new Map(products.map((p) => [p.id, p]));
    const existing = state.products.map((p) => byId.get(p.id) ?? p);
    const known = new Set(state.products.map((p) => p.id));
    commit({
      families: [...state.families, ...families],
      products: [...existing, ...products.filter((p) => !known.has(p.id))],
      movements: [...state.movements, ...movements],
    });
  },

  updateSettings: (settings: CatalogSettings) => commit({ settings }),
};

/* Stock taken by sales documents */

/** Units of products with stock control, the only ones documents move. */
function controlledQuantities(lines: SalesDocument["lines"]): Map<string, number> {
  const controlled = new Set(state.products.filter((p) => p.stock).map((p) => p.id));
  return quantitiesByProduct(lines.filter((l) => l.productId && controlled.has(l.productId)));
}

function originOf(doc: Pick<SalesDocument, "id" | "kind">, origin?: StockDocumentKind): StockDocumentKind | undefined {
  const before = state.taken[doc.id];
  return origin ?? (before && before.kind !== doc.kind ? before.kind : before?.origin);
}

/**
 * Brings the stock in line with a sales document after it is created or changed: it takes
 * (or gives back) the difference from what it had taken. `origin` is the kind of document it
 * was made from, such as the quote it invoices.
 */
export function syncDocumentStock(doc: SalesDocument, origin?: StockDocumentKind) {
  const from = originOf(doc, origin);
  const before = new Map(Object.entries(state.taken[doc.id]?.quantities ?? {}));
  const after = documentTakesStock(doc.kind, from, state.settings.rules) ? controlledQuantities(doc.lines) : new Map();
  const kind = doc.kind === "deliveryNote" ? "deliveryNote" : "invoice";
  const label = `${doc.kind === "deliveryNote" ? "Albarán" : "Factura"} ${doc.number ?? ""}`.trim();
  const added = [...stockChanges(before, after)].map(([productId, quantity]) =>
    movement(productId, quantity, { kind, documentId: doc.id, comments: label }),
  );
  commit({
    movements: added.length ? [...state.movements, ...added] : state.movements,
    taken: { ...state.taken, [doc.id]: { kind: doc.kind, origin: from, quantities: Object.fromEntries(after) } },
  });
}

/** A deleted document gives its units back when the settings say so. */
export function releaseDocumentStock(doc: SalesDocument) {
  const before = state.taken[doc.id];
  if (!before) return;
  const { [doc.id]: _, ...taken } = state.taken;
  const restore =
    doc.kind === "deliveryNote" ? state.settings.restoreOnDeleteDeliveryNote : state.settings.restoreOnDeleteInvoice;
  const given = restore
    ? Object.entries(before.quantities).map(([productId, quantity]) =>
        movement(productId, quantity, {
          kind: doc.kind === "deliveryNote" ? "deliveryNote" : "invoice",
          documentId: doc.id,
          comments: `Eliminación de ${doc.kind === "deliveryNote" ? "albarán" : "factura"} ${doc.number ?? ""}`.trim(),
        }),
      )
    : [];
  commit({ taken, movements: given.length ? [...state.movements, ...given] : state.movements });
}

/**
 * Message when saving the document would leave a product that can't be sold without
 * stock below zero; undefined when there is stock enough or the document doesn't take it.
 */
export function stockShortageMessage(
  doc: Pick<SalesDocument, "id" | "kind" | "lines">,
  origin?: StockDocumentKind,
): string | undefined {
  if (!documentTakesStock(doc.kind, originOf(doc, origin), state.settings.rules)) return undefined;
  const strict = new Set(state.products.filter((p) => p.stock && !p.stock.allowWithoutStock).map((p) => p.id));
  const wanted = new Map([...controlledQuantities(doc.lines)].filter(([id]) => strict.has(id)));
  const already = state.taken[doc.id]?.quantities ?? {};
  const available = new Map(
    [...wanted.keys()].map((id) => [id, stockOf(state.movements, id) + (already[id] ?? 0)] as const),
  );
  const short = stockShortages(wanted, available);
  if (short.length === 0) return undefined;
  return short
    .map((s) => {
      const p = catalogStore.product(s.productId);
      return `No hay stock suficiente de «${p?.name}»: quedan ${s.available.toLocaleString("es-ES")}${p?.unit ? ` ${p.unit}` : ""}.`;
    })
    .join(" ");
}

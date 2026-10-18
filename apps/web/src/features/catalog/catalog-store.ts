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
import type { CatalogSettings, Product, SalesDocument } from "@fiscalia/contracts";
import type { Command, Entity } from "@/data/commands";
import { createStore } from "@/data/store";
import { initialCatalogSettings, initialFamilies, initialMovements, initialProducts } from "@/mocks/catalog";

/**
 * The catalog: products, families, stock movements and the catalog settings. Changes apply
 * instantly and are sent to the backend (see `@/data`).
 */
export interface CatalogState {
  products: Product[];
  /** Deleted products, kept so their stock movements still show a name. */
  removed: Product[];
  families: CatalogFamily[];
  movements: StockMovement[];
  settings: CatalogSettings;
  /**
   * Units each sales document has taken from stock, and its kind when it took them. Only the
   * client keeps this; the backend will work it out from the documents itself.
   */
  taken: Record<string, { kind: StockDocumentKind; origin?: StockDocumentKind; quantities: Record<string, number> }>;
}

const catalog = createStore<CatalogState>({
  products: initialProducts,
  removed: [],
  families: initialFamilies,
  movements: initialMovements,
  settings: initialCatalogSettings,
  taken: {},
});

export function useCatalog(): CatalogState {
  return catalog.use();
}

const write = (changes: Partial<CatalogState>, commands: Command[]) =>
  catalog.write({ ...catalog.get(), ...changes }, commands);

const created = (entity: Entity, items: { id: string }[]): Command[] =>
  items.map((data) => ({ type: "create", entity, data }));
const deleted = (entity: Entity, ids: string[]): Command[] => ids.map((id) => ({ type: "delete", entity, id }));

const now = () => new Date().toISOString().slice(0, 19);

const movement = (
  productId: string,
  quantity: number,
  fields: Omit<StockMovement, "id" | "productId" | "quantity" | "at">,
) => ({ id: newId(), productId, quantity, at: now(), ...fields }) satisfies StockMovement;

export const catalogStore = {
  get: catalog.get,
  product: (id: string) =>
    catalog.get().products.find((p) => p.id === id) ?? catalog.get().removed.find((p) => p.id === id),

  /** `initialStock` only counts when the product has stock control. */
  addProduct(product: Product, initialStock = 0) {
    const { products, movements } = catalog.get();
    const added = product.stock && initialStock !== 0 ? [movement(product.id, initialStock, { kind: "initial" })] : [];
    return write({ products: [...products, product], movements: [...movements, ...added] }, [
      ...created("products", [product]),
      ...created("stockMovements", added),
    ]);
  },

  /** Turning stock control on records `initialStock` as a settings movement. */
  updateProduct(id: string, product: Product, initialStock = 0) {
    const { products, movements } = catalog.get();
    const before = products.find((p) => p.id === id);
    const enabling = before && !before.stock && product.stock && initialStock !== 0;
    const added = enabling ? [movement(id, initialStock, { kind: "settings" })] : [];
    return write({ products: products.map((p) => (p.id === id ? product : p)), movements: [...movements, ...added] }, [
      { type: "update", entity: "products", id, changes: product },
      ...created("stockMovements", added),
    ]);
  },

  setActive: (id: string, active: boolean) =>
    write({ products: catalog.get().products.map((p) => (p.id === id ? { ...p, active } : p)) }, [
      { type: "update", entity: "products", id, changes: { active } },
    ]),

  /** Units left in stock go out with a "Producto eliminado" movement. */
  removeProducts(ids: string[]) {
    const { products, removed, movements } = catalog.get();
    const gone = products.filter((p) => ids.includes(p.id));
    const closing = gone
      .filter((p) => p.stock && stockOf(movements, p.id) !== 0)
      .map((p) => movement(p.id, -stockOf(movements, p.id), { kind: "deleted" }));
    return write(
      {
        products: products.filter((p) => !ids.includes(p.id)),
        removed: [...removed, ...gone],
        movements: [...movements, ...closing],
      },
      [
        ...created("stockMovements", closing),
        ...deleted(
          "products",
          gone.map((p) => p.id),
        ),
      ],
    );
  },

  /** "Borrar catálogo": every product, and the families too when asked. */
  clear(withFamilies: boolean) {
    void catalogStore.removeProducts(catalog.get().products.map((p) => p.id));
    const { families } = catalog.get();
    if (withFamilies)
      void write(
        { families: [] },
        deleted(
          "catalogFamilies",
          families.map((f) => f.id),
        ),
      );
  },

  addFamily(name: string, parentId: string | null): CatalogFamily {
    const family = { id: newId(), name: name.trim(), parentId };
    void write({ families: [...catalog.get().families, family] }, created("catalogFamilies", [family]));
    return family;
  },
  renameFamily: (id: string, name: string) =>
    write({ families: catalog.get().families.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)) }, [
      { type: "update", entity: "catalogFamilies", id, changes: { name: name.trim() } },
    ]),
  /** Only families without subfamilies; their products are left without a family. */
  removeFamily(id: string) {
    const { families, products } = catalog.get();
    const orphans = products.filter((p) => p.familyId === id);
    return write(
      {
        families: families.filter((f) => f.id !== id),
        products: products.map((p) => (p.familyId === id ? { ...p, familyId: null } : p)),
      },
      [
        ...orphans.map((p): Command => ({ type: "update", entity: "products", id: p.id, changes: { familyId: null } })),
        ...deleted("catalogFamilies", [id]),
      ],
    );
  },
  addFamilies: (families: CatalogFamily[]) =>
    write({ families: [...catalog.get().families, ...families] }, created("catalogFamilies", families)),

  regularize(productId: string, quantity: number, reason: StockReason, comments: string) {
    const added = movement(productId, quantity, { kind: "manual", reason, comments: comments.trim() || undefined });
    return write({ movements: [...catalog.get().movements, added] }, created("stockMovements", [added]));
  },
  removeMovement: (id: string) =>
    write({ movements: catalog.get().movements.filter((m) => m.id !== id) }, deleted("stockMovements", [id])),

  /** Adds new products and replaces existing ones (same id) in one go, with their stock movements. */
  importProducts(products: Product[], movements: StockMovement[], families: CatalogFamily[]) {
    const state = catalog.get();
    const byId = new Map(products.map((p) => [p.id, p]));
    const known = new Set(state.products.map((p) => p.id));
    const fresh = products.filter((p) => !known.has(p.id));
    const replaced = products.filter((p) => known.has(p.id));
    return write(
      {
        families: [...state.families, ...families],
        products: [...state.products.map((p) => byId.get(p.id) ?? p), ...fresh],
        movements: [...state.movements, ...movements],
      },
      [
        ...created("catalogFamilies", families),
        ...replaced.map((p): Command => ({ type: "update", entity: "products", id: p.id, changes: p })),
        ...created("products", fresh),
        ...created("stockMovements", movements),
      ],
    );
  },

  updateSettings: (settings: CatalogSettings) =>
    write({ settings }, [{ type: "saveSettings", section: "catalogSettings", data: settings }]),
};

/* Stock taken by sales documents */

/** Units of products with stock control, the only ones documents move. */
function controlledQuantities(lines: SalesDocument["lines"]): Map<string, number> {
  const controlled = new Set(
    catalog
      .get()
      .products.filter((p) => p.stock)
      .map((p) => p.id),
  );
  return quantitiesByProduct(lines.filter((l) => l.productId && controlled.has(l.productId)));
}

function originOf(doc: Pick<SalesDocument, "id" | "kind">, origin?: StockDocumentKind): StockDocumentKind | undefined {
  const before = catalog.get().taken[doc.id];
  return origin ?? (before && before.kind !== doc.kind ? before.kind : before?.origin);
}

/**
 * Brings the stock in line with a sales document after it is created or changed: it takes
 * (or gives back) the difference from what it had taken. `origin` is the kind of document it
 * was made from, such as the quote it invoices.
 */
export function syncDocumentStock(doc: SalesDocument, origin?: StockDocumentKind) {
  const from = originOf(doc, origin);
  const before = new Map(Object.entries(catalog.get().taken[doc.id]?.quantities ?? {}));
  const after = documentTakesStock(doc.kind, from, catalog.get().settings.rules)
    ? controlledQuantities(doc.lines)
    : new Map();
  const kind = doc.kind === "deliveryNote" ? "deliveryNote" : "invoice";
  const label = `${doc.kind === "deliveryNote" ? "Albarán" : "Factura"} ${doc.number ?? ""}`.trim();
  const added = [...stockChanges(before, after)].map(([productId, quantity]) =>
    movement(productId, quantity, { kind, documentId: doc.id, comments: label }),
  );
  const state = catalog.get();
  void write(
    {
      movements: added.length ? [...state.movements, ...added] : state.movements,
      taken: { ...state.taken, [doc.id]: { kind: doc.kind, origin: from, quantities: Object.fromEntries(after) } },
    },
    created("stockMovements", added),
  );
}

/** A deleted document gives its units back when the settings say so. */
export function releaseDocumentStock(doc: SalesDocument) {
  const before = catalog.get().taken[doc.id];
  if (!before) return;
  const { [doc.id]: _, ...taken } = catalog.get().taken;
  const restore =
    doc.kind === "deliveryNote"
      ? catalog.get().settings.restoreOnDeleteDeliveryNote
      : catalog.get().settings.restoreOnDeleteInvoice;
  const given = restore
    ? Object.entries(before.quantities).map(([productId, quantity]) =>
        movement(productId, quantity, {
          kind: doc.kind === "deliveryNote" ? "deliveryNote" : "invoice",
          documentId: doc.id,
          comments: `Eliminación de ${doc.kind === "deliveryNote" ? "albarán" : "factura"} ${doc.number ?? ""}`.trim(),
        }),
      )
    : [];
  const { movements } = catalog.get();
  void write(
    { taken, movements: given.length ? [...movements, ...given] : movements },
    created("stockMovements", given),
  );
}

/**
 * Message when saving the document would leave a product that can't be sold without
 * stock below zero; undefined when there is stock enough or the document doesn't take it.
 */
export function stockShortageMessage(
  doc: Pick<SalesDocument, "id" | "kind" | "lines">,
  origin?: StockDocumentKind,
): string | undefined {
  if (!documentTakesStock(doc.kind, originOf(doc, origin), catalog.get().settings.rules)) return undefined;
  const strict = new Set(
    catalog
      .get()
      .products.filter((p) => p.stock && !p.stock.allowWithoutStock)
      .map((p) => p.id),
  );
  const wanted = new Map([...controlledQuantities(doc.lines)].filter(([id]) => strict.has(id)));
  const already = catalog.get().taken[doc.id]?.quantities ?? {};
  const available = new Map(
    [...wanted.keys()].map((id) => [id, stockOf(catalog.get().movements, id) + (already[id] ?? 0)] as const),
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

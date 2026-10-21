import {
  CATALOG_UNITS,
  familyPath,
  stockAlarm,
  stockOf,
  type CatalogFamily,
  type StockAlarm,
  type StockMovement,
  type StockMovementKind,
  type StockReason,
  type StockRules,
} from "@cuentalibre/core";
import type { Product } from "@cuentalibre/contracts";
import type { Option } from "@/features/sales/sales-model";

export const CATALOG_PATH = "/catalogo";
export const PRODUCTS_PATH = "/catalogo/productos";
export const NEW_PRODUCT_PATH = "/catalogo/productos/nuevo";
export const STOCK_PATH = "/catalogo/regularizar-stock";
export const CATALOG_IMPORT_PATH = "/catalogo/importar";
export const CATALOG_EXPORT_PATH = "/catalogo/exportar";
export const CATALOG_SETTINGS_PATH = "/configuracion/catalogo";

export const productPath = (id: string) => `${PRODUCTS_PATH}/${id}`;

/** "No definido" in selects; Radix Select can't hold an empty value. */
export const NO_UNIT = "none";

export const UNIT_OPTIONS: Option[] = [
  { value: NO_UNIT, label: "- No definido -" },
  ...CATALOG_UNITS.map(([code, name]) => ({ value: code, label: `${code} (${name})` })),
];

/** Short unit after a quantity: "12 h", "300 uds". */
export const unitLabel = (product: Pick<Product, "unit">) => product.unit ?? "";

export const REASONS: Record<StockReason, string> = {
  undefined: "No definido",
  loss: "Pérdida",
  found: "Encontrado",
  purchase: "Compra",
  sale: "Venta",
  supplierReturn: "Devolución a proveedor",
  settings: "Configuración",
};

/** Reasons offered when regularizing by hand; "Configuración" is set by the program. */
export const MANUAL_REASONS: StockReason[] = ["undefined", "loss", "found", "purchase", "sale", "supplierReturn"];

const AUTOMATIC: Record<Exclude<StockMovementKind, "manual">, string> = {
  invoice: "Factura",
  deliveryNote: "Albarán",
  initial: "Stock inicial",
  import: "Importación",
  settings: "Configuración",
  deleted: "Producto eliminado",
};

/** "Automático/Factura", "Manual/Pérdida". */
export function movementType(m: Pick<StockMovement, "kind" | "reason">): { group: string; label: string } {
  return m.kind === "manual"
    ? { group: "Manual", label: REASONS[m.reason ?? "undefined"] }
    : { group: "Automático", label: AUTOMATIC[m.kind] };
}

/** Values of the movement type filter: everything, a whole group, or one type. */
export const MOVEMENT_FILTERS: { value: string; label: string; test: (m: StockMovement) => boolean }[] = [
  { value: "all", label: "Todos", test: () => true },
  { value: "auto", label: "Todos los tipos automáticos", test: (m) => m.kind !== "manual" },
  ...(Object.keys(AUTOMATIC) as Exclude<StockMovementKind, "manual">[]).map((kind) => ({
    value: `auto:${kind}`,
    label: `Automático/${AUTOMATIC[kind]}`,
    test: (m: StockMovement) => m.kind === kind,
  })),
  { value: "manual", label: "Todos los tipos manuales", test: (m) => m.kind === "manual" },
  ...(["loss", "found", "purchase", "sale", "supplierReturn", "settings", "undefined"] as StockReason[]).map(
    (reason) => ({
      value: `manual:${reason}`,
      label: `Manual/${REASONS[reason]}`,
      test: (m: StockMovement) => m.kind === "manual" && (m.reason ?? "undefined") === reason,
    }),
  ),
];

export const RULE_OPTIONS: { [K in keyof StockRules]: Option<StockRules[K]>[] } = {
  invoices: [
    { value: "never", label: "Nunca" },
    { value: "createEdit", label: "Al crear/editar una factura" },
  ],
  deliveryNotes: [
    { value: "never", label: "Nunca" },
    { value: "createEdit", label: "Al crear/editar un albarán" },
    { value: "invoice", label: "Al facturar un albarán" },
  ],
  quotes: [
    { value: "never", label: "Nunca" },
    { value: "deliveryNote", label: "Al albaranar un presupuesto" },
    { value: "invoice", label: "Al facturar un presupuesto" },
  ],
  drafts: [
    { value: "never", label: "Nunca" },
    { value: "invoice", label: "Al facturar una factura borrador" },
  ],
};

/** Whether any kind of document moves stock; until then stock only changes by hand. */
export const rulesActive = (rules: StockRules) => Object.values(rules).some((r) => r !== "never");

/** "Servicios › Diseño web", or "" without a family. */
export const familyLabel = (families: readonly CatalogFamily[], id: string | null) =>
  familyPath(families, id).join(" › ");

/** Stock and alarm of a product with stock control; null for the others. */
export function productStock(
  product: Product,
  movements: readonly StockMovement[],
): { stock: number; alarm: StockAlarm | null } | null {
  if (!product.stock) return null;
  const stock = stockOf(movements, product.id);
  return { stock, alarm: product.stock.alarm ? stockAlarm(stock, product.stock.alarm.minUnits) : null };
}

/** Quantity with decimal comma and no trailing zeros: "1.000", "2,5". */
export const formatQuantity = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 4 });

/** Concept text of a document line made from a product, as the catalog settings say. */
export const conceptFor = (product: Product, conceptText: "name" | "codeAndName") =>
  conceptText === "codeAndName" && product.sku ? `${product.sku} - ${product.name}` : product.name;

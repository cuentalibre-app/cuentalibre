import {
  familyPath,
  isCatalogUnit,
  newId,
  parseAmount,
  parsePercent,
  parseYesNo,
  resolveFamilyPath,
  stockOf,
  surchargeFitsVat,
  surchargeRateFromPercent,
  vatRateFromPercent,
  type CatalogFamily,
  type StockMovement,
} from "@fiscalia/core";
import type { Product } from "@fiscalia/contracts";
import type { Cell, Sheet } from "@/lib/xlsx";
import { catalogStore, type CatalogState } from "./catalog-store";

/*
 * Catalog import and export with Contasimple's columns, so a catalog exported
 * there (or its sample filled in by hand) comes in as-is. A row whose product
 * code already exists updates that product instead of adding a new one.
 */

export const PRODUCT_COLUMNS = [
  "Familia/Subfamilia",
  "Nombre",
  "Descripción",
  "Notas privadas",
  "Tipo de unidad",
  "Visible (activo)",
  "Código de producto",
  "Referencia proveedor",
  "Precio venta - Base imponible",
  "Precio venta - % Descuento",
  "Precio venta - % IVA",
  "Precio venta - % RE",
  "Coste adquisición - Base imponible",
  "Coste adquisición - % IVA",
  "Coste adquisición - % RE",
  "Personalizado1",
  "Personalizado2",
  "Personalizado3",
  "Personalizado4",
];

export const STOCK_COLUMNS = [
  "Controlar stock",
  "Stock absoluto",
  "Stock relativo",
  "Permitir vender sin stock",
  "Activar alarma de stock",
  "Avisar cuando el número de unidades sea inferior a",
  "Avisar en el Dashboard",
  "Avisar mediante notificación",
  "Avisar mediante correo electrónico",
];

export type CatalogImportKind = "products" | "productsStock";

export const IMPORT_KIND_OPTIONS: { value: CatalogImportKind; label: string }[] = [
  { value: "products", label: "Productos o servicios de catálogo" },
  { value: "productsStock", label: "Productos o servicios de catálogo con control de stock" },
];

const SAMPLE: Cell[] = [
  "Familia1|Familia2|Familia3",
  "Nombre del producto",
  "Descripción del producto",
  "Anotaciones del producto",
  "",
  "Sí",
  "",
  "",
  50,
  0,
  21,
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
];

/** The sample workbook: a filled-in row and a legend sheet, like Contasimple's. */
export function sampleSheets(kind: CatalogImportKind): Sheet[] {
  const stock = kind === "productsStock";
  const legend: Cell[][] = [
    [
      "Familia/Subfamilia",
      "Familia y subfamilias separadas por «|». Ejemplo: Familia1|Familia2|Familia3. Vacío: sin familia.",
      "No",
    ],
    ["Nombre", "Nombre del producto. Hasta 2.048 caracteres.", "Sí"],
    ["Descripción", "Descripción del producto. Hasta 4.096 caracteres.", "No"],
    ["Notas privadas", "Notas que no se muestran en las facturas. Hasta 4.096 caracteres.", "No"],
    [
      "Tipo de unidad",
      "uds, dec, cent, mill, mg, g, kg, t, ml, cl, dl, l, m3, min, h, d, 1/2d, jornadas, 1/2j, semana, mes, trimestre, semestre, año, letra, palabra, frase, página, mm, cm, m, km",
      "No",
    ],
    ["Visible (activo)", "Sí o No. Vacío: visible.", "No"],
    [
      "Código de producto",
      "Código (SKU) único. Si ya existe en el catálogo, se actualiza ese producto. Hasta 128 caracteres.",
      stock ? "Sí, con control de stock" : "No",
    ],
    ["Referencia proveedor", "Código del producto de tu proveedor. Hasta 128 caracteres.", "No"],
    ["Precio venta - Base imponible", "Número positivo o negativo.", "Sí"],
    ["Precio venta - % Descuento", "Entre 0 y 100, sin el símbolo %. Vacío: sin descuento.", "No"],
    ["Precio venta - % IVA", "21, 18, 16, 10, 8, 7,5, 7, 5, 4, 2 o 0.", "Sí"],
    ["Precio venta - % RE", "5,2, 1,75, 1,4, 1, 0,62, 0,5, 0,26 o 0.", "No"],
    ["Coste adquisición - Base imponible", "Coste de adquisición más transporte, aduanas…", "No"],
    ["Coste adquisición - % IVA", "21, 18, 16, 10, 8, 7,5, 7, 5, 4, 2 o 0.", "No"],
    ["Coste adquisición - % RE", "5,2, 1,75, 1,4, 1, 0,62, 0,5, 0,26 o 0.", "No"],
    ...(stock
      ? [
          ["Controlar stock", "Sí o No. Vacío: el valor por defecto de la configuración del catálogo.", "No"],
          [
            "Stock absoluto",
            "Stock inicial de un producto nuevo, o el stock que pasa a tener uno existente. Deja vacío el stock relativo.",
            "No",
          ],
          ["Stock relativo", "Unidades que se suman (o restan, en negativo) al stock de un producto existente.", "No"],
          ["Permitir vender sin stock", "Sí o No. Vacío: el valor por defecto.", "No"],
          ["Activar alarma de stock", "Sí o No. Con Sí, activa al menos una forma de aviso.", "No"],
          ["Avisar cuando el número de unidades sea inferior a", "Unidades mínimas antes de avisar.", "No"],
          ["Avisar en el Dashboard", "Sí o No.", "No"],
          ["Avisar mediante notificación", "Sí o No.", "No"],
          ["Avisar mediante correo electrónico", "Sí o No.", "No"],
        ]
      : []),
  ];
  return [
    {
      name: "Catálogo",
      header: stock ? [...PRODUCT_COLUMNS, ...STOCK_COLUMNS] : PRODUCT_COLUMNS,
      rows: [stock ? [...SAMPLE, "No", "", "", "No", "No", "", "No", "No", "No"] : SAMPLE],
    },
    { name: "Leyenda", header: ["Campo", "Valores permitidos", "Obligatorio"], rows: legend },
  ];
}

/* Export */

const pct = (fraction: number) => Math.round(fraction * 10_000) / 100;
const yesNo = (b: boolean) => (b ? "Sí" : "No");

export function catalogSheet(state: Pick<CatalogState, "products" | "families" | "movements" | "settings">): Sheet {
  const names = state.settings.customFieldNames;
  return {
    name: "Catálogo",
    header: [...PRODUCT_COLUMNS.slice(0, 15), ...names, ...STOCK_COLUMNS.filter((c) => c !== "Stock relativo")],
    rows: [...state.products]
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((p) => {
        const alarm = p.stock?.alarm;
        return [
          familyPath(state.families, p.familyId).join("|"),
          p.name,
          p.description,
          p.privateNotes,
          p.unit ?? "",
          yesNo(p.active),
          p.sku,
          p.supplierRef,
          p.price,
          pct(p.discount),
          pct(p.vatRate),
          pct(p.surchargeRate),
          p.cost,
          p.cost === null ? null : pct(p.costVatRate),
          p.cost === null ? null : pct(p.costSurchargeRate),
          ...p.custom,
          yesNo(!!p.stock),
          p.stock ? stockOf(state.movements, p.id) : null,
          p.stock ? yesNo(p.stock.allowWithoutStock) : "",
          p.stock ? yesNo(!!alarm) : "",
          alarm ? alarm.minUnits : null,
          alarm ? yesNo(alarm.dashboard) : "",
          alarm ? yesNo(alarm.notification) : "",
          alarm ? yesNo(alarm.email) : "",
        ];
      }),
  };
}

/* Import */

const norm = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export interface CatalogImportRow {
  /** Spreadsheet row number (1 is the header). */
  row: number;
  name: string;
  sku: string;
  price: number | null;
  /** Updates the product with the same code. */
  updates: boolean;
  /** Stock change it makes, if any. */
  stockChange: number | null;
  errors: string[];
  warnings: string[];
  product?: Product;
  /** Family path to resolve when committing. */
  familyNames: string[];
  /** Absolute stock to set, or relative units to add, for products with stock control. */
  stock?: { absolute: number | null; relative: number | null };
}

export interface CatalogImportPreview {
  kind: CatalogImportKind;
  rows: CatalogImportRow[];
  fileErrors: string[];
  newFamilies: number;
}

const MAX_TEXT = { name: 2048, long: 4096, code: 128 };

export function previewCatalogImport(kind: CatalogImportKind, table: string[][]): CatalogImportPreview {
  const [header = [], ...body] = table;
  const index = new Map(header.map((h, i) => [norm(h), i] as const));
  const has = (column: string) => index.has(norm(column));
  const { products, families, settings } = catalogStore.get();
  // Custom fields may come under the names set in the catalog settings
  const customColumns = PRODUCT_COLUMNS.slice(15).map((c, i) => (has(c) ? c : (settings.customFieldNames[i] ?? c)));
  const get = (row: string[], column: string) => {
    const i = index.get(norm(column));
    return i === undefined ? "" : (row[i] ?? "").trim();
  };

  const missing = ["Nombre", "Precio venta - Base imponible", "Precio venta - % IVA"].filter((c) => !has(c));
  if (missing.length)
    return {
      kind,
      rows: [],
      newFamilies: 0,
      fileErrors: [
        `Faltan columnas obligatorias: ${missing.join(", ")}. Descarga el Excel de ejemplo para ver el formato.`,
      ],
    };

  const withStock = kind === "productsStock";
  const seenSku = new Map<string, number>();
  const familyKeys = new Set(families.map((f) => familyPath(families, f.id).map(norm).join("|")));
  const newFamilyKeys = new Set<string>();
  const defaults = settings.defaults;

  const rows = body.flatMap((cells, i): CatalogImportRow[] => {
    if (cells.every((c) => !String(c ?? "").trim())) return [];
    const rowNo = i + 2;
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = get(cells, "Nombre");
    const sku = get(cells, "Código de producto");
    const existing = sku ? products.find((p) => p.sku.toLowerCase() === sku.toLowerCase()) : undefined;

    if (!name) errors.push("Falta el nombre.");
    else if (name.length > MAX_TEXT.name) errors.push("El nombre supera los 2.048 caracteres.");
    if (sku.length > MAX_TEXT.code) errors.push("El código de producto supera los 128 caracteres.");
    if (sku) {
      const key = sku.toLowerCase();
      if (seenSku.has(key)) errors.push(`El código ${sku} ya aparece en la fila ${seenSku.get(key)}.`);
      else seenSku.set(key, rowNo);
    }
    const description = get(cells, "Descripción");
    const privateNotes = get(cells, "Notas privadas");
    if (description.length > MAX_TEXT.long || privateNotes.length > MAX_TEXT.long)
      errors.push("La descripción o las notas superan los 4.096 caracteres.");
    const supplierRef = get(cells, "Referencia proveedor");
    if (supplierRef.length > MAX_TEXT.code) errors.push("La referencia del proveedor supera los 128 caracteres.");

    const unitText = get(cells, "Tipo de unidad");
    const unit = unitText ? (isCatalogUnit(unitText) ? unitText : undefined) : null;
    if (unit === undefined) errors.push(`Tipo de unidad desconocido: «${unitText}».`);

    const visible = parseYesNo(get(cells, "Visible (activo)"));
    if (visible === undefined) errors.push("«Visible (activo)» debe ser Sí o No.");

    const priceText = get(cells, "Precio venta - Base imponible");
    const price = parseAmount(priceText);
    if (!priceText) errors.push("Falta el precio de venta.");
    else if (price === null) errors.push(`Precio de venta no válido: «${priceText}».`);

    const discountText = get(cells, "Precio venta - % Descuento");
    const discount = discountText ? parsePercent(discountText) : 0;
    if (discount === null || discount < 0 || discount > 100) errors.push("El descuento debe estar entre 0 y 100.");

    const rate = (column: string, required: boolean, fallback: number, parse: (p: number) => number | null) => {
      const text = get(cells, column);
      if (!text) {
        if (required) errors.push(`Falta «${column}».`);
        return fallback;
      }
      const percent = parsePercent(text);
      const value = percent === null ? null : parse(percent);
      if (value === null) {
        errors.push(`«${column}» no es un tipo válido: ${text}.`);
        return fallback;
      }
      return value;
    };
    const vatRate = rate("Precio venta - % IVA", true, 0.21, vatRateFromPercent);
    const surchargeRate = rate("Precio venta - % RE", false, 0, surchargeRateFromPercent);
    if (!surchargeFitsVat(vatRate, surchargeRate)) errors.push("El recargo de venta no corresponde a su tipo de IVA.");

    const costText = get(cells, "Coste adquisición - Base imponible");
    const cost = costText ? parseAmount(costText) : null;
    if (costText && cost === null) errors.push(`Coste no válido: «${costText}».`);
    const costVatRate = rate("Coste adquisición - % IVA", false, 0.21, vatRateFromPercent);
    const costSurchargeRate = rate("Coste adquisición - % RE", false, 0, surchargeRateFromPercent);
    if (!surchargeFitsVat(costVatRate, costSurchargeRate))
      errors.push("El recargo del coste no corresponde a su tipo de IVA.");

    const familyNames = get(cells, "Familia/Subfamilia")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    for (let depth = 1; depth <= familyNames.length; depth++) {
      const key = familyNames.slice(0, depth).map(norm).join("|");
      if (!familyKeys.has(key)) newFamilyKeys.add(key);
    }

    let stock: Product["stock"] = existing?.stock ?? null;
    let stockSpec: CatalogImportRow["stock"];
    let stockChange: number | null = null;
    if (withStock) {
      const yn = (column: string, fallback: boolean) => {
        const v = parseYesNo(get(cells, column));
        if (v === undefined) errors.push(`«${column}» debe ser Sí o No.`);
        return v ?? fallback;
      };
      const enabled = yn("Controlar stock", existing ? !!existing.stock : defaults.enabled);
      const absText = get(cells, "Stock absoluto");
      const relText = get(cells, "Stock relativo");
      const absolute = absText ? parseAmount(absText) : null;
      const relative = relText ? parseAmount(relText) : null;
      if (absText && absolute === null) errors.push(`Stock absoluto no válido: «${absText}».`);
      if (relText && relative === null) errors.push(`Stock relativo no válido: «${relText}».`);
      if (enabled) {
        if (!sku) errors.push("Con control de stock el código de producto es obligatorio.");
        if (absText && relText) errors.push("Rellena el stock absoluto o el relativo, no los dos.");
        if (relText && !existing?.stock)
          errors.push("El stock relativo solo sirve para productos que ya tienen control de stock.");
        const alarmOn = yn("Activar alarma de stock", existing?.stock ? !!existing.stock.alarm : defaults.alarmOn);
        const base = existing?.stock?.alarm ?? defaults.alarm;
        const minText = get(cells, "Avisar cuando el número de unidades sea inferior a");
        const minUnits = minText ? parseAmount(minText) : (base?.minUnits ?? 0);
        if (minText && minUnits === null) errors.push(`Unidades mínimas no válidas: «${minText}».`);
        const alarm = alarmOn
          ? {
              minUnits: minUnits ?? 0,
              dashboard: yn("Avisar en el Dashboard", base?.dashboard ?? false),
              notification: yn("Avisar mediante notificación", base?.notification ?? false),
              email: yn("Avisar mediante correo electrónico", base?.email ?? false),
            }
          : null;
        if (alarm && !alarm.dashboard && !alarm.notification && !alarm.email)
          errors.push("Con la alarma de stock activada, elige al menos una forma de aviso.");
        if (alarm?.email && !settings.alarmEmail)
          warnings.push("Falta el email de avisos de stock en la configuración del catálogo.");
        stock = {
          allowWithoutStock: yn(
            "Permitir vender sin stock",
            existing?.stock?.allowWithoutStock ?? defaults.allowWithoutStock,
          ),
          alarm,
        };
        stockSpec = { absolute, relative };
        const current = existing?.stock ? stockOf(catalogStore.get().movements, existing.id) : 0;
        stockChange = absolute !== null ? absolute - current : relative;
      } else {
        if (absText || relText) warnings.push("Sin control de stock, las columnas de stock no se usan.");
        stock = null;
      }
    }

    const product: Product | undefined =
      errors.length === 0
        ? {
            id: existing?.id ?? newId(),
            familyId: existing?.familyId ?? null,
            name,
            description,
            privateNotes,
            unit: unit ?? null,
            tags: existing?.tags ?? [],
            active: visible ?? true,
            sku,
            supplierRef,
            price: price!,
            discount: (discount ?? 0) / 100,
            vatRate,
            surchargeRate,
            cost,
            costVatRate,
            costSurchargeRate,
            custom: customColumns.map((c) => get(cells, c)) as Product["custom"],
            stock,
          }
        : undefined;

    return [
      {
        row: rowNo,
        name,
        sku,
        price,
        updates: !!existing,
        stockChange: stockChange || null,
        errors,
        warnings,
        product,
        familyNames,
        stock: stockSpec,
      },
    ];
  });

  return {
    kind,
    rows,
    newFamilies: newFamilyKeys.size,
    fileErrors: rows.length ? [] : ["El archivo no tiene ninguna fila con datos."],
  };
}

/** Adds the valid rows to the catalog. Returns how many products were created and updated. */
export function commitCatalogImport(preview: CatalogImportPreview): { created: number; updated: number } {
  const state = catalogStore.get();
  let families: CatalogFamily[] = [...state.families];
  const newFamilies: CatalogFamily[] = [];
  const products: Product[] = [];
  const movements: StockMovement[] = [];
  const at = new Date().toISOString().slice(0, 19);
  let created = 0;
  let updated = 0;

  for (const row of preview.rows) {
    if (!row.product) continue;
    const { id, created: made } = resolveFamilyPath(families, row.familyNames, () => newId());
    families = [...families, ...made];
    newFamilies.push(...made);
    const product = { ...row.product, familyId: row.familyNames.length ? id : row.product.familyId };
    products.push(product);
    if (row.updates) updated++;
    else created++;

    if (product.stock && row.stockChange)
      movements.push({
        id: newId(),
        productId: product.id,
        quantity: row.stockChange,
        at,
        kind: row.updates ? "import" : "initial",
      });
  }

  catalogStore.importProducts(products, movements, newFamilies);
  return { created, updated };
}

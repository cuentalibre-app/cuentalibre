import type { CatalogFamily, CatalogUnit, StockMovement, StockRules } from "@fiscalia/core";

/** Sample catalog until there is a backend: products and services, their families and stock. */

export interface StockAlarmSettings {
  /** Warn when fewer units than this are left. */
  minUnits: number;
  /** List the product on the home page. */
  dashboard: boolean;
  notification: boolean;
  email: boolean;
}

export interface StockControl {
  allowWithoutStock: boolean;
  /** Null when the alarm is off. */
  alarm: StockAlarmSettings | null;
}

export interface Product {
  id: string;
  familyId: string | null;
  name: string;
  /** Printed on documents when the settings ask for it. */
  description: string;
  /** Only visible in Fiscalia. */
  privateNotes: string;
  unit: CatalogUnit | null;
  tags: string[];
  /** Inactive products stay in the catalog but can't be picked in documents. */
  active: boolean;
  /** Own product code (SKU), unique in the catalog. */
  sku: string;
  supplierRef: string;
  /** Unit sale price before discount and taxes. */
  price: number;
  /** Fractions: 0.1 for 10 %. */
  discount: number;
  vatRate: number;
  surchargeRate: number;
  /** Unit acquisition cost before taxes, with transport and customs; null when unknown. */
  cost: number | null;
  costVatRate: number;
  costSurchargeRate: number;
  custom: [string, string, string, string];
  /** Null when its stock isn't counted. */
  stock: StockControl | null;
}

export type { CatalogFamily, StockMovement };

export interface CatalogSettings {
  customFieldNames: [string, string, string, string];
  /** What a document's concept gets when a product is picked. */
  conceptText: "name" | "codeAndName";
  /** Copy the product description into the concept's detailed description. */
  copyDescription: boolean;
  /** Where stock alarms are emailed. */
  alarmEmail: string;
  rules: StockRules;
  /** Put the stock back when an invoice or delivery note that took it is deleted. */
  restoreOnDeleteInvoice: boolean;
  restoreOnDeleteDeliveryNote: boolean;
  /** Stock options a new product starts with, and imports fall back to. */
  defaults: StockControl & { enabled: boolean; alarmOn: boolean };
}

export const initialCatalogSettings: CatalogSettings = {
  customFieldNames: ["Personalizado1", "Personalizado2", "Personalizado3", "Personalizado4"],
  conceptText: "name",
  copyDescription: false,
  alarmEmail: "",
  rules: { invoices: "never", deliveryNotes: "never", quotes: "never", drafts: "never" },
  restoreOnDeleteInvoice: false,
  restoreOnDeleteDeliveryNote: false,
  defaults: {
    enabled: false,
    allowWithoutStock: false,
    alarmOn: false,
    alarm: { minUnits: 0, dashboard: false, notification: false, email: false },
  },
};

export const initialFamilies: CatalogFamily[] = [
  { id: "f1", name: "Servicios", parentId: null },
  { id: "f2", name: "Diseño web", parentId: "f1" },
  { id: "f3", name: "Consultoría", parentId: "f1" },
  { id: "f4", name: "Fotografía", parentId: "f1" },
  { id: "f5", name: "Impresión", parentId: null },
];

const NO_CUSTOM: Product["custom"] = ["", "", "", ""];

const service = (
  id: string,
  familyId: string,
  name: string,
  price: number,
  unit: CatalogUnit | null,
  extra: Partial<Product> = {},
): Product => ({
  id,
  familyId,
  name,
  description: "",
  privateNotes: "",
  unit,
  tags: [],
  active: true,
  sku: "",
  supplierRef: "",
  price,
  discount: 0,
  vatRate: 0.21,
  surchargeRate: 0,
  cost: null,
  costVatRate: 0.21,
  costSurchargeRate: 0,
  custom: NO_CUSTOM,
  stock: null,
  ...extra,
});

export const initialProducts: Product[] = [
  service("p1", "f3", "Hora de consultoría", 65, "h", { sku: "CONS-H", tags: ["Recurrente"] }),
  service("p2", "f2", "Diseño y mantenimiento web · cuota mensual", 2_400, "mes", {
    sku: "WEB-MANT",
    description: "Hosting, copias de seguridad, actualizaciones y hasta 10 horas de cambios al mes.",
    tags: ["Recurrente"],
  }),
  service("p3", "f4", "Fotografía de producto (unidad)", 45, "uds", { sku: "FOTO-U" }),
  service("p4", "f2", "Landing page", 1_900, null, {
    sku: "WEB-LAND",
    description: "Diseño y maquetación de una página de aterrizaje con formulario de contacto.",
  }),
  service("p5", "f5", "Catálogos impresos", 3.5, "uds", {
    sku: "IMP-CAT",
    supplierRef: "GRF-A4-24P",
    cost: 1.2,
    privateNotes: "Imprenta Gráficas del Norte; pedido mínimo 500.",
    stock: { allowWithoutStock: false, alarm: { minUnits: 100, dashboard: true, notification: true, email: false } },
  }),
  service("p6", "f5", "Tarjetas de visita (caja de 500)", 28, "uds", {
    sku: "IMP-TARJ",
    supplierRef: "GRF-TV-500",
    discount: 0.05,
    cost: 11.5,
    stock: { allowWithoutStock: true, alarm: { minUnits: 10, dashboard: true, notification: false, email: false } },
  }),
  service("p7", "f2", "Diseño de logotipo", 600, null, { sku: "WEB-LOGO", active: false }),
];

export const initialMovements: StockMovement[] = [
  { id: "m1", productId: "p5", quantity: 1_000, at: "2026-01-10T09:00:00", kind: "initial" },
  {
    id: "m2",
    productId: "p5",
    quantity: -300,
    at: "2026-09-08T12:30:00",
    kind: "manual",
    reason: "sale",
    comments: "Albarán AL-2026-0003",
  },
  {
    id: "m3",
    productId: "p5",
    quantity: -12,
    at: "2026-09-20T17:10:00",
    kind: "manual",
    reason: "loss",
    comments: "Cajas dañadas en el transporte",
  },
  { id: "m4", productId: "p6", quantity: 20, at: "2026-02-01T10:00:00", kind: "initial" },
  { id: "m5", productId: "p6", quantity: -14, at: "2026-06-15T11:00:00", kind: "manual", reason: "sale" },
];

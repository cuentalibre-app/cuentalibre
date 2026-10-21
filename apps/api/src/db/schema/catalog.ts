import type { StockControl } from "@cuentalibre/contracts";
import type { CatalogUnit, StockMovement } from "@cuentalibre/core";
import {
  boolean,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { createdAt, updatedAt } from "./columns";

/* The catalog: families, products and stock movements. Deleted with a tombstone. */

const tenant = () =>
  uuid()
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: timestamp({ withTimezone: true }),
});

/** Euros or units, with up to six decimals. */
const decimal = () => numeric({ precision: 18, scale: 6, mode: "number" });
/** Fractions: 0.21 is 21 %. */
const fraction = () => numeric({ precision: 9, scale: 6, mode: "number" });
const taxRate = () => numeric({ precision: 6, scale: 4, mode: "number" });

export const catalogFamily = pgTable(
  "catalog_family",
  {
    organizationId: tenant(),
    id: uuid().notNull(),
    name: text().notNull(),
    parentId: uuid(),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.id] }),
    foreignKey({ columns: [table.organizationId, table.parentId], foreignColumns: [table.organizationId, table.id] }),
  ],
);

export const product = pgTable(
  "product",
  {
    organizationId: tenant(),
    id: uuid().notNull(),
    familyId: uuid(),
    name: text().notNull(),
    description: text().notNull(),
    privateNotes: text().notNull(),
    unit: text().$type<CatalogUnit>(),
    /** Tag IDs. */
    tags: text().array().notNull(),
    active: boolean().notNull(),
    sku: text().notNull(),
    supplierRef: text().notNull(),
    price: decimal().notNull(),
    discount: fraction().notNull(),
    vatRate: taxRate().notNull(),
    surchargeRate: taxRate().notNull(),
    cost: decimal(),
    costVatRate: taxRate().notNull(),
    costSurchargeRate: taxRate().notNull(),
    /** The four custom fields. */
    custom: text().array().notNull(),
    /** Null when its stock isn't counted. */
    stock: jsonb().$type<StockControl>(),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.id] }),
    foreignKey({
      columns: [table.organizationId, table.familyId],
      foreignColumns: [catalogFamily.organizationId, catalogFamily.id],
    }),
  ],
);

export const stockMovement = pgTable(
  "stock_movement",
  {
    organizationId: tenant(),
    id: uuid().notNull(),
    productId: uuid().notNull(),
    /** Signed units: positive in, negative out. */
    quantity: decimal().notNull(),
    /** Local date and time as the client wrote it, "2026-10-17T19:29:05". */
    at: text().notNull(),
    kind: text().$type<StockMovement["kind"]>().notNull(),
    reason: text().$type<NonNullable<StockMovement["reason"]>>(),
    comments: text(),
    /** The sales document that moved the stock, if any. */
    documentId: uuid(),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.id] }),
    foreignKey({
      columns: [table.organizationId, table.productId],
      foreignColumns: [product.organizationId, product.id],
    }),
    index().on(table.organizationId, table.productId),
  ],
);

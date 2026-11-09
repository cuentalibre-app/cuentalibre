import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ArrowRightLeft,
  Copy,
  Download,
  FileDown,
  FileUp,
  Filter,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { eurosToCents, familyWithDescendants, stockLevel, type Cents, type StockAlarm } from "@cuentalibre/core";
import type { Product } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { DropdownMenuTrigger } from "@cuentalibre/ui/components/dropdown-menu";
import { Input, SearchField } from "@cuentalibre/ui/components/input";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { Page, PageHeader, Toolbar } from "@/components/page";
import { GroupedSelect, Help } from "@/features/sales/form-fields";
import { ActionsMenu, EmptyState, IconAction, MoreActionsTrigger, SortHeader, type Action } from "@/features/sales/list-parts";
import { VAT_RATE_OPTIONS, ratePercent } from "@/features/sales/sales-model";
import { TagChips } from "@/features/settings/tag-chip";
import { parseDecimal } from "@/lib/format";
import {
  CATALOG_EXPORT_PATH,
  CATALOG_IMPORT_PATH,
  CATALOG_SETTINGS_PATH,
  NEW_PRODUCT_PATH,
  STOCK_PATH,
  familyLabel,
  formatQuantity,
  productPath,
  productStock,
} from "./catalog-model";
import { catalogStore, useCatalog } from "./catalog-store";

const ALL = "all";

interface Row {
  product: Product;
  family: string;
  /** Unit price after the discount. */
  discounted: Cents;
  stock: number | null;
  alarm: StockAlarm | null;
}

interface Filters {
  query: string;
  status: "all" | "active" | "inactive";
  family: string;
  priceFrom: string;
  priceTo: string;
  vat: string;
  stockFrom: string;
  stockTo: string;
  level: "all" | "negative" | "zero" | "positive";
  alarm: "all" | "out" | "low" | "lowOrOut" | "ok";
  tag: string;
}

const NO_FILTERS: Filters = {
  query: "",
  status: ALL,
  family: ALL,
  priceFrom: "",
  priceTo: "",
  vat: ALL,
  stockFrom: "",
  stockTo: "",
  level: ALL,
  alarm: ALL,
  tag: ALL,
};

const LEVEL_OPTIONS = [
  { value: ALL, label: "Todos los productos (con y sin control de stock)" },
  { value: "negative", label: "Stock a deber (negativo)" },
  { value: "zero", label: "Stock agotado (cero)" },
  { value: "positive", label: "Con stock" },
];

const ALARM_OPTIONS = [
  { value: ALL, label: "Todos los productos (con y sin control de stock)" },
  { value: "out", label: "Alarma stock agotado" },
  { value: "low", label: "Alarma stock bajo" },
  { value: "lowOrOut", label: "Alarma stock bajo + stock agotado" },
  { value: "ok", label: "Stock mayor o igual a las unidades mínimas de alarma" },
];

function between(value: number, from: string, to: string): boolean {
  const min = parseDecimal(from);
  const max = parseDecimal(to);
  return (min === null || value >= min) && (max === null || value <= max);
}

function matches(r: Row, f: Filters, familyIds: Set<string> | null): boolean {
  const p = r.product;
  const q = f.query.trim().toLowerCase();
  const stockFiltered = f.stockFrom.trim() || f.stockTo.trim() || f.level !== ALL || f.alarm !== ALL;
  if (stockFiltered && r.stock === null) return false;
  return (
    (f.status === ALL || p.active === (f.status === "active")) &&
    (!familyIds || (p.familyId !== null && familyIds.has(p.familyId))) &&
    between(p.price, f.priceFrom, f.priceTo) &&
    (f.vat === ALL || String(p.vatRate) === f.vat) &&
    (r.stock === null || between(r.stock, f.stockFrom, f.stockTo)) &&
    (f.level === ALL || (r.stock !== null && stockLevel(r.stock) === f.level)) &&
    (f.alarm === ALL || (f.alarm === "lowOrOut" ? r.alarm === "low" || r.alarm === "out" : r.alarm === f.alarm)) &&
    (f.tag === ALL || p.tags.includes(f.tag)) &&
    (!q ||
      [p.name, p.sku, p.supplierRef, p.description, r.family, ...p.custom]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q)))
  );
}

export function CatalogListPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { products, families, movements } = useCatalog();
  const [filters, setFilters] = useState<Filters>(() =>
    params.get("alarma") ? { ...NO_FILTERS, alarm: "lowOrOut" } : NO_FILTERS,
  );
  const [showFilters, setShowFilters] = useState(() => params.has("alarma"));
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);

  const allRows = useMemo(
    () =>
      products.map((product): Row => {
        const stock = productStock(product, movements);
        return {
          product,
          family: familyLabel(families, product.familyId),
          discounted: eurosToCents(product.price * (1 - product.discount)),
          stock: stock?.stock ?? null,
          alarm: stock?.alarm ?? null,
        };
      }),
    [products, families, movements],
  );

  const rows = useMemo(() => {
    const familyIds = filters.family === ALL ? null : familyWithDescendants(families, filters.family);
    return sortRows(
      allRows.filter((r) => matches(r, filters, familyIds)),
      sort,
    );
  }, [allRows, filters, sort, families]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const extraFilters = (Object.keys(NO_FILTERS) as (keyof Filters)[]).filter(
    (k) => k !== "query" && filters[k] !== NO_FILTERS[k],
  ).length;
  const filtered = extraFilters > 0 || filters.query.trim() !== "";
  const tags = [...new Set(products.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b, "es"));
  const familyOptions = families
    .map((f) => ({ value: f.id, label: familyLabel(families, f.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));

  const options: Action[][] = [
    [
      { label: "Importar productos", icon: FileUp, run: () => navigate(CATALOG_IMPORT_PATH) },
      { label: "Exportar catálogo", icon: FileDown, run: () => navigate(CATALOG_EXPORT_PATH) },
    ],
    [
      { label: "Configuración del catálogo", icon: Settings, run: () => navigate(CATALOG_SETTINGS_PATH) },
      {
        label: "Borrar elementos del catálogo",
        icon: Trash2,
        danger: true,
        run: () => navigate(`${CATALOG_SETTINGS_PATH}#borrar-catalogo`),
      },
    ],
  ];

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <PageHeader
          title="Catálogo de productos y servicios"
          description="Da de alta lo que facturas a menudo para crear facturas, presupuestos y albaranes más rápido."
          actions={
            <>
              <ActionsMenu
                groups={options}
                trigger={
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" aria-label="Opciones del catálogo">
                      <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                }
              />
              <Link to={NEW_PRODUCT_PATH} className={buttonVariants()}>
                <Plus strokeWidth={2} aria-hidden="true" />
                <span className="hidden sm:inline">Nuevo producto o servicio</span>
                <span className="sm:hidden">Nuevo</span>
              </Link>
            </>
          }
        />

        <section
          aria-label="Listado de productos"
          className="flex animate-rise-in flex-col lg:overflow-hidden lg:surface"
          style={{ "--i": 1 } as CSSProperties}
        >
          <Toolbar>
            <SearchField
              value={filters.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Buscar por nombre, código, familia o descripción"
              aria-label="Buscar"
            />
            <Button
              variant="secondary"
              aria-expanded={showFilters}
              aria-controls="catalog-filters"
              onClick={() => setShowFilters((s) => !s)}
            >
              <Filter strokeWidth={1.8} aria-hidden="true" />
              Filtros
              {extraFilters > 0 && (
                <span className="flex size-5 items-center justify-center rounded-sm bg-primary text-2xs font-semibold text-primary-foreground">
                  {extraFilters}
                </span>
              )}
            </Button>
            <Link to={CATALOG_EXPORT_PATH} className={cn(buttonVariants({ variant: "secondary" }), "lg:ml-auto")}>
              <Download strokeWidth={1.8} aria-hidden="true" />
              Exportar
            </Link>
          </Toolbar>

          {showFilters && (
            <div
              id="catalog-filters"
              className="grid animate-fade-in gap-3 border-y border-border bg-muted/50 py-3 sm:grid-cols-2 lg:grid-cols-4 lg:px-4"
            >
              <FilterField label="Por estado">
                <GroupedSelect
                  id="filter-status"
                  value={filters.status}
                  onChange={(v) => set("status", v as Filters["status"])}
                  groups={[
                    {
                      options: [
                        { value: ALL, label: "Todos" },
                        { value: "active", label: "Activo" },
                        { value: "inactive", label: "Inactivo" },
                      ],
                    },
                  ]}
                />
              </FilterField>
              <FilterField label="Por familia">
                <GroupedSelect
                  id="filter-family"
                  value={filters.family}
                  onChange={(v) => set("family", v)}
                  disabled={families.length === 0}
                  groups={[{ options: [{ value: ALL, label: "Todas" }, ...familyOptions] }]}
                />
              </FilterField>
              <FilterField label="Por IVA">
                <GroupedSelect
                  id="filter-vat"
                  value={filters.vat}
                  onChange={(v) => set("vat", v)}
                  groups={[{ options: [{ value: ALL, label: "Todos" }, ...VAT_RATE_OPTIONS] }]}
                />
              </FilterField>
              <FilterField label="Por etiqueta">
                <GroupedSelect
                  id="filter-tag"
                  value={filters.tag}
                  onChange={(v) => set("tag", v)}
                  disabled={tags.length === 0}
                  groups={[
                    {
                      options: [
                        { value: ALL, label: tags.length ? "Todas" : "Sin etiquetas" },
                        ...tags.map((t) => ({ value: t, label: t })),
                      ],
                    },
                  ]}
                />
              </FilterField>
              <RangeField
                label="Por precio"
                from={filters.priceFrom}
                to={filters.priceTo}
                onFrom={(v) => set("priceFrom", v)}
                onTo={(v) => set("priceTo", v)}
              />
              <RangeField
                label="Por rango de stock"
                help="Solo productos con control de stock, con un stock entre estas unidades."
                from={filters.stockFrom}
                to={filters.stockTo}
                onFrom={(v) => set("stockFrom", v)}
                onTo={(v) => set("stockTo", v)}
              />
              <FilterField label="Por nivel de stock" help="Muestra los productos según su stock actual.">
                <GroupedSelect
                  id="filter-level"
                  value={filters.level}
                  onChange={(v) => set("level", v as Filters["level"])}
                  groups={[{ options: LEVEL_OPTIONS }]}
                />
              </FilterField>
              <FilterField
                label="Por alarma de stock"
                help="Muestra los productos con alarma según su stock comparado con las unidades mínimas de la alarma."
              >
                <GroupedSelect
                  id="filter-alarm"
                  value={filters.alarm}
                  onChange={(v) => set("alarm", v as Filters["alarm"])}
                  groups={[{ options: ALARM_OPTIONS }]}
                />
              </FilterField>
              <Button
                variant="secondary"
                onClick={() => setFilters((f) => ({ ...NO_FILTERS, query: f.query }))}
                className="justify-self-start sm:col-span-2 lg:col-span-4"
              >
                <X strokeWidth={1.8} aria-hidden="true" />
                Quitar filtros
              </Button>
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState
              message={
                filtered ? "Ningún producto coincide con la búsqueda." : "Todavía no tienes productos en el catálogo."
              }
              hint={
                filtered
                  ? "Prueba con otro término o quita algún filtro."
                  : "Añádelos uno a uno o impórtalos desde un Excel."
              }
              action={
                !filtered && (
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Link to={NEW_PRODUCT_PATH} className={buttonVariants({ variant: "secondary" })}>
                      <Plus strokeWidth={2} aria-hidden="true" />
                      Nuevo producto o servicio
                    </Link>
                    <Link to={CATALOG_IMPORT_PATH} className={buttonVariants({ variant: "secondary" })}>
                      <FileUp strokeWidth={1.8} aria-hidden="true" />
                      Importar
                    </Link>
                  </div>
                )
              }
            />
          ) : (
            <>
              <ProductsTable rows={rows} sort={sort} onSort={setSort} />
              <ProductsList rows={rows} />
            </>
          )}
        </section>
      </Page>
    </TooltipProvider>
  );
}

function FilterField({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {label}
        {help && <Help text={help} />}
      </span>
      {children}
    </div>
  );
}

function RangeField({
  label,
  help,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  help?: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <FilterField label={label} help={help}>
      <div className="flex items-center gap-2">
        <Input
          inputMode="decimal"
          placeholder="Desde"
          aria-label={`${label}: desde`}
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          className="text-right amount"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          inputMode="decimal"
          placeholder="Hasta"
          aria-label={`${label}: hasta`}
          value={to}
          onChange={(e) => onTo(e.target.value)}
          className="text-right amount"
        />
      </div>
    </FilterField>
  );
}

type SortKey = "status" | "family" | "name" | "sku" | "price" | "discount" | "discounted" | "vat" | "stock";
interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}
const DEFAULT_SORT: Sort = { key: "name", dir: "asc" };

const byText = (a = "", b = "") => {
  if (!a !== !b) return a ? -1 : 1;
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
};

const COMPARE: Record<SortKey, (a: Row, b: Row) => number> = {
  status: (a, b) => Number(b.product.active) - Number(a.product.active),
  family: (a, b) => byText(a.family, b.family),
  name: (a, b) => byText(a.product.name, b.product.name),
  sku: (a, b) => byText(a.product.sku, b.product.sku),
  price: (a, b) => a.product.price - b.product.price,
  discount: (a, b) => a.product.discount - b.product.discount,
  discounted: (a, b) => a.discounted - b.discounted,
  vat: (a, b) => a.product.vatRate - b.product.vatRate,
  // Products without stock control go last
  stock: (a, b) => (a.stock === null ? (b.stock === null ? 0 : 1) : b.stock === null ? -1 : a.stock - b.stock),
};

function sortRows(rows: Row[], sort: Sort): Row[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * COMPARE[sort.key](a, b) || byText(a.product.name, b.product.name));
}

function StatusBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "success" : "neutral"}>{active ? "Activo" : "Inactivo"}</Badge>;
}

function StockCell({ row }: { row: Row }) {
  if (row.stock === null) return <span className="text-muted-foreground">—</span>;
  const alarm = row.alarm === "out" ? "Stock agotado" : row.alarm === "low" ? "Stock bajo" : null;
  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className={cn("amount whitespace-nowrap", row.stock < 0 && "text-destructive")}>
        {formatQuantity(row.stock)}
        {row.product.unit && <span className="ml-1 font-sans text-xs text-muted-foreground">{row.product.unit}</span>}
      </span>
      {alarm && <Badge tone={row.alarm === "out" ? "danger" : "warning"}>{alarm}</Badge>}
    </span>
  );
}

function ProductsTable({ rows, sort, onSort }: { rows: Row[]; sort: Sort; onSort: (sort: Sort) => void }) {
  const th = cn(table.th, "px-2.5");
  const td = cn(table.td, "px-2.5");
  const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
    { key: "family", label: "Familia" },
    { key: "name", label: "Nombre" },
    { key: "sku", label: "Código\n(SKU)" },
    { key: "price", label: "Precio\nunitario", numeric: true },
    { key: "discount", label: "Dto.", numeric: true },
    { key: "discounted", label: "Precio\ndescontado", numeric: true },
    { key: "vat", label: "IVA", numeric: true },
    { key: "stock", label: "Stock\nactual", numeric: true },
  ];
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[960px] border-collapse">
        <thead>
          <tr className={table.headRow}>
            {columns.map((c) => (
              <SortHeader
                key={c.key}
                label={c.label}
                numeric={c.numeric}
                dir={sort.key === c.key ? sort.dir : null}
                onClick={() =>
                  onSort(
                    sort.key === c.key
                      ? { key: c.key, dir: sort.dir === "asc" ? "desc" : "asc" }
                      : { key: c.key, dir: "asc" },
                  )
                }
                className={th}
              />
            ))}
            <th scope="col" className={cn(th, "text-center")}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const p = r.product;
            return (
              <tr
                key={p.id}
                className={cn(table.row, "animate-row-in", !p.active && "text-muted-foreground")}
                style={{ "--i": i } as CSSProperties}
              >
                <td className={cn(td, "text-sm")}>
                  <span className="block max-w-40 truncate" title={r.family}>
                    {r.family || <span className="text-muted-foreground">—</span>}
                  </span>
                </td>
                <td className={td}>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <Link
                        to={productPath(p.id)}
                        title={p.name}
                        className="block max-w-52 truncate font-medium text-inherit no-underline hover:text-primary"
                      >
                        {p.name}
                      </Link>
                      {!p.active && <StatusBadge active={false} />}
                    </span>
                    <TagChips tags={p.tags} />
                  </div>
                </td>
                <td className={cn(td, "whitespace-nowrap tabular-nums")}>{p.sku || "—"}</td>
                <td className={cn(td, "text-right amount")}>
                  {formatEUR(eurosToCents(p.price))}
                  {p.unit && <span className="ml-0.5 font-sans text-xs text-muted-foreground">/{p.unit}</span>}
                </td>
                <td className={cn(td, "text-right amount")}>{p.discount ? ratePercent(p.discount) : "—"}</td>
                <td className={cn(td, "text-right amount")}>{formatEUR(r.discounted)}</td>
                <td className={cn(td, "text-right amount whitespace-nowrap")}>{ratePercent(p.vatRate)}</td>
                <td className={cn(td, "text-right")}>
                  <StockCell row={r} />
                </td>
                <td className={cn(td, "px-1.5 first:pl-1.5 last:pr-1.5")}>
                  <QuickActions product={p} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted">
            <td colSpan={9} className={cn(td, "text-sm text-muted-foreground")}>
              {rows.length === 1 ? "1 producto" : `${rows.length} productos`}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ProductsList({ rows }: { rows: Row[] }) {
  return (
    <ul className="m-0 flex list-none flex-col overflow-hidden surface px-4 py-0 lg:hidden">
      {rows.map((r, i) => (
        <li
          key={r.product.id}
          className="flex animate-row-in items-center gap-1 border-b border-divider"
          style={{ "--i": i } as CSSProperties}
        >
          <Link
            to={productPath(r.product.id)}
            className={cn(
              "flex min-h-11 min-w-0 flex-1 items-center gap-3 py-3 text-foreground no-underline transition-opacity duration-150 active:opacity-60",
              !r.product.active && "opacity-60",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{r.product.name}</span>
              <span className="truncate text-sm text-muted-foreground">
                {[r.product.sku, r.family, !r.product.active && "Inactivo"].filter(Boolean).join(" · ") ||
                  "Sin familia"}
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="amount text-base">{formatEUR(r.discounted)}</span>
              {r.stock !== null && (
                <span
                  className={cn(
                    "text-xs",
                    r.alarm === "out" || r.alarm === "low" ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  Stock {formatQuantity(r.stock)}
                </span>
              )}
            </div>
          </Link>
          <RowActions product={r.product} />
        </li>
      ))}
      <li className="py-3 text-sm text-muted-foreground">
        {rows.length === 1 ? "1 producto" : `${rows.length} productos`}
      </li>
    </ul>
  );
}

function useProductActions(product: Product) {
  const navigate = useNavigate();
  const edit: Action = { label: "Editar", icon: Pencil, run: () => navigate(productPath(product.id)) };
  const regularize: Action = {
    label: "Regularizar stock",
    icon: ArrowRightLeft,
    run: product.stock ? () => navigate(`${STOCK_PATH}?producto=${product.id}&nueva=1`) : undefined,
  };
  const groups: Action[][] = [
    [edit, { label: "Crear por copia", icon: Copy, run: () => navigate(`${NEW_PRODUCT_PATH}?desde=${product.id}`) }],
    [
      regularize,
      {
        label: "Ver movimientos de stock",
        icon: History,
        run: product.stock ? () => navigate(`${STOCK_PATH}?producto=${product.id}`) : undefined,
      },
    ],
    [
      product.active
        ? { label: "Desactivar", icon: Power, run: () => catalogStore.setActive(product.id, false) }
        : { label: "Activar", icon: Power, run: () => catalogStore.setActive(product.id, true) },
      {
        label: "Eliminar",
        icon: Trash2,
        danger: true,
        run: () => {
          if (window.confirm(`¿Eliminar «${product.name}» del catálogo? Las facturas que ya lo usan no cambian.`))
            catalogStore.removeProducts([product.id]);
        },
      },
    ],
  ];
  return { edit, regularize, groups };
}

function QuickActions({ product }: { product: Product }) {
  const { edit, regularize, groups } = useProductActions(product);
  return (
    <div className="flex items-center justify-center gap-0.5">
      <IconAction action={edit} />
      <IconAction action={regularize} />
      <ActionsMenu
        groups={groups}
        trigger={<MoreActionsTrigger label={`Más acciones de ${product.name}`} tooltip />}
      />
    </div>
  );
}

function RowActions({ product }: { product: Product }) {
  const { groups } = useProductActions(product);
  return (
    <ActionsMenu
      groups={groups}
      trigger={<MoreActionsTrigger label={`Acciones de ${product.name}`} />}
    />
  );
}

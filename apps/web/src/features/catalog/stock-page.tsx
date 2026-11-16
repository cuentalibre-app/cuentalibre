import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { ExternalLink, Plus, Trash2, X } from "lucide-react";
import {
  familyWithDescendants,
  stockOf,
  withStockAfter,
  type StockMovement,
  type StockReason,
} from "@cuentalibre/core";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Input, SearchField, Textarea } from "@cuentalibre/ui/components/input";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { table } from "@cuentalibre/ui/lib/table";
import { HelpTip, Page, PageHeader, Toolbar } from "@/components/page";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { FiltersButton, FiltersSheet, EmptyState, SortHeader } from "@/features/sales/list-parts";
import { KINDS } from "@/features/sales/sales-model";
import { parseDecimal } from "@/lib/format";
import {
  MANUAL_REASONS,
  MOVEMENT_FILTERS,
  REASONS,
  familyLabel,
  formatQuantity,
  movementType,
  productPath,
} from "./catalog-model";
import { catalogStore, useCatalog } from "./catalog-store";

const ALL = "all";

interface Filters {
  product: string;
  family: string;
  sku: string;
  qtyFrom: string;
  qtyTo: string;
  dateFrom: string;
  dateTo: string;
  type: string;
}

const NO_FILTERS: Filters = {
  product: ALL,
  family: ALL,
  sku: "",
  qtyFrom: "",
  qtyTo: "",
  dateFrom: "",
  dateTo: "",
  type: ALL,
};

const dateTime = (at: string) =>
  new Date(at).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function StockPage() {
  const [params, setParams] = useSearchParams();
  const { products, removed, families, movements } = useCatalog();
  const preset = params.get("producto");
  const [filters, setFilters] = useState<Filters>(() => (preset ? { ...NO_FILTERS, product: preset } : NO_FILTERS));
  const [showFilters, setShowFilters] = useState(false);
  const [desc, setDesc] = useState(true);
  const [creating, setCreating] = useState(() => params.get("nueva") === "1");

  const nameOf = (id: string) => products.find((p) => p.id === id) ?? removed.find((p) => p.id === id);
  const stocked = products.filter((p) => p.stock).sort((a, b) => a.name.localeCompare(b.name, "es"));

  const rows = useMemo(() => {
    const type = MOVEMENT_FILTERS.find((t) => t.value === filters.type) ?? MOVEMENT_FILTERS[0]!;
    const familyIds = filters.family === ALL ? null : familyWithDescendants(families, filters.family);
    const sku = filters.sku.trim().toLowerCase();
    const min = parseDecimal(filters.qtyFrom);
    const max = parseDecimal(filters.qtyTo);
    const all = [...products, ...removed];
    const list = withStockAfter(movements).filter((m) => {
      const p = all.find((x) => x.id === m.productId);
      const day = m.at.slice(0, 10);
      return (
        (filters.product === ALL || m.productId === filters.product) &&
        (!familyIds || (p?.familyId != null && familyIds.has(p.familyId))) &&
        (!sku || (p?.sku ?? "").toLowerCase().includes(sku)) &&
        (min === null || m.quantity >= min) &&
        (max === null || m.quantity <= max) &&
        (!filters.dateFrom || day >= filters.dateFrom) &&
        (!filters.dateTo || day <= filters.dateTo) &&
        type.test(m)
      );
    });
    return desc ? list.reverse() : list;
  }, [movements, products, removed, families, filters, desc]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const active = (Object.keys(NO_FILTERS) as (keyof Filters)[]).filter((k) => filters[k] !== NO_FILTERS[k]).length;

  const closeDialog = (open: boolean) => {
    setCreating(open);
    if (!open && params.has("nueva")) {
      params.delete("nueva");
      setParams(params, { replace: true, preventScrollReset: true });
    }
  };

  const remove = (m: StockMovement) => {
    if (window.confirm("¿Eliminar esta regularización? El stock del producto se recalcula sin ella."))
      catalogStore.removeMovement(m.id);
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <PageHeader
          title="Regularización de stock"
          inline={
            <HelpTip side="bottom">
              Entradas y salidas de stock: las de facturas y albaranes, y los ajustes que hagas a mano.
            </HelpTip>
          }
          actions={
            <Button
              onClick={() => setCreating(true)}
              disabled={stocked.length === 0}
              className="max-lg:size-10 max-lg:px-0"
            >
              <Plus strokeWidth={2} aria-hidden="true" />
              <span className="max-lg:sr-only">Nueva regularización</span>
            </Button>
          }
        />

        <section
          aria-label="Últimas regularizaciones"
          className="flex animate-rise-in flex-col lg:overflow-hidden lg:surface"
          style={{ "--i": 1 } as CSSProperties}
        >
          <Toolbar>
            <GroupedSelect
              id="stock-product"
              aria-label="Producto"
              className="lg:max-w-96 lg:flex-[1_1_240px]"
              value={filters.product}
              onChange={(v) => set("product", v)}
              groups={[
                {
                  options: [
                    { value: ALL, label: "Todos los productos" },
                    ...stocked.map((p) => ({ value: p.id, label: p.sku ? `${p.name} · ${p.sku}` : p.name })),
                  ],
                },
              ]}
            />
            <FiltersButton
              open={showFilters}
              controls="stock-filters"
              count={active}
              onToggle={() => setShowFilters((s) => !s)}
            />
          </Toolbar>

          <FiltersSheet open={showFilters} onOpenChange={setShowFilters} results={rows.length}>
            <div
              id="stock-filters"
              className="grid gap-3 sm:grid-cols-2 lg:animate-fade-in lg:border-y lg:border-border lg:bg-muted/50 lg:px-4 lg:py-3 @5xl:grid-cols-4"
            >
              <FilterBox label="Por familia de producto">
                <GroupedSelect
                  id="stock-family"
                  value={filters.family}
                  onChange={(v) => set("family", v)}
                  disabled={families.length === 0}
                  groups={[
                    {
                      options: [
                        { value: ALL, label: "Todas" },
                        ...families
                          .map((f) => ({ value: f.id, label: familyLabel(families, f.id) }))
                          .sort((a, b) => a.label.localeCompare(b.label, "es")),
                      ],
                    },
                  ]}
                />
              </FilterBox>
              <FilterBox label="Por código (SKU)">
                <SearchField
                  value={filters.sku}
                  onChange={(e) => set("sku", e.target.value)}
                  aria-label="Código de producto"
                  className="tabular-nums"
                />
              </FilterBox>
              <FilterBox label="Por tipo/razón">
                <GroupedSelect
                  id="stock-type"
                  value={filters.type}
                  onChange={(v) => set("type", v)}
                  groups={[{ options: MOVEMENT_FILTERS.map(({ value, label }) => ({ value, label })) }]}
                />
              </FilterBox>
              <FilterBox label="Por cantidad">
                <div className="flex items-center gap-2">
                  <Input
                    inputMode="decimal"
                    placeholder="Desde"
                    aria-label="Cantidad desde"
                    value={filters.qtyFrom}
                    onChange={(e) => set("qtyFrom", e.target.value)}
                    className="text-right amount"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    inputMode="decimal"
                    placeholder="Hasta"
                    aria-label="Cantidad hasta"
                    value={filters.qtyTo}
                    onChange={(e) => set("qtyTo", e.target.value)}
                    className="text-right amount"
                  />
                </div>
              </FilterBox>
              <FilterBox label="Por fecha">
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    aria-label="Fecha desde"
                    value={filters.dateFrom}
                    onChange={(e) => set("dateFrom", e.target.value)}
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="date"
                    aria-label="Fecha hasta"
                    value={filters.dateTo}
                    onChange={(e) => set("dateTo", e.target.value)}
                  />
                </div>
              </FilterBox>
              <Button
                variant="secondary"
                onClick={() => setFilters(NO_FILTERS)}
                className="self-end justify-self-start"
              >
                <X strokeWidth={1.8} aria-hidden="true" />
                Quitar filtros
              </Button>
            </div>
          </FiltersSheet>

          {rows.length === 0 ? (
            <EmptyState
              message={active ? "Ningún movimiento coincide con los filtros." : "Todavía no hay movimientos de stock."}
              hint={
                active
                  ? "Prueba a quitar algún filtro."
                  : stocked.length
                    ? "Aparecerán al regularizar el stock o al vender productos con control de stock."
                    : "Activa el control de stock en la ficha de algún producto para empezar."
              }
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[960px] border-collapse">
                  <thead>
                    <tr className={table.headRow}>
                      <th scope="col" className={table.th}>
                        Producto
                      </th>
                      <th scope="col" className={table.th}>
                        Tipo / Razón
                      </th>
                      <th scope="col" className={table.th}>
                        Comentarios
                      </th>
                      <th scope="col" className={cn(table.th, "text-right")}>
                        Cantidad
                      </th>
                      <th scope="col" className={cn(table.th, "text-right")}>
                        Stock después
                      </th>
                      <SortHeader
                        label="Fecha"
                        dir={desc ? "desc" : "asc"}
                        onClick={() => setDesc((d) => !d)}
                        className={table.th}
                      />
                      <th scope="col" className={cn(table.th, "text-center")}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((m, i) => {
                      const p = nameOf(m.productId);
                      const type = movementType(m);
                      const alive = products.some((x) => x.id === m.productId);
                      return (
                        <tr
                          key={m.id}
                          className={cn(table.row, "animate-row-in")}
                          style={{ "--i": i } as CSSProperties}
                        >
                          <td className={table.td}>
                            {alive ? (
                              <Link
                                to={productPath(m.productId)}
                                className="font-medium text-foreground no-underline hover:text-primary"
                              >
                                {p?.name}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">
                                {p?.name ?? "Producto eliminado"} (eliminado)
                              </span>
                            )}
                            {p?.sku && (
                              <span className="block text-xs text-muted-foreground tabular-nums">{p.sku}</span>
                            )}
                          </td>
                          <td className={cn(table.td, "text-sm whitespace-nowrap")}>
                            <span className="text-muted-foreground">{type.group}/</span>
                            {type.label}
                          </td>
                          <td className={cn(table.td, "text-sm")}>
                            <MovementComment movement={m} />
                          </td>
                          <td
                            className={cn(
                              table.td,
                              "text-right amount",
                              m.quantity < 0 ? "text-destructive" : "text-success",
                            )}
                          >
                            {m.quantity > 0 ? "+" : ""}
                            {formatQuantity(m.quantity)}
                          </td>
                          <td className={cn(table.td, "text-right amount", m.stockAfter < 0 && "text-destructive")}>
                            {formatQuantity(m.stockAfter)}
                          </td>
                          <td className={cn(table.td, "text-sm whitespace-nowrap text-muted-foreground")}>
                            {dateTime(m.at)}
                          </td>
                          <td className={cn(table.td, "px-1.5 text-center first:pl-1.5 last:pr-1.5")}>
                            {m.kind === "manual" && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="hover:text-destructive"
                                aria-label="Eliminar regularización"
                                title="Eliminar regularización"
                                onClick={() => remove(m)}
                              >
                                <Trash2 strokeWidth={1.8} aria-hidden="true" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="m-0 flex list-none flex-col overflow-hidden surface px-4 py-0 lg:hidden">
                {rows.map((m) => {
                  const type = movementType(m);
                  return (
                    <li key={m.id} className="flex items-center gap-3 border-b border-divider py-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate font-medium">{nameOf(m.productId)?.name}</span>
                        <span className="truncate text-sm text-muted-foreground">
                          {type.group}/{type.label} · {dateTime(m.at)}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={cn("amount", m.quantity < 0 ? "text-destructive" : "text-success")}>
                          {m.quantity > 0 ? "+" : ""}
                          {formatQuantity(m.quantity)}
                        </span>
                        <span className="text-xs text-muted-foreground">Queda {formatQuantity(m.stockAfter)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </Page>

      <Dialog open={creating} onOpenChange={closeDialog}>
        <DialogContent className="max-w-xl">
          {creating && (
            <RegularizationForm
              initialProduct={stocked.some((p) => p.id === preset) ? preset! : (stocked[0]?.id ?? "")}
              onDone={() => closeDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function FilterBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function MovementComment({ movement }: { movement: StockMovement }) {
  const text = movement.comments ?? "";
  if (movement.documentId && (movement.kind === "invoice" || movement.kind === "deliveryNote")) {
    const path = movement.kind === "invoice" ? KINDS.invoice.path : KINDS.deliveryNote.path;
    return (
      <Link
        to={`${path}/${movement.documentId}`}
        className="inline-flex items-center gap-1 text-foreground no-underline hover:text-primary"
      >
        {text || "Ver documento"}
        <ExternalLink className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
      </Link>
    );
  }
  return text ? <span>{text}</span> : <span className="text-muted-foreground">—</span>;
}

function RegularizationForm({ initialProduct, onDone }: { initialProduct: string; onDone: () => void }) {
  const { products, movements } = useCatalog();
  const [productId, setProductId] = useState(initialProduct);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<StockReason>("undefined");
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stocked = products.filter((p) => p.stock).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const product = stocked.find((p) => p.id === productId);
  const current = product ? stockOf(movements, product.id) : 0;
  const qty = parseDecimal(quantity);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!product) return setError("Elige un producto.");
    if (qty === null || qty === 0) return setError("Escribe las unidades a sumar (positivas) o a restar (negativas).");
    catalogStore.regularize(product.id, qty, reason, comments);
    onDone();
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <DialogTitle>Nueva regularización de stock</DialogTitle>
      <DialogDescription>
        Ajusta el stock de un producto por una pérdida, una compra, un recuento… Queda registrado con su motivo.
      </DialogDescription>
      <Field label="Producto" required>
        {(p) => (
          <GroupedSelect
            {...p}
            value={productId}
            onChange={setProductId}
            groups={[
              { options: stocked.map((x) => ({ value: x.id, label: x.sku ? `${x.name} · ${x.sku}` : x.name })) },
            ]}
          />
        )}
      </Field>
      {product && (
        <p className="m-0 text-sm text-muted-foreground">
          Stock actual: <span className="amount font-medium text-foreground">{formatQuantity(current)}</span>
          {product.unit && ` ${product.unit}`}
          {qty !== null && qty !== 0 && (
            <>
              {" "}
              → quedarán{" "}
              <span className={cn("amount font-medium", current + qty < 0 ? "text-destructive" : "text-foreground")}>
                {formatQuantity(current + qty)}
              </span>
            </>
          )}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Cantidad a regularizar"
          required
          error={error ?? undefined}
          hint="Valores positivos para añadir stock, negativos para restar."
        >
          {(p) => (
            <Input
              {...p}
              autoFocus
              inputMode="decimal"
              value={quantity}
              placeholder="-5"
              onChange={(e) => {
                setQuantity(e.target.value);
                setError(null);
              }}
              className="text-right amount"
            />
          )}
        </Field>
        <Field label="Razón de la regularización">
          {(p) => (
            <GroupedSelect
              {...p}
              value={reason}
              onChange={(v) => setReason(v as StockReason)}
              groups={[{ options: MANUAL_REASONS.map((r) => ({ value: r, label: REASONS[r] })) }]}
            />
          )}
        </Field>
      </div>
      <Field label="Comentarios">
        {(p) => <Textarea {...p} rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />}
      </Field>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Guardar</Button>
      </DialogFooter>
    </form>
  );
}

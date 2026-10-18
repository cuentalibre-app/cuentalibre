import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  ChevronDown,
  CircleDollarSign,
  Copy,
  Download,
  ExternalLink,
  FileX2,
  Filter,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  ScanText,
  Search,
  Trash2,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import {
  amortizationBetween,
  cents,
  periodKey,
  periodMonths,
  sumBy,
  toIsoDate,
  type Cents,
  type Period,
} from "@fiscalia/core";
import { Badge } from "@fiscalia/ui/components/badge";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import { DropdownMenuTrigger } from "@fiscalia/ui/components/dropdown-menu";
import { Input } from "@fiscalia/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@fiscalia/ui/components/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { table } from "@fiscalia/ui/lib/table";
import { useLockedQuarter } from "@/features/closing/closing-store";
import { AnimatedAmount } from "@/components/animated-amount";
import { PeriodSelect } from "@/components/period-select";
import {
  ActionsMenu,
  EmptyState,
  IconAction,
  SortHeader,
  downloadCsv,
  pickFiles,
  type Action,
} from "@/features/sales/list-parts";
import { GroupedSelect } from "@/features/sales/form-fields";
import { MONTHS, formatDate, formatShortDate, parseEuros, periodCode } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { availableYears } from "@/mocks/data";
import type { Contact } from "@/mocks/contacts";
import type { ExpenseType, PurchaseInvoice } from "@/mocks/purchases";
import {
  ASSETS_PATH,
  ASSET_CATEGORY_LABELS,
  EXPENSE_TYPE_GROUPS,
  NEW_ASSET_PATH,
  NEW_PURCHASE_PATH,
  PURCHASES_PATH,
  PURCHASE_STATUS,
  PURCHASE_STATUS_ORDER,
  assetOf,
  deductible,
  expenseTypeLabel,
  outstanding,
  purchaseStatus,
  purchaseTotals,
  supplierOf,
  type PurchaseStatus,
} from "./purchases-model";
import { purchasesStore, usePurchaseInvoices } from "./purchases-store";

const ALL = "all";

/** The list serves both received invoices and investment goods, which are received invoices too. */
export type PurchaseListKind = "invoice" | "asset";

const LIST_KINDS: Record<
  PurchaseListKind,
  { title: string; newLabel: string; newPath: string; export: string; empty: string; filtered: string }
> = {
  invoice: {
    title: "Facturas recibidas",
    newLabel: "Nueva factura recibida",
    newPath: NEW_PURCHASE_PATH,
    export: "facturas-recibidas",
    empty: "No hay facturas recibidas en este periodo.",
    filtered: "Ninguna factura coincide con los filtros.",
  },
  asset: {
    title: "Bienes de inversión",
    newLabel: "Nuevo bien de inversión",
    newPath: NEW_ASSET_PATH,
    export: "bienes-de-inversion",
    empty: "No hay bienes de inversión comprados en este periodo.",
    filtered: "Ningún bien de inversión coincide con los filtros.",
  },
};

/** First and last day (ISO) of a period. */
function periodBounds(period: Period): [string, string] {
  const months = periodMonths(period);
  const first = months[0]! + 1;
  const last = months.at(-1)! + 1;
  const lastDay = new Date(Date.UTC(period.year, last, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [`${period.year}-${pad(first)}-01`, `${period.year}-${pad(last)}-${pad(lastDay)}`];
}

interface Row {
  doc: PurchaseInvoice;
  supplier: Contact;
  status: PurchaseStatus;
  base: Cents;
  vat: Cents;
  withholding: Cents;
  total: Cents;
  outstanding: Cents;
  deductibleBase: Cents;
  deductibleVat: Cents;
  /** Investment goods: amortization of the period shown. */
  amortization: Cents;
}

type Amount =
  "base" | "vat" | "withholding" | "total" | "outstanding" | "deductibleBase" | "deductibleVat" | "amortization";

function inPeriod(isoDate: string, period: Period): boolean {
  const [year, month] = isoDate.split("-").map(Number);
  return year === period.year && periodMonths(period).includes(month! - 1);
}

function sum(rows: Row[], key: Amount) {
  return sumBy(rows, (r) => r[key]);
}

interface Filters {
  query: string;
  status: string;
  expenseType: string;
  supplierId: string;
  /** Zero-based month within the period, or ALL. */
  month: string;
  tag: string;
  totalFrom: string;
  totalTo: string;
}

const NO_FILTERS: Filters = {
  query: "",
  status: ALL,
  expenseType: ALL,
  supplierId: ALL,
  month: ALL,
  tag: ALL,
  totalFrom: "",
  totalTo: "",
};

function matches(r: Row, f: Filters): boolean {
  const q = f.query.trim().toLowerCase();
  const from = parseEuros(f.totalFrom);
  const to = parseEuros(f.totalTo);
  return (
    (f.status === ALL || r.status === f.status) &&
    (f.expenseType === ALL || r.doc.expenseType === f.expenseType) &&
    (f.supplierId === ALL || r.doc.supplierId === f.supplierId) &&
    (f.month === ALL || Number(r.doc.bookedOn.slice(5, 7)) - 1 === Number(f.month)) &&
    (f.tag === ALL || (r.doc.tags ?? []).includes(f.tag)) &&
    (from === null || r.total >= from) &&
    (to === null || r.total <= to) &&
    (!q ||
      [r.doc.number, r.supplier.name, r.supplier.taxId, r.doc.privateNotes, ...r.doc.lines.map((l) => l.concept)].some(
        (v) => v.toLowerCase().includes(q),
      ))
  );
}

export function PurchasesListPage({ kind = "invoice" }: { kind?: PurchaseListKind }) {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const all = usePurchaseInvoices();
  const invoices = useMemo(() => all.filter((d) => Boolean(d.asset) === (kind === "asset")), [all, kind]);
  const copy = LIST_KINDS[kind];

  const periodRows = useMemo(() => {
    const [from, to] = periodBounds(period);
    return invoices
      .filter((d) => inPeriod(d.bookedOn, period))
      .map((doc): Row => {
        const totals = purchaseTotals(doc);
        const ded = deductible(doc);
        return {
          doc,
          supplier: supplierOf(doc),
          status: purchaseStatus(doc, today),
          ...totals,
          outstanding: outstanding(doc),
          deductibleBase: ded.base,
          deductibleVat: ded.vat,
          amortization: doc.asset ? amortizationBetween(assetOf(doc), from, to) : cents(0),
        };
      });
  }, [invoices, period, today]);

  // What every investment good amortizes in the period, also those bought earlier
  const periodAmortization = useMemo(() => {
    if (kind !== "asset") return cents(0);
    const [from, to] = periodBounds(period);
    return sumBy(invoices, (doc) => amortizationBetween(assetOf(doc), from, to));
  }, [invoices, kind, period]);

  const rows = useMemo(
    () =>
      sortRows(
        periodRows.filter((r) => matches(r, filters)),
        sort,
      ),
    [periodRows, filters, sort],
  );

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  // Filters other than search and status live behind the "Filtros" button
  const extraFilters = (["expenseType", "supplierId", "month", "tag", "totalFrom", "totalTo"] as const).filter(
    (k) => filters[k] !== NO_FILTERS[k],
  ).length;
  const filtered = extraFilters > 0 || filters.query.trim() !== "" || filters.status !== ALL;

  const tags = [...new Set(invoices.flatMap((d) => d.tags ?? []))].sort();
  const periodSuppliers = [...new Map(periodRows.map((r) => [r.supplier.id, r.supplier])).values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );
  const exportName = `${copy.export}-${periodCode(period)}`.toLowerCase();

  const filterBySupplier = (supplierId: string) => {
    set("supplierId", supplierId);
    setShowFilters(true);
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 lg:gap-4 lg:px-8 lg:pt-6 lg:pb-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">{copy.title}</h1>
          <div className="hidden gap-2.5 lg:flex">
            {kind === "invoice" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* aria-disabled keeps the tooltip reachable, unlike disabled */}
                  <Button variant="secondary" aria-disabled className="cursor-not-allowed opacity-50">
                    <ScanText strokeWidth={1.8} aria-hidden="true" />
                    Leer factura con OCR
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  Disponible próximamente: leerá los datos del PDF por ti.
                </TooltipContent>
              </Tooltip>
            )}
            <Link to={copy.newPath} className={cn(buttonVariants(), "no-underline")}>
              <Plus strokeWidth={2} aria-hidden="true" />
              {copy.newLabel}
            </Link>
          </div>
        </header>

        {kind === "asset" ? (
          <AssetSummary rows={periodRows} amortization={periodAmortization} />
        ) : (
          <PurchaseSummary rows={periodRows} />
        )}

        <section
          aria-label={`Listado de ${copy.title.toLowerCase()}`}
          className="flex animate-rise-in flex-col lg:overflow-hidden lg:rounded-xl lg:border lg:border-border"
          style={{ "--i": 1 } as CSSProperties}
        >
          <div className="flex flex-wrap items-center gap-2.5 pb-3 lg:px-4 lg:py-3">
            <div className="flex h-10 min-w-0 flex-[1_1_220px] items-center gap-2 rounded-lg border border-input px-3 text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring lg:max-w-80">
              <Search className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <input
                type="search"
                value={filters.query}
                onChange={(e) => set("query", e.target.value)}
                placeholder="Buscar por número, proveedor, NIF o concepto"
                aria-label="Buscar"
                className="min-w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Select value={filters.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger aria-label="Filtrar por estado" className="min-w-44 font-medium">
                <span className="flex-1 text-left">
                  <SelectValue />
                </span>
                <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los estados</SelectItem>
                {PURCHASE_STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PURCHASE_STATUS[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <PeriodSelect
              value={period}
              onChange={(p) => {
                setPeriod(p);
                // The month belongs to the old period
                set("month", ALL);
              }}
              years={availableYears}
              today={today}
            />
            <Button
              variant="secondary"
              size="md"
              aria-expanded={showFilters}
              aria-controls="purchase-filters"
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
            <div className="ml-auto flex gap-2">
              <Button
                variant="secondary"
                size="md"
                disabled={rows.length === 0}
                onClick={() => exportCsv(rows, exportName, kind)}
              >
                <Download strokeWidth={1.8} aria-hidden="true" />
                CSV
              </Button>
            </div>
          </div>

          {showFilters && (
            <FiltersPanel
              filters={filters}
              period={period}
              suppliers={periodSuppliers}
              tags={tags}
              onChange={set}
              onClear={() => setFilters((f) => ({ ...NO_FILTERS, query: f.query, status: f.status }))}
            />
          )}

          {rows.length === 0 ? (
            <EmptyState
              message={filtered ? copy.filtered : copy.empty}
              hint={
                filtered ? "Prueba con otro término o quita algún filtro." : "Puedes cambiar el periodo en el selector."
              }
              action={
                !filtered && (
                  <Link to={copy.newPath} className={cn(buttonVariants({ variant: "secondary" }), "mt-3 no-underline")}>
                    <Plus strokeWidth={2} aria-hidden="true" />
                    {copy.newLabel}
                  </Link>
                )
              }
            />
          ) : (
            <>
              {/* Keyed by period so the rows replay their entrance when it changes, like the dashboard */}
              <PurchasesTable
                key={`table-${periodKey(period)}`}
                kind={kind}
                rows={rows}
                sort={sort}
                onSort={setSort}
                onFilterSupplier={filterBySupplier}
              />
              <PurchasesList key={`list-${periodKey(period)}`} rows={rows} />
            </>
          )}
        </section>
      </div>
    </TooltipProvider>
  );
}

/** Deductible figures first: they are what lowers the taxes (forms 303 and 130). */
function PurchaseSummary({ rows }: { rows: Row[] }) {
  const invoices = (n: number) => (n === 1 ? "1 factura" : `${n} facturas`);
  const unpaid = rows.filter((r) => r.status !== "paid");
  const overdue = sum(
    rows.filter((r) => r.status === "overdue"),
    "outstanding",
  );
  const base = sum(rows, "base");
  const vat = sum(rows, "vat");
  const stats: { label: string; value: Cents; detail: ReactNode }[] = [
    {
      label: "Gasto deducible",
      value: sum(rows, "deductibleBase"),
      detail: `Sin IVA · base total ${formatEUR(base)}`,
    },
    {
      label: "IVA soportado deducible",
      value: sum(rows, "deductibleVat"),
      detail: `De ${formatEUR(vat)} de IVA en facturas`,
    },
    {
      label: "Total facturas",
      value: sum(rows, "total"),
      detail: `${invoices(rows.length)} · con IVA y retención`,
    },
    {
      label: "Pendiente de pago",
      value: sum(unpaid, "outstanding"),
      detail:
        overdue > 0 ? (
          <span className="text-destructive">{formatEUR(overdue)} vencido</span>
        ) : (
          `${invoices(unpaid.length)} sin pagar del todo`
        ),
    },
  ];
  return (
    <dl className="m-0 grid animate-rise-in grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 bg-card px-4 py-3.5 lg:px-4 lg:py-3">
          <dt className="text-md font-semibold text-foreground lg:text-lg">{s.label}</dt>
          <dd className="m-0 amount text-xl font-semibold">
            <AnimatedAmount value={s.value} />
          </dd>
          <dd className="m-0 text-sm text-muted-foreground">{s.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Investment goods: what they cost and what they lower the income tax by through amortization. */
function AssetSummary({ rows, amortization }: { rows: Row[]; amortization: Cents }) {
  const goods = (n: number) => (n === 1 ? "1 bien" : `${n} bienes`);
  const unpaid = rows.filter((r) => r.status !== "paid");
  const stats: { label: string; value: Cents; detail: ReactNode }[] = [
    {
      label: "Amortización del periodo",
      value: amortization,
      detail: "Gasto deducible de todos tus bienes",
    },
    {
      label: "IVA soportado deducible",
      value: sum(rows, "deductibleVat"),
      detail: "Se deduce entero al comprarlos",
    },
    {
      label: "Comprado en el periodo",
      value: sum(rows, "base"),
      detail: `${goods(rows.length)} · sin IVA`,
    },
    {
      label: "Pendiente de pago",
      value: sum(unpaid, "outstanding"),
      detail: `${goods(unpaid.length)} sin pagar del todo`,
    },
  ];
  return (
    <dl className="m-0 grid animate-rise-in grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 bg-card px-4 py-3.5 lg:px-4 lg:py-3">
          <dt className="text-md font-semibold text-foreground lg:text-lg">{s.label}</dt>
          <dd className="m-0 amount text-xl font-semibold">
            <AnimatedAmount value={s.value} />
          </dd>
          <dd className="m-0 text-sm text-muted-foreground">{s.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

function FiltersPanel({
  filters,
  period,
  suppliers,
  tags,
  onChange,
  onClear,
}: {
  filters: Filters;
  period: Period;
  suppliers: Contact[];
  tags: string[];
  onChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onClear: () => void;
}) {
  const label = "text-xs font-medium text-muted-foreground";
  const all = (text: string) => ({ value: ALL, label: text });
  return (
    <div
      id="purchase-filters"
      className="grid animate-fade-in gap-3 border-y border-border bg-muted/50 py-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end lg:px-4"
    >
      <label className="flex min-w-0 flex-col gap-1">
        <span className={label}>Proveedor</span>
        <GroupedSelect
          id="filter-supplier"
          value={filters.supplierId}
          onChange={(v) => onChange("supplierId", v)}
          groups={[{ options: [all("Todos"), ...suppliers.map((s) => ({ value: s.id, label: s.name }))] }]}
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1">
        <span className={label}>Tipo de gasto</span>
        <GroupedSelect
          id="filter-expense-type"
          value={filters.expenseType}
          onChange={(v) => onChange("expenseType", v)}
          groups={[{ options: [all("Todos")] }, ...EXPENSE_TYPE_GROUPS]}
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1">
        <span className={label}>Mes</span>
        <GroupedSelect
          id="filter-month"
          value={filters.month}
          onChange={(v) => onChange("month", v)}
          groups={[
            {
              options: [
                all("Todo el periodo"),
                ...periodMonths(period).map((m) => ({ value: String(m), label: MONTHS[m]! })),
              ],
            },
          ]}
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1">
        <span className={label}>Etiqueta</span>
        <GroupedSelect
          id="filter-tag"
          value={filters.tag}
          onChange={(v) => onChange("tag", v)}
          disabled={tags.length === 0}
          groups={[
            { options: [all(tags.length ? "Todas" : "Sin etiquetas"), ...tags.map((t) => ({ value: t, label: t }))] },
          ]}
        />
      </label>
      <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
        <legend className={cn(label, "mb-1 p-0")}>Total entre</legend>
        <div className="flex items-center gap-1.5">
          <Input
            inputMode="decimal"
            placeholder="Desde"
            aria-label="Total desde"
            value={filters.totalFrom}
            onChange={(e) => onChange("totalFrom", e.target.value)}
            aria-invalid={filters.totalFrom && parseEuros(filters.totalFrom) === null ? true : undefined}
            className="text-right amount"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            inputMode="decimal"
            placeholder="Hasta"
            aria-label="Total hasta"
            value={filters.totalTo}
            onChange={(e) => onChange("totalTo", e.target.value)}
            aria-invalid={filters.totalTo && parseEuros(filters.totalTo) === null ? true : undefined}
            className="text-right amount"
          />
        </div>
      </fieldset>
      <Button variant="ghost" size="md" onClick={onClear} className="justify-self-start">
        <X strokeWidth={1.8} aria-hidden="true" />
        Quitar filtros
      </Button>
    </div>
  );
}

type SortKey = "number" | "date" | "supplier" | "status" | "base" | "vat" | "withholding" | "amortization" | "total";
type SortDir = "asc" | "desc";
interface Sort {
  key: SortKey;
  dir: SortDir;
}

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "number", label: "Nº" },
  { key: "date", label: "Fecha" },
  { key: "supplier", label: "Proveedor" },
  { key: "status", label: "Estado" },
  { key: "base", label: "Base\nimponible", numeric: true },
  { key: "vat", label: "IVA", numeric: true },
  { key: "withholding", label: "Retención", numeric: true },
  { key: "total", label: "Total", numeric: true },
];

/** Investment goods show the period's amortization where invoices show the withholding. */
const ASSET_COLUMNS = COLUMNS.map((c) =>
  c.key === "withholding" ? { key: "amortization" as const, label: "Amortización\ndel periodo", numeric: true } : c,
);

const byText = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

const COMPARE: Record<SortKey, (a: Row, b: Row) => number> = {
  number: (a, b) => byText(a.doc.number, b.doc.number),
  date: (a, b) => a.doc.bookedOn.localeCompare(b.doc.bookedOn) || a.doc.issuedOn.localeCompare(b.doc.issuedOn),
  supplier: (a, b) => byText(a.supplier.name, b.supplier.name),
  status: (a, b) => byText(PURCHASE_STATUS[a.status].label, PURCHASE_STATUS[b.status].label),
  base: (a, b) => a.base - b.base,
  vat: (a, b) => a.vat - b.vat,
  withholding: (a, b) => a.withholding - b.withholding,
  amortization: (a, b) => a.amortization - b.amortization,
  total: (a, b) => a.total - b.total,
};

const DEFAULT_SORT: Sort = { key: "date", dir: "desc" };

function sortRows(rows: Row[], sort: Sort): Row[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * COMPARE[sort.key](a, b));
}

/** Clicking the active column flips it; a new column starts with the most useful direction. */
function nextSort(current: Sort, key: SortKey): Sort {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: key === "supplier" || key === "status" ? "asc" : "desc" };
}

const editPath = (doc: PurchaseInvoice) => `${doc.asset ? ASSETS_PATH : PURCHASES_PATH}/${doc.id}`;
const newPathFor = (doc: PurchaseInvoice) => (doc.asset ? NEW_ASSET_PATH : NEW_PURCHASE_PATH);

/** "Vence el 02 oct 2026 · contabilizada el 06 oct 2026" */
function dateHint(doc: PurchaseInvoice): string | null {
  const parts = [
    doc.bookedOn !== doc.issuedOn && `Fecha de factura: ${formatDate(doc.issuedOn)}`,
    doc.dueOn && `Vencimiento: ${formatDate(doc.dueOn)}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function PurchasesTable({
  kind,
  rows,
  sort,
  onSort,
  onFilterSupplier,
}: {
  kind: PurchaseListKind;
  rows: Row[];
  sort: Sort;
  onSort: (sort: Sort) => void;
  onFilterSupplier: (supplierId: string) => void;
}) {
  // Tighter than the default so nine columns fit on a laptop screen.
  const th = cn(table.th, "px-2.5");
  const td = cn(table.td, "px-2.5");
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[980px] border-collapse">
        <thead>
          <tr className={table.headRow}>
            {(kind === "asset" ? ASSET_COLUMNS : COLUMNS).map((c) => (
              <SortHeader
                key={c.key}
                label={c.label}
                numeric={c.numeric}
                dir={sort.key === c.key ? sort.dir : null}
                onClick={() => onSort(nextSort(sort, c.key))}
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
            const hint = dateHint(r.doc);
            return (
              <tr
                key={r.doc.id}
                className={cn(table.row, "animate-row-in", r.status === "overdue" && "bg-destructive-soft/40")}
                style={{ "--i": i } as CSSProperties}
              >
                <td className={cn(td, "font-mono text-sm whitespace-nowrap")}>
                  <Link to={editPath(r.doc)} className="text-foreground no-underline hover:text-primary">
                    {r.doc.number}
                  </Link>
                  {r.doc.asset && (
                    <span
                      className="block max-w-44 truncate font-sans text-xs text-muted-foreground"
                      title={ASSET_CATEGORY_LABELS[r.doc.asset.category]}
                    >
                      {ASSET_CATEGORY_LABELS[r.doc.asset.category]}
                    </span>
                  )}
                </td>
                <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>
                  {hint ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="cursor-default underline decoration-dotted underline-offset-4">
                          {formatDate(r.doc.bookedOn)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{hint}</TooltipContent>
                    </Tooltip>
                  ) : (
                    formatDate(r.doc.bookedOn)
                  )}
                </td>
                <td className={td}>
                  <div className="group relative flex items-center">
                    <div className="flex min-w-0 flex-col">
                      <span className="max-w-40 truncate font-medium whitespace-nowrap" title={r.supplier.name}>
                        {r.supplier.name}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{r.supplier.taxId}</span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Ver solo las facturas de ${r.supplier.name}`}
                          onClick={() => onFilterSupplier(r.supplier.id)}
                          className="absolute -right-1.5 size-7 bg-card px-0 opacity-0 shadow-sm group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <Filter className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Filtrar por este proveedor</TooltipContent>
                    </Tooltip>
                  </div>
                </td>
                <td className={td}>
                  <StatusBadge row={r} />
                </td>
                <td className={cn(td, "text-right")}>
                  <span className="amount">{formatEUR(r.base)}</span>
                  <Imputation row={r} />
                </td>
                <td className={cn(td, "text-right amount text-muted-foreground")}>{formatEUR(r.vat)}</td>
                {kind === "asset" ? (
                  <td className={cn(td, "text-right amount text-muted-foreground")}>
                    {r.amortization ? formatEUR(r.amortization) : "—"}
                  </td>
                ) : (
                  <td className={cn(td, "text-right amount text-muted-foreground")}>
                    {r.withholding ? formatEUR(cents(-r.withholding)) : "—"}
                  </td>
                )}
                <td className={cn(td, "text-right amount font-semibold")}>{formatEUR(r.total)}</td>
                <td className={cn(td, "px-1.5 first:pl-1.5 last:pr-1.5")}>
                  <QuickActions row={r} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted font-semibold">
            <td colSpan={4} className={cn(td, "text-sm text-muted-foreground")}>
              {rows.length}{" "}
              {kind === "asset" ? (rows.length === 1 ? "bien" : "bienes") : rows.length === 1 ? "factura" : "facturas"}
            </td>
            <td className={cn(td, "text-right amount")}>
              <AnimatedAmount value={sum(rows, "base")} />
            </td>
            <td className={cn(td, "text-right amount")}>
              <AnimatedAmount value={sum(rows, "vat")} />
            </td>
            <td className={cn(td, "text-right amount")}>
              <AnimatedAmount value={kind === "asset" ? sum(rows, "amortization") : cents(-sum(rows, "withholding"))} />
            </td>
            <td className={cn(td, "text-right amount")}>
              <AnimatedAmount value={sum(rows, "total")} />
            </td>
            <td className={td} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function StatusBadge({ row }: { row: Row }) {
  const status = PURCHASE_STATUS[row.status];
  const detail = row.status === "paid" ? status.hint : `${status.hint} Quedan ${formatEUR(row.outstanding)} por pagar.`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="cursor-default">
          <Badge tone={status.tone}>{status.label}</Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{detail}</TooltipContent>
    </Tooltip>
  );
}

/** Partial imputation, under the base: what share counts, with the deductible amounts behind a tooltip. */
function Imputation({ row }: { row: Row }) {
  const { imputation, vatImputation } = row.doc;
  if (imputation === 100 && (vatImputation === null || vatImputation === 100)) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="block cursor-default text-xs font-medium whitespace-nowrap text-warning">
          Deducible {imputation} %
          {vatImputation !== null && vatImputation !== imputation && ` · IVA ${vatImputation} %`}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Deducible: base {formatEUR(row.deductibleBase)} · IVA {formatEUR(row.deductibleVat)}
      </TooltipContent>
    </Tooltip>
  );
}

function PurchasesList({ rows }: { rows: Row[] }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0 lg:hidden">
      {rows.map((r, i) => (
        <li
          key={r.doc.id}
          className="flex animate-row-in items-center gap-1 border-b border-divider"
          style={{ "--i": i } as CSSProperties}
        >
          <Link
            to={editPath(r.doc)}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-3 text-foreground no-underline transition-opacity duration-150 active:opacity-60"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{r.supplier.name}</span>
              <span className="truncate text-sm text-muted-foreground">
                {r.doc.number} · {formatShortDate(r.doc.bookedOn)}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="amount text-base">{formatEUR(r.total)}</span>
              <Badge tone={PURCHASE_STATUS[r.status].tone}>{PURCHASE_STATUS[r.status].label}</Badge>
            </div>
          </Link>
          <RowActions row={r} />
        </li>
      ))}
      <li className="flex justify-between py-3 text-sm text-muted-foreground">
        <span>
          {rows.length} {rows.length === 1 ? "factura" : "facturas"}
        </span>
        <span>
          Total <AnimatedAmount value={sum(rows, "total")} className="amount font-semibold text-foreground" />
        </span>
      </li>
    </ul>
  );
}

/** Every operation available on a received invoice, grouped so the menu can split them with separators. */
function usePurchaseActions(row: Row) {
  const navigate = useNavigate();
  const lockedQuarterOf = useLockedQuarter();
  const { doc } = row;
  const attachments = doc.attachments ?? [];
  const viewable = attachments.find((a) => a.url);

  const attach: Action = {
    label: attachments.length > 0 ? `Adjuntar archivos (${attachments.length})` : "Adjuntar archivos",
    icon: Paperclip,
    run: () =>
      pickFiles((files) => {
        if (files.length === 0) return;
        const added = files.map((f) => ({
          id: crypto.randomUUID(),
          name: f.name,
          size: f.size,
          url: URL.createObjectURL(f),
        }));
        purchasesStore.update(doc.id, { attachments: [...attachments, ...added] });
      }),
  };

  const view: Action = {
    label: viewable ? "Ver justificante" : "Sin justificante adjunto en esta sesión",
    icon: ExternalLink,
    run: viewable ? () => window.open(viewable.url, "_blank", "noopener") : undefined,
  };

  const primary: Action =
    row.status === "paid"
      ? {
          label: "Marcar como pendiente",
          icon: Undo2,
          run: () => {
            if (doc.payments.length < 2 || window.confirm(`¿Quitar los ${doc.payments.length} pagos registrados?`))
              purchasesStore.update(doc.id, { payments: [] });
          },
        }
      : {
          label: row.status === "partial" ? "Pagar lo pendiente" : "Marcar como pagada",
          icon: CircleDollarSign,
          run: () =>
            purchasesStore.update(doc.id, {
              payments: [
                ...doc.payments,
                {
                  id: crypto.randomUUID(),
                  date: toIsoDate(new Date()),
                  amount: row.outstanding,
                  paymentMethodId: doc.payments.at(-1)?.paymentMethodId ?? "bank1",
                },
              ],
            }),
        };

  const locked = lockedQuarterOf(doc.bookedOn) !== null;
  const groups: Action[][] = [
    [
      { label: locked ? "Ver factura" : "Editar factura", icon: Pencil, run: () => navigate(editPath(doc)) },
      { label: "Crear por copia", icon: Copy, run: () => navigate(`${newPathFor(doc)}?desde=${doc.id}`) },
    ],
    [
      primary,
      { label: "Gestionar los pagos", icon: Wallet, run: () => navigate(`${editPath(doc)}#pagos`) },
      attach,
      view,
    ],
    [
      {
        label: "Registrar un abono de esta factura",
        icon: FileX2,
        run: () => navigate(`${newPathFor(doc)}?desde=${doc.id}&abono=1`),
      },
    ],
    [
      {
        label: `Eliminar factura ${doc.number}` + (locked ? " (trimestre cerrado)" : ""),
        icon: Trash2,
        danger: true,
        run: locked
          ? undefined
          : () => {
              if (window.confirm(`¿Eliminar la factura ${doc.number} de ${row.supplier.name}? No se puede deshacer.`))
                purchasesStore.remove(doc.id);
            },
      },
    ],
  ];

  return { attach, primary, groups, attachments: attachments.length, label: `la factura ${doc.number}` };
}

/** Desktop: the usual operations one click away, the rest behind the arrow. */
function QuickActions({ row }: { row: Row }) {
  const { attach, primary, groups, attachments, label } = usePurchaseActions(row);
  return (
    <div className="flex items-center justify-center gap-0.5">
      <IconAction action={attach} badge={attachments} />
      <IconAction action={primary} />
      <ActionsMenu
        groups={groups}
        trigger={
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="size-8 px-0" aria-label={`Más acciones de ${label}`}>
                  <ChevronDown strokeWidth={1.8} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Más acciones</TooltipContent>
          </Tooltip>
        }
      />
    </div>
  );
}

/** Mobile: everything in one menu. */
function RowActions({ row }: { row: Row }) {
  const { groups, label } = usePurchaseActions(row);
  return (
    <ActionsMenu
      groups={groups}
      trigger={
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={`Acciones de ${label}`}>
            <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      }
    />
  );
}

function exportCsv(rows: Row[], name: string, kind: PurchaseListKind) {
  const asset = kind === "asset";
  downloadCsv(
    [
      "Número",
      "Fecha factura",
      "Fecha contable",
      "Proveedor",
      "NIF",
      asset ? "Tipo de bien" : "Tipo de gasto",
      "Estado",
      "Base imponible",
      "IVA",
      "Retención",
      "Total",
      "Pendiente",
      "Imputación %",
      asset ? "Amortización del periodo" : "Base deducible",
      "IVA deducible",
    ],
    rows.map((r) => [
      r.doc.number,
      r.doc.issuedOn,
      r.doc.bookedOn,
      r.supplier.name,
      r.supplier.taxId,
      r.doc.asset ? ASSET_CATEGORY_LABELS[r.doc.asset.category] : expenseTypeLabel(r.doc.expenseType as ExpenseType),
      PURCHASE_STATUS[r.status].label,
      r.base,
      r.vat,
      r.withholding,
      r.total,
      r.outstanding,
      String(r.doc.imputation),
      asset ? r.amortization : r.deductibleBase,
      r.deductibleVat,
    ]),
    name,
  );
}

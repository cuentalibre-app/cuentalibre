import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  ExternalLink,
  ChevronDown,
  CircleDollarSign,
  CircleDot,
  Copy,
  Download,
  FileArchive,
  FileCode2,
  FileDown,
  FileX2,
  Mail,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  Settings,
  SlidersHorizontal,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { cents, periodKey, periodMonths, sumBy, toIsoDate, type Cents, type Period } from "@cuentalibre/core";
import type { SalesDocument, SalesKind } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { Input, SearchField } from "@cuentalibre/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cuentalibre/ui/components/select";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { useLockedQuarter } from "@/features/closing/closing-store";
import {
  DELIVERY_NOTE_SETTINGS_PATH,
  DRAFT_SETTINGS_PATH,
  INVOICE_SETTINGS_PATH,
  missingIssuerData,
  PREFERENCES_PATH,
  QUOTE_SETTINGS_PATH,
} from "@/features/settings/settings-model";
import { SettingsLink } from "@/features/settings/settings-parts";
import { settingsStore } from "@/features/settings/settings-store";
import { TagChips } from "@/features/settings/tag-chip";
import { AnimatedAmount } from "@/components/animated-amount";
import { Page, PageHeader, Toolbar } from "@/components/page";
import { PeriodSelect } from "@/components/period-select";
import { MONTHS, formatDate, formatPercent, formatShortDate, parseEuros, periodCode } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { availableYears } from "@/mocks/data";
import {
  INCOME_TYPE_GROUPS,
  KINDS,
  STATUS,
  clientOf,
  displayStatus,
  documentTotals,
  defaultSeries,
  deleteBlocker,
  isFullyRectified,
  laterInvoice,
  originalToRectify,
  seriesOf,
  seriesRefOf,
  nextNumber,
  outstandingOf,
  periodKeyOf,
  type StatusKey,
} from "./sales-model";
import { canSendEmail } from "@/data/email";
import { SalesDocumentLink } from "./document-detail";
import { GroupedSelect } from "./form-fields";
import { PaymentDialog, SendDialog, sendWithMailClient, TagsDialog } from "./document-dialogs";
import { IssuerDialog } from "./issuer-dialog";
import { AttachmentsDialog } from "@/features/purchases/form-parts";
import { OPEN_STATUSES, listPreferencesStore } from "./list-preferences";
import {
  ActionsMenu,
  EmptyState,
  ExportMenu,
  FiltersButton,
  IconAction,
  MoreActionsTrigger,
  SortHeader,
  downloadCsv,
  type Action,
} from "./list-parts";
import { salesStore, useSalesDocuments } from "./sales-store";

const ALL = "all";
/** Status filter for the quotes and delivery notes not invoiced or rejected yet. */
const OPEN = "open";

interface Row {
  doc: SalesDocument;
  client: { name: string; taxId: string };
  status: StatusKey;
  base: Cents;
  vat: Cents;
  withholding: Cents;
  total: Cents;
  /** What is still to be collected of an invoice. */
  outstanding: Cents;
}

const MONTH_NAME = new Intl.DateTimeFormat("es-ES", { month: "long" });

/** Filters behind the "Filtros" button; search and status stay in the toolbar. */
interface Filters {
  /** A client as the documents show it, by `clientKey`. */
  client: string;
  incomeType: string;
  /** Zero-based month within the period, or ALL. */
  month: string;
  tag: string;
  totalFrom: string;
  totalTo: string;
}

const NO_FILTERS: Filters = { client: ALL, incomeType: ALL, month: ALL, tag: ALL, totalFrom: "", totalTo: "" };

/** Contacts with the same name and tax ID are one client to filter by. */
const clientKey = (r: Row) => `${r.client.name}\u0000${r.client.taxId}`;

function matches(r: Row, f: Filters): boolean {
  const from = parseEuros(f.totalFrom);
  const to = parseEuros(f.totalTo);
  return (
    (f.client === ALL || clientKey(r) === f.client) &&
    (f.incomeType === ALL || r.doc.incomeType === f.incomeType) &&
    (f.month === ALL || Number(r.doc.issuedOn.slice(5, 7)) - 1 === Number(f.month)) &&
    (f.tag === ALL || (r.doc.tags ?? []).includes(f.tag)) &&
    (from === null || r.total >= from) &&
    (to === null || r.total <= to)
  );
}

const isOpen = (status: StatusKey) => (OPEN_STATUSES as StatusKey[]).includes(status);

function inPeriod(isoDate: string, period: Period): boolean {
  const [year, month] = isoDate.split("-").map(Number);
  return year === period.year && periodMonths(period).includes(month! - 1);
}

function sum(rows: Row[], key: "base" | "vat" | "withholding" | "total" | "outstanding") {
  return sumBy(rows, (r) => r[key]);
}

const SETTINGS_PATHS: Record<SalesKind, string> = {
  invoice: INVOICE_SETTINGS_PATH,
  draft: DRAFT_SETTINGS_PATH,
  quote: QUOTE_SETTINGS_PATH,
  deliveryNote: DELIVERY_NOTE_SETTINGS_PATH,
};

export function SalesListPage({ kind }: { kind: SalesKind }) {
  const config = KINDS[kind];
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const [query, setQuery] = useState("");
  // Quotes and delivery notes open with the default filters of "Ordenación y filtrado"
  const defaults = kind === "quote" || kind === "deliveryNote" ? listPreferencesStore.get()[kind] : null;
  const [status, setStatus] = useState<string>(defaults?.status === "open" ? OPEN : ALL);
  const [thisMonth, setThisMonth] = useState(defaults?.date === "month");
  const [filters, setFilters] = useState(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const documents = useSalesDocuments();

  // The month filter replaces the period until another period is picked
  const monthPrefix = toIsoDate(today).slice(0, 7);
  const periodRows = useMemo(
    () =>
      documents
        .filter(
          (d) => d.kind === kind && (thisMonth ? d.issuedOn.startsWith(monthPrefix) : inPeriod(d.issuedOn, period)),
        )
        .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || (b.number ?? "").localeCompare(a.number ?? ""))
        .map((doc): Row => ({
          doc,
          client: clientOf(doc),
          status: displayStatus(doc, today),
          ...documentTotals(doc),
          outstanding: doc.kind === "invoice" ? outstandingOf(doc) : cents(0),
        })),
    [documents, kind, period, today, thisMonth, monthPrefix],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = periodRows.filter(
      (r) =>
        (status === ALL || r.status === status || (status === OPEN && isOpen(r.status))) &&
        matches(r, filters) &&
        (!q || [r.doc.number ?? "", r.client.name, r.client.taxId].some((v) => v.toLowerCase().includes(q))),
    );
    return sortRows(matching, sort);
  }, [periodRows, query, status, filters, sort]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const extraFilters = (Object.keys(NO_FILTERS) as (keyof Filters)[]).filter(
    (k) => filters[k] !== NO_FILTERS[k],
  ).length;
  const filtered = query.trim() !== "" || status !== ALL || thisMonth || extraFilters > 0;
  const tags = [...new Set(documents.filter((d) => d.kind === kind).flatMap((d) => d.tags ?? []))].sort();
  const periodClients = [...new Map(periodRows.map((r) => [clientKey(r), r.client.name]))].sort(([, a], [, b]) =>
    a.localeCompare(b, "es"),
  );
  const exportName = `${config.title} ${periodCode(period)}`.toLowerCase().replaceAll(" ", "-");
  const [exporting, setExporting] = useState(false);
  const downloadCsvFile = () => exportCsv(rows, exportName);
  const downloadPdfs = async () => {
    setExporting(true);
    try {
      const { downloadPdfZip } = await import("./sales-pdf");
      downloadPdfZip(
        rows.map((r) => r.doc),
        exportName,
      );
    } finally {
      setExporting(false);
    }
  };
  const canExport = rows.length > 0;
  // On phones the status sits in the filter panel, so the toolbar fits on one line
  const statusFilter = config.statuses.length > 0 && (
    <Select value={status} onValueChange={setStatus}>
      <SelectTrigger aria-label="Filtrar por estado" className="min-w-44">
        <span className="flex-1 text-left">
          <SelectValue />
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Todos los estados</SelectItem>
        {defaults && <SelectItem value={OPEN}>Pendientes</SelectItem>}
        {config.statuses.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS[s].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Page>
      <PageHeader
        title={config.title}
        actions={
          <>
            <ExportMenu
              actions={[
                { label: "Descargar CSV", icon: Download, run: canExport ? downloadCsvFile : undefined },
                {
                  label: `Descargar ${rows.length} PDF (.zip)`,
                  icon: FileArchive,
                  run: canExport && !exporting ? downloadPdfs : undefined,
                },
              ]}
            />
            <SettingsLink
              to={SETTINGS_PATHS[kind]}
              from={config.title.toLowerCase()}
              aria-label={`Configurar ${config.title.toLowerCase()}`}
              title={`Configurar ${config.title.toLowerCase()}`}
              className={buttonVariants({ variant: "secondary", size: "icon" })}
            >
              <Settings strokeWidth={1.8} aria-hidden="true" />
            </SettingsLink>
            <Link to={config.newPath} className={cn(buttonVariants(), "hidden lg:inline-flex")}>
              <Plus strokeWidth={2} aria-hidden="true" />
              {config.newLabel}
            </Link>
          </>
        }
      />

      {kind === "invoice" && <InvoiceSummary rows={periodRows} />}

      <section
        aria-label={`Listado de ${config.title.toLowerCase()}`}
        className="flex animate-rise-in flex-col lg:overflow-hidden lg:surface"
        style={{ "--i": 1 } as CSSProperties}
      >
        <Toolbar>
          <SearchField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por número, cliente o NIF"
            aria-label="Buscar"
          />
          {statusFilter && <div className="max-lg:hidden">{statusFilter}</div>}
          <PeriodSelect
            compact
            value={period}
            onChange={(p) => {
              setPeriod(p);
              setThisMonth(false);
              // The month belongs to the old period
              set("month", ALL);
            }}
            years={availableYears}
            today={today}
          />
          {thisMonth && (
            <Button
              variant="secondary"
              onClick={() => setThisMonth(false)}
              aria-label="Quitar el filtro del mes en curso"
            >
              Solo {MONTH_NAME.format(today)}
              <X aria-hidden="true" />
            </Button>
          )}
          {defaults && (
            <SettingsLink
              to={PREFERENCES_PATH}
              from={config.title.toLowerCase()}
              aria-label="Filtros por defecto"
              title="Filtros por defecto"
              className={buttonVariants({ variant: "secondary", size: "icon" })}
            >
              <SlidersHorizontal strokeWidth={1.8} aria-hidden="true" />
            </SettingsLink>
          )}
          <FiltersButton
            open={showFilters}
            controls="sales-filters"
            count={extraFilters}
            phoneCount={extraFilters + (statusFilter && status !== ALL ? 1 : 0)}
            onToggle={() => setShowFilters((s) => !s)}
          />
          <Button
            variant="secondary"
            className="max-lg:hidden lg:ml-auto"
            disabled={!canExport}
            onClick={downloadCsvFile}
          >
            <Download strokeWidth={1.8} aria-hidden="true" />
            CSV
          </Button>
          <Button
            variant="secondary"
            className="max-lg:hidden"
            disabled={!canExport || exporting}
            aria-label={`Descargar ${rows.length} PDF en un .zip`}
            title="Un PDF por documento, en un .zip"
            onClick={downloadPdfs}
          >
            <FileArchive strokeWidth={1.8} aria-hidden="true" />
            PDF (.zip)
          </Button>
        </Toolbar>

        {showFilters && (
          <FiltersPanel
            lead={
              statusFilter && (
                <div className="flex min-w-0 flex-col gap-1 lg:hidden">
                  <span className="text-xs font-medium text-muted-foreground">Estado</span>
                  {statusFilter}
                </div>
              )
            }
            filters={filters}
            // Within the current month only that month can be picked
            months={thisMonth ? [today.getMonth()] : periodMonths(period)}
            clients={periodClients}
            tags={tags}
            incomeTypes={kind === "invoice" || kind === "draft"}
            onChange={set}
            onClear={() => setFilters(NO_FILTERS)}
          />
        )}

        {rows.length === 0 ? (
          <EmptyState
            message={filtered ? "Ningún resultado coincide con la búsqueda." : config.empty}
            hint={
              filtered ? "Prueba con otro término o quita algún filtro." : "Puedes cambiar el periodo en el selector."
            }
            action={
              !filtered && (
                <Link to={config.newPath} className={cn(buttonVariants({ variant: "secondary" }), "mt-3")}>
                  <Plus strokeWidth={2} aria-hidden="true" />
                  {config.newLabel}
                </Link>
              )
            }
          />
        ) : (
          <>
            {/* Keyed by period so the rows replay their entrance when it changes, like the dashboard */}
            <DocumentsTable key={`table-${periodKey(period)}`} rows={rows} sort={sort} onSort={setSort} />
            <DocumentsList key={`list-${periodKey(period)}`} rows={rows} />
          </>
        )}
      </section>
    </Page>
  );
}

function FiltersPanel({
  lead,
  filters,
  months,
  clients,
  tags,
  incomeTypes,
  onChange,
  onClear,
}: {
  /** Phones: the filters the toolbar has no room for, before the rest. */
  lead?: ReactNode;
  filters: Filters;
  months: number[];
  /** Clients of the period's documents, as [key, name]. */
  clients: [string, string][];
  tags: string[];
  /** Whether the documents carry an income type to filter by. */
  incomeTypes: boolean;
  onChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onClear: () => void;
}) {
  const label = "text-xs font-medium text-muted-foreground";
  const all = (text: string) => ({ value: ALL, label: text });
  return (
    <div
      id="sales-filters"
      className={cn(
        "grid animate-fade-in gap-3 border-y border-border bg-muted/50 py-3 sm:grid-cols-2 lg:items-end lg:px-4",
        incomeTypes ? "lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]" : "lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]",
      )}
    >
      {lead}
      <label className="flex min-w-0 flex-col gap-1">
        <span className={label}>Cliente</span>
        <GroupedSelect
          id="filter-client"
          value={filters.client}
          onChange={(v) => onChange("client", v)}
          groups={[{ options: [all("Todos"), ...clients.map(([key, name]) => ({ value: key, label: name }))] }]}
        />
      </label>
      {incomeTypes && (
        <label className="flex min-w-0 flex-col gap-1">
          <span className={label}>Tipo de ingreso</span>
          <GroupedSelect
            id="filter-income-type"
            value={filters.incomeType}
            onChange={(v) => onChange("incomeType", v)}
            groups={[{ options: [all("Todos")] }, ...INCOME_TYPE_GROUPS]}
          />
        </label>
      )}
      <label className="flex min-w-0 flex-col gap-1">
        <span className={label}>Mes</span>
        <GroupedSelect
          id="filter-month"
          value={filters.month}
          onChange={(v) => onChange("month", v)}
          groups={[
            { options: [all("Todo el periodo"), ...months.map((m) => ({ value: String(m), label: MONTHS[m]! }))] },
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
      <Button variant="secondary" onClick={onClear} className="justify-self-start">
        <X strokeWidth={1.8} aria-hidden="true" />
        Quitar filtros
      </Button>
    </div>
  );
}

/**
 * Same figures as the dashboard for the same period: "Ingresos" is the taxable base (as in
 * Inicio) and the collection cards use totals with VAT (as in its "Estado de cobro").
 */
function InvoiceSummary({ rows }: { rows: Row[] }) {
  const of = (statuses: StatusKey[]) => rows.filter((r) => statuses.includes(r.status));
  const invoices = (n: number) => (n === 1 ? "1 factura" : `${n} facturas`);
  const total = sum(rows, "total");
  const pending = sum(rows, "outstanding");
  const paid = cents(total - pending);
  const overdue = sum(of(["overdue"]), "outstanding");
  const stats: { label: string; value: Cents; detail: ReactNode }[] = [
    {
      label: "Ingresos",
      value: sum(rows, "base"),
      detail: `Sin IVA · IVA repercutido ${formatEUR(sum(rows, "vat"))}`,
    },
    {
      label: "Total facturado",
      value: total,
      detail: `${invoices(rows.length)} · con IVA y retención`,
    },
    {
      label: "Cobrado",
      value: paid,
      detail: `${invoices(of(["paid"]).length)} · ${formatPercent(total ? (paid / total) * 100 : 0)}`,
    },
    {
      label: "Pendiente de cobro",
      value: pending,
      detail:
        overdue > 0 ? (
          <span className="text-destructive">{formatEUR(overdue)} vencido</span>
        ) : (
          `${invoices(of(["pending", "partial"]).length)} en plazo`
        ),
    },
  ];
  // Phones already get these figures on Inicio: the list starts right away
  return (
    <dl className="m-0 hidden animate-rise-in gap-4 lg:grid lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1.5 surface p-4 lg:p-5">
          <dt className="text-md font-semibold text-foreground lg:text-lg">{s.label}</dt>
          <dd className="m-0 amount text-xl font-semibold lg:text-2xl">
            <AnimatedAmount value={s.value} />
          </dd>
          <dd className="m-0 text-sm text-muted-foreground">{s.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

type SortKey = "number" | "date" | "client" | "status" | "base" | "vat" | "withholding" | "total";
type SortDir = "asc" | "desc";
interface Sort {
  key: SortKey;
  dir: SortDir;
}

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "number", label: "Nº" },
  { key: "date", label: "Fecha" },
  { key: "client", label: "Cliente" },
  { key: "status", label: "Estado" },
  { key: "base", label: "Base\nimponible", numeric: true },
  { key: "vat", label: "IVA", numeric: true },
  { key: "withholding", label: "Retención", numeric: true },
  { key: "total", label: "Total", numeric: true },
];

const byText = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

const COMPARE: Record<SortKey, (a: Row, b: Row) => number> = {
  number: (a, b) => byText(a.doc.number ?? "", b.doc.number ?? ""),
  // Invoices of the same day in the order they were issued, whatever their series
  date: (a, b) =>
    a.doc.issuedOn.localeCompare(b.doc.issuedOn) ||
    issueOrder(a.doc).localeCompare(issueOrder(b.doc)) ||
    byText(a.doc.number ?? "", b.doc.number ?? ""),
  client: (a, b) => byText(a.client.name, b.client.name),
  status: (a, b) => byText(STATUS[a.status].label, STATUS[b.status].label),
  base: (a, b) => a.base - b.base,
  vat: (a, b) => a.vat - b.vat,
  withholding: (a, b) => a.withholding - b.withholding,
  total: (a, b) => a.total - b.total,
};

/** When a document was issued; one being issued now goes last, and other documents first. */
const issueOrder = (doc: SalesDocument) => (doc.kind === "invoice" ? (doc.issued?.issuedAt ?? "~") : "");

const DEFAULT_SORT: Sort = { key: "date", dir: "desc" };

function sortRows(rows: Row[], sort: Sort): Row[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * COMPARE[sort.key](a, b));
}

/** Clicking the active column flips it; a new column starts with the most useful direction. */
function nextSort(current: Sort, key: SortKey): Sort {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  const textual = key === "client" || key === "status" || key === "number";
  return { key, dir: textual && key !== "number" ? "asc" : "desc" };
}

function DocumentsTable({ rows, sort, onSort }: { rows: Row[]; sort: Sort; onSort: (sort: Sort) => void }) {
  // Tighter than the default so nine columns fit on a laptop screen.
  const th = cn(table.th, "px-3");
  const td = cn(table.td, "px-3");
  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[960px] border-collapse">
          <thead>
            <tr className={table.headRow}>
              {COLUMNS.map((c) => (
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
            {rows.map((r, i) => (
              <tr
                key={r.doc.id}
                className={cn(table.row, "animate-row-in", r.status === "overdue" && "bg-destructive-soft/40")}
                style={{ "--i": i } as CSSProperties}
              >
                <td className={cn(td, "whitespace-nowrap tabular-nums")}>
                  <SalesDocumentLink doc={r.doc} className="text-foreground no-underline hover:text-primary">
                    {r.doc.number ?? <span className="font-sans text-muted-foreground">Sin número</span>}
                  </SalesDocumentLink>
                  <TagChips tags={r.doc.tags} className="mt-1 max-w-48" />
                </td>
                <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatDate(r.doc.issuedOn)}</td>
                <td className={td}>
                  <div className="flex flex-col">
                    <span className="font-medium whitespace-nowrap">{r.client.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{r.client.taxId}</span>
                  </div>
                </td>
                <td className={td}>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                </td>
                <td className={cn(td, "text-right amount")}>{formatEUR(r.base)}</td>
                <td className={cn(td, "text-right amount text-muted-foreground")}>{formatEUR(r.vat)}</td>
                <td className={cn(td, "text-right amount text-muted-foreground")}>
                  {r.withholding ? formatEUR(cents(-r.withholding)) : "—"}
                </td>
                <td className={cn(td, "text-right amount font-semibold")}>{formatEUR(r.total)}</td>
                <td className={cn(td, "px-1.5 first:pl-1.5 last:pr-1.5")}>
                  <QuickActions doc={r.doc} status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted font-semibold">
              <td colSpan={4} className={cn(td, "text-sm text-muted-foreground")}>
                {rows.length} {rows.length === 1 ? "documento" : "documentos"}
              </td>
              <td className={cn(td, "text-right amount")}>
                <AnimatedAmount value={sum(rows, "base")} />
              </td>
              <td className={cn(td, "text-right amount")}>
                <AnimatedAmount value={sum(rows, "vat")} />
              </td>
              <td className={cn(td, "text-right amount")}>
                <AnimatedAmount value={cents(-sum(rows, "withholding"))} />
              </td>
              <td className={cn(td, "text-right amount")}>
                <AnimatedAmount value={sum(rows, "total")} />
              </td>
              <td className={td} />
            </tr>
          </tfoot>
        </table>
      </div>
    </TooltipProvider>
  );
}

function DocumentsList({ rows }: { rows: Row[] }) {
  return (
    <ul className="m-0 flex list-none flex-col overflow-hidden surface px-4 py-0 lg:hidden">
      {rows.map((r, i) => (
        <li
          key={r.doc.id}
          className="flex animate-row-in items-center gap-1 border-b border-divider"
          style={{ "--i": i } as CSSProperties}
        >
          <Link
            to={`${KINDS[r.doc.kind].path}/${r.doc.id}`}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-3 text-foreground no-underline transition-opacity duration-150 active:opacity-60"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{r.client.name}</span>
              <span className="text-sm text-muted-foreground">
                {r.doc.number ?? "Sin número"} · {formatShortDate(r.doc.issuedOn)}
              </span>
              <TagChips tags={r.doc.tags} className="mt-0.5" />
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="amount text-base">{formatEUR(r.total)}</span>
              <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
            </div>
          </Link>
          <RowActions doc={r.doc} status={r.status} />
        </li>
      ))}
      <li className="flex justify-between py-3 text-sm text-muted-foreground">
        <span>
          {rows.length} {rows.length === 1 ? "documento" : "documentos"}
        </span>
        <span>
          Total <AnimatedAmount value={sum(rows, "total")} className="amount font-semibold text-foreground" />
        </span>
      </li>
    </ul>
  );
}

/** Every operation available on a document, grouped so the menu can split them with separators. */
function useDocumentActions(doc: SalesDocument, status: StatusKey) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<"payment" | "attachments" | "tags" | "send" | "issuer" | null>(null);
  const config = KINDS[doc.kind];
  const label = doc.number ?? "sin número";
  const attachments = doc.attachments ?? [];
  // Drafts can't be issued into a closed quarter, nor invoices deleted from one
  const lockedQuarter = useLockedQuarter()(doc.issuedOn);
  const blocker =
    doc.kind !== "invoice" ? null : lockedQuarter ? "trimestre cerrado" : deleteBlocker(doc, salesStore.all());
  const original = originalToRectify(doc, salesStore.all());
  const rectifiedAway =
    doc.series === "normal" && original !== undefined && isFullyRectified(original, salesStore.all());

  const attach: Action = {
    label: attachments.length > 0 ? `Documentos adjuntos (${attachments.length})` : "Adjuntar documentos",
    icon: Paperclip,
    run: () => setDialog("attachments"),
  };

  const pdf: Action = {
    label: "Descargar PDF",
    icon: FileDown,
    run: () => void import("./sales-pdf").then((m) => m.downloadDocumentPdf(doc)),
  };

  const tags = doc.tags ?? [];
  const extras = {
    view: {
      label: `Ver ${config.singular.toLowerCase()} ${doc.number ?? ""}`.trim(),
      icon: ExternalLink,
      run: () => {
        // Opened now, while the click still counts, and filled once the PDF code loads
        const tab = window.open("", "_blank");
        if (tab) void import("./sales-pdf").then((m) => m.showDocumentPdf(doc, tab));
      },
    },
    payments: {
      label: "Gestionar el cobro",
      icon: CircleDollarSign,
      run: () => setDialog("payment"),
    },
    tags: {
      label: tags.length > 0 ? `Gestionar etiquetas (${tags.length})` : "Gestionar etiquetas",
      icon: Tag,
      run: () => setDialog("tags"),
    },
    facturae: {
      label: "Exportar Facturae",
      icon: FileCode2,
      run: () =>
        void import("./sales-facturae").then((m) => {
          const problems = m.facturaeProblems(doc);
          if (problems.length > 0) window.alert(`Para exportar la factura en Facturae falta ${problems.join(" y ")}.`);
          else m.downloadFacturae(doc);
        }),
    },
    send: {
      label: `Enviar ${config.singular.toLowerCase()}`,
      icon: Mail,
      run: () => (canSendEmail() ? setDialog("send") : sendWithMailClient(doc)),
    },
  } satisfies Record<string, Action>;

  const issueDraft = () => {
    if (missingIssuerData(settingsStore.get().profile)) {
      setDialog("issuer");
      return;
    }
    // Drafts don't show their series: one deactivated since goes to the default series of its type
    const own = seriesOf(doc);
    const draft = own.active === false ? { ...doc, ...seriesRefOf(defaultSeries(own.type)) } : doc;
    const later = laterInvoice(draft, doc.issuedOn, salesStore.all());
    if (later) {
      window.alert(
        `No se puede emitir: la factura ${later.number} de esta serie es del ${formatDate(later.issuedOn)} y este borrador tiene una fecha anterior. Cambia su fecha antes de emitirlo.`,
      );
      return;
    }
    salesStore.issue({
      ...draft,
      kind: "invoice",
      status: "pending",
      number: nextNumber("invoice", draft, doc.issuedOn, salesStore.all()),
    });
    navigate(`${KINDS.invoice.path}?periodo=${periodKeyOf(doc.issuedOn)}`);
  };

  const workflow = doc.kind === "quote" || doc.kind === "deliveryNote";
  let primary: Action | null = null;
  if (doc.kind === "invoice") {
    primary = extras.payments;
  } else if (doc.kind === "draft") {
    primary = lockedQuarter
      ? { label: "Emitir factura (trimestre cerrado)", icon: ReceiptText }
      : { label: "Emitir factura", icon: ReceiptText, run: issueDraft };
  } else if (workflow && status !== "invoiced") {
    primary = {
      label: "Convertir en factura",
      icon: ReceiptText,
      run: () => navigate(`${KINDS.invoice.newPath}?desde=${doc.id}`),
    };
  }

  // Any status can be chosen, back to "created" too; "invoiced" is set by converting the document into an invoice
  const changeStatus: Action | null = workflow
    ? {
        label: "Cambiar estado",
        icon: CircleDot,
        choice: {
          value: doc.status,
          options: config.statuses.map((value) => ({
            value,
            label: STATUS[value].label,
            ...(value === "invoiced" &&
              doc.status !== "invoiced" && { disabled: true, hint: "Al convertirlo en factura" }),
          })),
          onChange: (value) => {
            if (
              doc.status === "invoiced" &&
              !window.confirm(
                `${config.noun[0]!.toUpperCase()}${config.noun.slice(1)} ${label} ya está facturado. Si cambias su estado, podrás volver a convertirlo en factura. ¿Continuar?`,
              )
            )
              return;
            salesStore.update(doc.id, { status: value as SalesDocument["status"] });
          },
        },
      }
    : null;

  const isInvoice = doc.kind === "invoice";
  const groups: Action[][] = [
    [
      extras.view,
      {
        label: isInvoice ? `Ver los datos de ${config.noun}` : `Editar ${config.singular.toLowerCase()}`,
        icon: Pencil,
        run: () => navigate(`${config.path}/${doc.id}`),
      },
      { label: "Crear por copia", icon: Copy, run: () => navigate(`${config.newPath}?desde=${doc.id}`) },
    ],
    [...(primary ? [primary] : []), ...(changeStatus ? [changeStatus] : []), attach, extras.tags],
    [pdf, ...(isInvoice ? [extras.facturae] : []), extras.send],
    // On a rectifying invoice it rectifies the original again, undoing this one
    original
      ? [
          {
            label: `Generar factura rectificativa${rectifiedAway ? " (ya rectificada por completo)" : ""}`,
            icon: FileX2,
            run: rectifiedAway ? undefined : () => navigate(`${config.newPath}?desde=${doc.id}&rectificar=1`),
          },
        ]
      : [],
    [
      {
        label:
          `Eliminar ${config.singular.toLowerCase()} ${doc.number ?? ""}`.trim() + (blocker ? ` (${blocker})` : ""),
        icon: Trash2,
        danger: true,
        run: blocker
          ? undefined
          : () => {
              if (window.confirm(`¿Eliminar ${config.noun} ${label}? No se puede deshacer.`)) salesStore.remove(doc.id);
            },
      },
    ],
  ].filter((g) => g.length > 0);

  const close = (open: boolean) => !open && setDialog(null);
  const dialogs =
    dialog === "payment" ? (
      <PaymentDialog doc={doc} onOpenChange={close} />
    ) : dialog === "attachments" ? (
      <AttachmentsDialog
        title={`Documentos de ${config.noun} ${label}`}
        attachments={attachments}
        examples="Contratos, albaranes firmados, pedidos del cliente…"
        onChange={(next) => salesStore.update(doc.id, { attachments: next })}
        onOpenChange={close}
      />
    ) : dialog === "tags" ? (
      <TagsDialog doc={doc} title={`${config.noun} ${label}`} onOpenChange={close} />
    ) : dialog === "send" ? (
      <SendDialog doc={doc} onOpenChange={close} />
    ) : dialog === "issuer" ? (
      <IssuerDialog open issues onOpenChange={close} onSaved={issueDraft} />
    ) : null;

  return {
    attach,
    pdf,
    primary,
    groups,
    dialogs,
    attachments: attachments.length,
    label: `${config.noun} ${label}`,
  };
}

/** Desktop: the usual operations one click away, the rest behind the ellipsis. */
function QuickActions({ doc, status }: { doc: SalesDocument; status: StatusKey }) {
  const { attach, pdf, primary, groups, dialogs, attachments, label } = useDocumentActions(doc, status);
  return (
    <div className="flex items-center justify-center gap-0.5">
      {dialogs}
      <IconAction action={attach} badge={attachments} />
      <IconAction action={pdf} />
      {primary ? <IconAction action={primary} /> : <span className="size-8" aria-hidden="true" />}
      <ActionsMenu groups={groups} trigger={<MoreActionsTrigger label={`Más acciones de ${label}`} tooltip />} />
    </div>
  );
}

/** Mobile: everything in one menu. */
function RowActions({ doc, status }: { doc: SalesDocument; status: StatusKey }) {
  const { groups, dialogs, label } = useDocumentActions(doc, status);
  return (
    <>
      {dialogs}
      <ActionsMenu groups={groups} inlineChoices trigger={<MoreActionsTrigger label={`Acciones de ${label}`} />} />
    </>
  );
}

function exportCsv(rows: Row[], name: string) {
  downloadCsv(
    ["Número", "Fecha", "Cliente", "NIF", "Estado", "Base imponible", "IVA", "Retención", "Total"],
    rows.map((r) => [
      r.doc.number ?? "",
      r.doc.issuedOn,
      r.client.name,
      r.client.taxId,
      STATUS[r.status].label,
      r.base,
      r.vat,
      r.withholding,
      r.total,
    ]),
    name,
  );
}

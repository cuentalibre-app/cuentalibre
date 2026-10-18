import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  ChevronDown,
  CircleDollarSign,
  Copy,
  Download,
  ExternalLink,
  Filter,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { newId, periodKey, periodMonths, sumBy, toIsoDate, type Cents, type Period } from "@fiscalia/core";
import type { Expense, OtherPayee } from "@fiscalia/contracts";
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
import { paymentMethodName } from "@/features/settings/settings-model";
import {
  EXPENSES_PATH,
  EXPENSE_STATUS,
  EXPENSE_STATUS_ORDER,
  NEW_EXPENSE_PATH,
  deductibleOf,
  expenseStatus,
  payeeKey,
  payeeOf,
  type ExpenseStatus,
} from "./expenses-model";
import { expensesStore, useExpenses } from "./expenses-store";
import { EXPENSE_TYPE_GROUPS, PURCHASES_PATH, expenseTypeLabel, expenseTypeShortLabel } from "./purchases-model";

const ALL = "all";
/** Social security of the self-employed owner (PGC 6422). */
const SOCIAL_SECURITY_TYPE = "6422";

interface Row {
  doc: Expense;
  payee: OtherPayee | null;
  payeeKey: string;
  status: ExpenseStatus;
  amount: Cents;
  deductible: Cents;
}

function inPeriod(isoDate: string, period: Period): boolean {
  const [year, month] = isoDate.split("-").map(Number);
  return year === period.year && periodMonths(period).includes(month! - 1);
}

function sum(rows: Row[], key: "amount" | "deductible") {
  return sumBy(rows, (r) => r[key]);
}

interface Filters {
  query: string;
  status: string;
  expenseType: string;
  payee: string;
  /** Zero-based month within the period, or ALL. */
  month: string;
  tag: string;
  amountFrom: string;
  amountTo: string;
}

const NO_FILTERS: Filters = {
  query: "",
  status: ALL,
  expenseType: ALL,
  payee: ALL,
  month: ALL,
  tag: ALL,
  amountFrom: "",
  amountTo: "",
};

function matches(r: Row, f: Filters): boolean {
  const q = f.query.trim().toLowerCase();
  const from = parseEuros(f.amountFrom);
  const to = parseEuros(f.amountTo);
  return (
    (f.status === ALL || r.status === f.status) &&
    (f.expenseType === ALL || r.doc.expenseType === f.expenseType) &&
    (f.payee === ALL || r.payeeKey === f.payee) &&
    (f.month === ALL || Number(r.doc.date.slice(5, 7)) - 1 === Number(f.month)) &&
    (f.tag === ALL || (r.doc.tags ?? []).includes(f.tag)) &&
    (from === null || r.amount >= from) &&
    (to === null || r.amount <= to) &&
    (!q ||
      [r.doc.number, r.doc.concept, r.payee?.name ?? "", r.payee?.taxId ?? "", r.doc.privateNotes].some((v) =>
        v.toLowerCase().includes(q),
      ))
  );
}

export function ExpensesListPage() {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const expenses = useExpenses();

  const periodRows = useMemo(
    () =>
      expenses
        .filter((e) => inPeriod(e.date, period))
        .map((doc): Row => ({
          doc,
          payee: payeeOf(doc),
          payeeKey: payeeKey(doc),
          status: expenseStatus(doc),
          amount: doc.amount,
          deductible: deductibleOf(doc),
        })),
    [expenses, period],
  );

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
  const extraFilters = (["expenseType", "payee", "month", "tag", "amountFrom", "amountTo"] as const).filter(
    (k) => filters[k] !== NO_FILTERS[k],
  ).length;
  const filtered = extraFilters > 0 || filters.query.trim() !== "" || filters.status !== ALL;

  const tags = [...new Set(expenses.flatMap((e) => e.tags ?? []))].sort();
  const payees = [
    ...new Map(periodRows.filter((r) => r.payee).map((r) => [r.payeeKey, { value: r.payeeKey, label: r.payee!.name }])),
  ]
    .map(([, option]) => option)
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  const exportName = `gastos-${periodCode(period)}`.toLowerCase();

  const filterByPayee = (key: string) => {
    set("payee", key);
    setShowFilters(true);
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 lg:gap-4 lg:px-8 lg:pt-6 lg:pb-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">Gastos</h1>
            <p className="m-0 text-sm text-muted-foreground">
              Lo que pagas sin factura: cuota de autónomos, tasas, comisiones, tickets… ¿Tienes factura?{" "}
              <Link to={PURCHASES_PATH} className="font-medium text-primary no-underline hover:text-primary-hover">
                Regístrala como factura recibida
              </Link>
              .
            </p>
          </div>
          <Link to={NEW_EXPENSE_PATH} className={cn(buttonVariants(), "hidden no-underline lg:inline-flex")}>
            <Plus strokeWidth={2} aria-hidden="true" />
            Nuevo gasto
          </Link>
        </header>

        <ExpenseSummary rows={periodRows} />

        <section
          aria-label="Listado de gastos"
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
                placeholder="Buscar por concepto, proveedor, NIF o número"
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
                {EXPENSE_STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {EXPENSE_STATUS[s].label}
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
              aria-controls="expense-filters"
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
                onClick={() => exportCsv(rows, exportName)}
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
              payees={payees}
              tags={tags}
              onChange={set}
              onClear={() => setFilters((f) => ({ ...NO_FILTERS, query: f.query, status: f.status }))}
            />
          )}

          {rows.length === 0 ? (
            <EmptyState
              message={filtered ? "Ningún gasto coincide con los filtros." : "No hay gastos en este periodo."}
              hint={
                filtered ? "Prueba con otro término o quita algún filtro." : "Puedes cambiar el periodo en el selector."
              }
              action={
                !filtered && (
                  <Link
                    to={NEW_EXPENSE_PATH}
                    className={cn(buttonVariants({ variant: "secondary" }), "mt-3 no-underline")}
                  >
                    <Plus strokeWidth={2} aria-hidden="true" />
                    Nuevo gasto
                  </Link>
                )
              }
            />
          ) : (
            <>
              {/* Keyed by period so the rows replay their entrance when it changes, like the dashboard */}
              <ExpensesTable
                key={`table-${periodKey(period)}`}
                rows={rows}
                sort={sort}
                onSort={setSort}
                onFilterPayee={filterByPayee}
              />
              <ExpensesList key={`list-${periodKey(period)}`} rows={rows} />
            </>
          )}
        </section>
      </div>
    </TooltipProvider>
  );
}

function ExpenseSummary({ rows }: { rows: Row[] }) {
  const count = (n: number) => (n === 1 ? "1 gasto" : `${n} gastos`);
  const pending = rows.filter((r) => r.status === "pending");
  const socialSecurity = rows.filter((r) => r.doc.expenseType === SOCIAL_SECURITY_TYPE);
  const stats: { label: string; value: Cents; detail: ReactNode }[] = [
    {
      label: "Gasto deducible",
      value: sum(rows, "deductible"),
      detail: "Tras aplicar la imputación",
    },
    {
      label: "Total gastos",
      value: sum(rows, "amount"),
      detail: `${count(rows.length)} · impuestos incluidos`,
    },
    {
      label: "Cuota de autónomos",
      value: sum(socialSecurity, "amount"),
      detail: socialSecurity.length === 1 ? "1 cuota en el periodo" : `${socialSecurity.length} cuotas en el periodo`,
    },
    {
      label: "Pendiente de pago",
      value: sum(pending, "amount"),
      detail: `${count(pending.length)} sin pagar`,
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
  payees,
  tags,
  onChange,
  onClear,
}: {
  filters: Filters;
  period: Period;
  payees: { value: string; label: string }[];
  tags: string[];
  onChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onClear: () => void;
}) {
  const label = "text-xs font-medium text-muted-foreground";
  const all = (text: string) => ({ value: ALL, label: text });
  return (
    <div
      id="expense-filters"
      className="grid animate-fade-in gap-3 border-y border-border bg-muted/50 py-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end lg:px-4"
    >
      <label className="flex min-w-0 flex-col gap-1">
        <span className={label}>Proveedor</span>
        <GroupedSelect
          id="filter-payee"
          value={filters.payee}
          onChange={(v) => onChange("payee", v)}
          groups={[{ options: [all("Todos"), ...payees] }]}
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
        <legend className={cn(label, "mb-1 p-0")}>Importe entre</legend>
        <div className="flex items-center gap-1.5">
          <Input
            inputMode="decimal"
            placeholder="Desde"
            aria-label="Importe desde"
            value={filters.amountFrom}
            onChange={(e) => onChange("amountFrom", e.target.value)}
            aria-invalid={filters.amountFrom && parseEuros(filters.amountFrom) === null ? true : undefined}
            className="text-right amount"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            inputMode="decimal"
            placeholder="Hasta"
            aria-label="Importe hasta"
            value={filters.amountTo}
            onChange={(e) => onChange("amountTo", e.target.value)}
            aria-invalid={filters.amountTo && parseEuros(filters.amountTo) === null ? true : undefined}
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

type SortKey = "date" | "concept" | "payee" | "type" | "status" | "amount" | "deductible";
type SortDir = "asc" | "desc";
interface Sort {
  key: SortKey;
  dir: SortDir;
}

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "date", label: "Fecha" },
  { key: "concept", label: "Concepto" },
  { key: "payee", label: "Proveedor" },
  { key: "type", label: "Tipo de gasto" },
  { key: "status", label: "Estado" },
  { key: "amount", label: "Importe", numeric: true },
  { key: "deductible", label: "Deducible", numeric: true },
];

const byText = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

const COMPARE: Record<SortKey, (a: Row, b: Row) => number> = {
  date: (a, b) => a.doc.date.localeCompare(b.doc.date),
  concept: (a, b) => byText(a.doc.concept, b.doc.concept),
  payee: (a, b) => byText(a.payee?.name ?? "", b.payee?.name ?? ""),
  type: (a, b) => byText(expenseTypeShortLabel(a.doc.expenseType), expenseTypeShortLabel(b.doc.expenseType)),
  status: (a, b) => byText(EXPENSE_STATUS[a.status].label, EXPENSE_STATUS[b.status].label),
  amount: (a, b) => a.amount - b.amount,
  deductible: (a, b) => a.deductible - b.deductible,
};

const DEFAULT_SORT: Sort = { key: "date", dir: "desc" };

function sortRows(rows: Row[], sort: Sort): Row[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * COMPARE[sort.key](a, b));
}

/** Clicking the active column flips it; a new column starts with the most useful direction. */
function nextSort(current: Sort, key: SortKey): Sort {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: key === "date" || key === "amount" || key === "deductible" ? "desc" : "asc" };
}

const editPath = (doc: Expense) => `${EXPENSES_PATH}/${doc.id}`;

function ExpensesTable({
  rows,
  sort,
  onSort,
  onFilterPayee,
}: {
  rows: Row[];
  sort: Sort;
  onSort: (sort: Sort) => void;
  onFilterPayee: (key: string) => void;
}) {
  const th = cn(table.th, "px-2.5");
  const td = cn(table.td, "px-2.5");
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[980px] border-collapse">
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
            <tr key={r.doc.id} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
              <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatDate(r.doc.date)}</td>
              <td className={td}>
                <div className="flex min-w-0 flex-col">
                  <Link
                    to={editPath(r.doc)}
                    title={r.doc.concept}
                    className="block max-w-48 truncate font-medium text-foreground no-underline hover:text-primary"
                  >
                    {r.doc.concept}
                  </Link>
                  {r.doc.number && <span className="font-mono text-xs text-muted-foreground">{r.doc.number}</span>}
                </div>
              </td>
              <td className={td}>
                {r.payee ? (
                  <div className="group relative flex items-center">
                    <div className="flex min-w-0 flex-col">
                      <span className="max-w-36 truncate whitespace-nowrap" title={r.payee.name}>
                        {r.payee.name}
                      </span>
                      {r.payee.taxId && (
                        <span className="font-mono text-xs text-muted-foreground">{r.payee.taxId}</span>
                      )}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Ver solo los gastos de ${r.payee.name}`}
                          onClick={() => onFilterPayee(r.payeeKey)}
                          className="absolute -right-1.5 size-7 bg-card px-0 opacity-0 shadow-sm group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <Filter className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Filtrar por este proveedor</TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className={cn(td, "text-sm")}>
                <span className="block max-w-32 truncate" title={expenseTypeLabel(r.doc.expenseType)}>
                  {expenseTypeShortLabel(r.doc.expenseType)}
                </span>
              </td>
              <td className={td}>
                <StatusBadge row={r} />
              </td>
              <td className={cn(td, "text-right amount font-semibold")}>{formatEUR(r.amount)}</td>
              <td className={cn(td, "text-right")}>
                <span className="amount text-muted-foreground">{formatEUR(r.deductible)}</span>
                {r.doc.imputation !== 100 && (
                  <span className="block text-xs font-medium whitespace-nowrap text-warning">
                    Deducible {r.doc.imputation} %
                  </span>
                )}
              </td>
              <td className={cn(td, "px-1.5 first:pl-1.5 last:pr-1.5")}>
                <QuickActions row={r} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted font-semibold">
            <td colSpan={5} className={cn(td, "text-sm text-muted-foreground")}>
              {rows.length} {rows.length === 1 ? "gasto" : "gastos"}
            </td>
            <td className={cn(td, "text-right amount")}>
              <AnimatedAmount value={sum(rows, "amount")} />
            </td>
            <td className={cn(td, "text-right amount")}>
              <AnimatedAmount value={sum(rows, "deductible")} />
            </td>
            <td className={td} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function StatusBadge({ row }: { row: Row }) {
  const status = EXPENSE_STATUS[row.status];
  const { payment } = row.doc;
  const detail = payment
    ? `Pagado el ${formatDate(payment.date)} · ${paymentMethodName(payment.paymentMethodId) ?? "Método eliminado"}.`
    : status.hint;
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

function ExpensesList({ rows }: { rows: Row[] }) {
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
              <span className="truncate font-medium">{r.doc.concept}</span>
              <span className="truncate text-sm text-muted-foreground">
                {[r.payee?.name, formatShortDate(r.doc.date)].filter(Boolean).join(" · ")}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="amount text-base">{formatEUR(r.amount)}</span>
              <Badge tone={EXPENSE_STATUS[r.status].tone}>{EXPENSE_STATUS[r.status].label}</Badge>
            </div>
          </Link>
          <RowActions row={r} />
        </li>
      ))}
      <li className="flex justify-between py-3 text-sm text-muted-foreground">
        <span>
          {rows.length} {rows.length === 1 ? "gasto" : "gastos"}
        </span>
        <span>
          Total <AnimatedAmount value={sum(rows, "amount")} className="amount font-semibold text-foreground" />
        </span>
      </li>
    </ul>
  );
}

/** Every operation available on an expense, grouped so the menu can split them with separators. */
function useExpenseActions(row: Row) {
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
          id: newId(),
          name: f.name,
          size: f.size,
          url: URL.createObjectURL(f),
        }));
        expensesStore.update(doc.id, { attachments: [...attachments, ...added] });
      }),
  };

  const view: Action = {
    label: viewable ? "Ver justificante" : "Sin justificante adjunto en esta sesión",
    icon: ExternalLink,
    run: viewable ? () => window.open(viewable.url, "_blank", "noopener") : undefined,
  };

  const primary: Action = doc.payment
    ? { label: "Marcar como pendiente", icon: Undo2, run: () => expensesStore.update(doc.id, { payment: null }) }
    : {
        label: "Marcar como pagado",
        icon: CircleDollarSign,
        run: () =>
          expensesStore.update(doc.id, {
            payment: { date: toIsoDate(new Date()), paymentMethodId: "bank1" },
          }),
      };

  const locked = lockedQuarterOf(doc.date) !== null;
  const groups: Action[][] = [
    [
      { label: locked ? "Ver gasto" : "Editar gasto", icon: Pencil, run: () => navigate(editPath(doc)) },
      { label: "Crear por copia", icon: Copy, run: () => navigate(`${NEW_EXPENSE_PATH}?desde=${doc.id}`) },
    ],
    [primary, attach, view],
    [
      {
        label: locked ? "Eliminar gasto (trimestre cerrado)" : "Eliminar gasto",
        icon: Trash2,
        danger: true,
        run: locked
          ? undefined
          : () => {
              if (
                window.confirm(`¿Eliminar el gasto «${doc.concept}» de ${formatEUR(doc.amount)}? No se puede deshacer.`)
              )
                expensesStore.remove(doc.id);
            },
      },
    ],
  ];

  return { attach, primary, groups, attachments: attachments.length, label: `el gasto ${doc.concept}` };
}

/** Desktop: the usual operations one click away, the rest behind the arrow. */
function QuickActions({ row }: { row: Row }) {
  const { attach, primary, groups, attachments, label } = useExpenseActions(row);
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
  const { groups, label } = useExpenseActions(row);
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

function exportCsv(rows: Row[], name: string) {
  downloadCsv(
    [
      "Fecha",
      "Número",
      "Concepto",
      "Proveedor",
      "NIF",
      "Tipo de gasto",
      "Estado",
      "Fecha de pago",
      "Método de pago",
      "Importe",
      "Imputación %",
      "Deducible",
    ],
    rows.map((r) => [
      r.doc.date,
      r.doc.number,
      r.doc.concept,
      r.payee?.name ?? "",
      r.payee?.taxId ?? "",
      expenseTypeLabel(r.doc.expenseType),
      EXPENSE_STATUS[r.status].label,
      r.doc.payment?.date ?? "",
      r.doc.payment ? (paymentMethodName(r.doc.payment.paymentMethodId) ?? "") : "",
      r.amount,
      String(r.doc.imputation),
      r.deductible,
    ]),
    name,
  );
}

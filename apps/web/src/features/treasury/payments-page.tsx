import { useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowUpRight, ChevronDown, Download, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { cents, isInPeriod, monthlyFlows, periodKey, sumBy } from "@cuentalibre/core";
import { Button } from "@cuentalibre/ui/components/button";
import { DropdownMenuTrigger } from "@cuentalibre/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { AnimatedAmount } from "@/components/animated-amount";
import { PeriodSelect } from "@/components/period-select";
import { GroupedSelect } from "@/features/sales/form-fields";
import { ActionsMenu, EmptyState, IconAction, SortHeader, downloadCsv, type Action } from "@/features/sales/list-parts";
import { ConfirmDialog } from "@/features/settings/settings-parts";
import { useSettings } from "@/features/settings/settings-store";
import { formatDate, formatShortDate, periodCode } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { availableYears } from "@/mocks/data";
import { FlowsChart } from "./flows-chart";
import { ManualPaymentDialog, PageHeader, SignedAmount } from "./treasury-parts";
import { PAYMENT_SOURCES, PAYMENT_SOURCE_ORDER, type TreasuryPayment } from "./treasury-model";
import { treasuryStore, usePayments } from "./treasury-store";

const ALL = "all";

interface Row {
  payment: TreasuryPayment;
  method: string;
}

interface Filters {
  query: string;
  source: string;
  method: string;
}

const NO_FILTERS: Filters = { query: "", source: ALL, method: ALL };

type SortKey = "date" | "amount" | "method";
interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

/** Banks: what came in and went out over the last year, and every collection and payment. */
export function PaymentsPage() {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const { paymentMethods } = useSettings();
  const payments = usePayments();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState<Sort>({ key: "date", dir: "desc" });
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<TreasuryPayment | null>(null);

  const periodRows = useMemo(
    () =>
      payments
        .filter((p) => isInPeriod(p.date, period))
        .map((payment): Row => ({
          payment,
          method: paymentMethods.find((m) => m.id === payment.paymentMethodId)?.name ?? "Sin método",
        })),
    [payments, period, paymentMethods],
  );
  const months = useMemo(() => monthlyFlows(payments, today), [payments, today]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const q = filters.query.trim().toLowerCase();
  const sign = sort.dir === "asc" ? 1 : -1;
  const rows = periodRows
    .filter(
      (r) =>
        (filters.source === ALL || r.payment.source === filters.source) &&
        (filters.method === ALL || r.payment.paymentMethodId === filters.method) &&
        (!q ||
          [r.payment.reference, r.payment.counterparty, formatEUR(r.payment.amount)].some((v) =>
            v.toLowerCase().includes(q),
          )),
    )
    .sort((a, b) =>
      sort.key === "date"
        ? sign * a.payment.date.localeCompare(b.payment.date)
        : sort.key === "amount"
          ? sign * (a.payment.amount - b.payment.amount)
          : sign * a.method.localeCompare(b.method, "es"),
    );
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
  const collected = sumBy(
    rows.filter((r) => r.payment.amount > 0),
    (r) => r.payment.amount,
  );
  const paid = cents(
    -sumBy(
      rows.filter((r) => r.payment.amount < 0),
      (r) => r.payment.amount,
    ),
  );

  const sortHeader = (key: SortKey, label: string, numeric?: boolean) => (
    <SortHeader
      label={label}
      numeric={numeric}
      dir={sort.key === key ? sort.dir : null}
      onClick={() =>
        setSort((s) =>
          s.key === key
            ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
            : { key, dir: key === "method" ? "asc" : "desc" },
        )
      }
      className={table.th}
    />
  );

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8">
        <PageHeader
          title="Cobros y pagos"
          description="Lo que has cobrado y pagado: facturas emitidas y recibidas, gastos y cobros o pagos manuales."
        >
          <Button onClick={() => setCreating(true)}>
            <Plus strokeWidth={2} aria-hidden="true" />
            Nuevo cobro / pago manual
          </Button>
        </PageHeader>

        <FlowsChart months={months} />

        <dl className="m-0 grid animate-rise-in grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {[
            { label: "Cobrado", value: <AnimatedAmount value={collected} /> },
            { label: "Pagado", value: <AnimatedAmount value={paid} /> },
            { label: "Neto", value: <AnimatedAmount value={cents(collected - paid)} /> },
          ].map((s) => (
            <div key={s.label} className="flex flex-col gap-1 bg-card px-4 py-3">
              <dt className="text-md font-semibold text-foreground lg:text-lg">{s.label}</dt>
              <dd className="m-0 amount text-lg font-semibold lg:text-xl">{s.value}</dd>
            </div>
          ))}
        </dl>

        <section
          aria-label="Listado de cobros y pagos"
          className="flex animate-rise-in flex-col lg:overflow-hidden lg:rounded-xl lg:border lg:border-border"
          style={{ "--i": 1 } as CSSProperties}
        >
          <div className="flex flex-wrap items-center gap-2.5 pb-3 lg:px-4 lg:py-3">
            <div className="flex h-10 min-w-0 flex-[1_1_220px] items-center gap-2 rounded-lg border border-input px-3 text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring lg:max-w-72">
              <Search className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <input
                type="search"
                value={filters.query}
                onChange={(e) => set("query", e.target.value)}
                placeholder="Buscar por documento, contacto o importe"
                aria-label="Buscar"
                className="min-w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <GroupedSelect
              id="pay-source"
              aria-label="Tipo de documento vinculado"
              value={filters.source}
              onChange={(v) => set("source", v)}
              groups={[
                {
                  options: [
                    { value: ALL, label: "Todos los tipos" },
                    ...PAYMENT_SOURCE_ORDER.map((s) => ({ value: s, label: PAYMENT_SOURCES[s].label })),
                  ],
                },
              ]}
              className="w-auto min-w-40 font-medium"
            />
            <GroupedSelect
              id="pay-method"
              aria-label="Método de cobro / pago"
              value={filters.method}
              onChange={(v) => set("method", v)}
              groups={[
                {
                  options: [
                    { value: ALL, label: "Todos los métodos" },
                    ...paymentMethods.map((m) => ({ value: m.id, label: m.name })),
                  ],
                },
              ]}
              className="w-auto min-w-40 font-medium"
            />
            <PeriodSelect value={period} onChange={setPeriod} years={availableYears} today={today} />
            <Button
              variant="secondary"
              size="md"
              className="ml-auto"
              disabled={rows.length === 0}
              onClick={() => exportCsv(rows, `cobros-y-pagos-${periodCode(period)}`.toLowerCase())}
            >
              <Download strokeWidth={1.8} aria-hidden="true" />
              CSV
            </Button>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              message={
                filtered ? "Ningún cobro o pago coincide con los filtros." : "No hay cobros ni pagos en este periodo."
              }
              hint={
                filtered
                  ? "Prueba con otro término o quita algún filtro."
                  : "Aparecen al marcar facturas como cobradas o pagadas. Puedes cambiar el periodo en el selector."
              }
            />
          ) : (
            <>
              <div key={`table-${periodKey(period)}`} className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1000px] border-collapse">
                  <thead>
                    <tr className={table.headRow}>
                      <th scope="col" className={table.th}>
                        Tipo
                      </th>
                      <th scope="col" className={table.th}>
                        Documento vinculado
                      </th>
                      {sortHeader("date", "Fecha")}
                      {sortHeader("amount", "Importe", true)}
                      {sortHeader("method", "Método de cobro / pago")}
                      <th scope="col" className={cn(table.th, "text-center")}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={r.payment.key}
                        className={cn(table.row, "animate-row-in")}
                        style={{ "--i": i } as CSSProperties}
                      >
                        <td className={table.td}>
                          <SourceLabel payment={r.payment} />
                        </td>
                        <td className={table.td}>
                          <div className="flex min-w-0 flex-col">
                            {r.payment.href ? (
                              <Link
                                to={r.payment.href}
                                title={r.payment.reference}
                                className="block max-w-56 truncate font-medium text-foreground no-underline hover:text-primary"
                              >
                                {r.payment.reference}
                              </Link>
                            ) : (
                              <span className="block max-w-56 truncate font-medium" title={r.payment.reference}>
                                {r.payment.reference}
                              </span>
                            )}
                            {r.payment.counterparty && (
                              <span className="max-w-56 truncate text-xs text-muted-foreground">
                                {r.payment.counterparty}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={cn(table.td, "whitespace-nowrap text-muted-foreground")}>
                          {formatDate(r.payment.date)}
                        </td>
                        <td className={cn(table.td, "text-right font-semibold")}>
                          <SignedAmount value={r.payment.amount} />
                        </td>
                        <td className={table.td}>
                          <span className="block max-w-48 truncate">{r.method}</span>
                        </td>
                        <td className={cn(table.td, "px-1.5 first:pl-1.5 last:pr-1.5")}>
                          <QuickActions row={r} onRemove={() => setRemoving(r.payment)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted font-semibold">
                      <td colSpan={3} className={cn(table.td, "text-sm text-muted-foreground")}>
                        {rows.length} {rows.length === 1 ? "cobro o pago" : "cobros y pagos"}
                      </td>
                      <td className={cn(table.td, "text-right amount")}>
                        <AnimatedAmount value={cents(collected - paid)} />
                      </td>
                      <td colSpan={2} className={table.td} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <ul key={`list-${periodKey(period)}`} className="m-0 flex list-none flex-col p-0 lg:hidden">
                {rows.map((r, i) => (
                  <li
                    key={r.payment.key}
                    className="flex animate-row-in items-center gap-2 border-b border-divider py-3"
                    style={{ "--i": i } as CSSProperties}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-medium">{r.payment.reference}</span>
                      <span className="truncate text-sm text-muted-foreground">
                        {[PAYMENT_SOURCES[r.payment.source].label, r.method, formatShortDate(r.payment.date)].join(
                          " · ",
                        )}
                      </span>
                    </div>
                    <SignedAmount value={r.payment.amount} className="text-base" />
                    <RowMenu row={r} onRemove={() => setRemoving(r.payment)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {creating && <ManualPaymentDialog open onOpenChange={setCreating} />}
        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(open) => !open && setRemoving(null)}
          title="Eliminar cobro / pago manual"
          confirmLabel="Eliminar"
          danger
          onConfirm={() => removing && treasuryStore.removeManualPayment(removing.key.slice("manual:".length))}
        >
          <p className="m-0">
            Se eliminará «{removing?.reference}» de {removing && formatEUR(removing.amount)}.
          </p>
        </ConfirmDialog>
      </div>
    </TooltipProvider>
  );
}

function SourceLabel({ payment }: { payment: TreasuryPayment }) {
  const { icon: Icon, label } = PAYMENT_SOURCES[payment.source];
  return (
    <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
      <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
      </span>
      {label}
    </span>
  );
}

function usePaymentActions(row: Row, onRemove: () => void) {
  const navigate = useNavigate();
  const { payment } = row;
  const open: Action = {
    label: payment.href ? "Ir al documento" : "Sin documento vinculado",
    icon: ArrowUpRight,
    run: payment.href ? () => navigate(payment.href!) : undefined,
  };
  const groups: Action[][] = [
    [open],
    [
      {
        label: payment.source === "manual" ? "Eliminar cobro / pago" : "Se elimina desde su documento",
        icon: Trash2,
        danger: true,
        run: payment.source === "manual" ? onRemove : undefined,
      },
    ],
  ];
  return { open, groups };
}

function QuickActions({ row, onRemove }: { row: Row; onRemove: () => void }) {
  const { open, groups } = usePaymentActions(row, onRemove);
  return (
    <div className="flex items-center justify-center gap-0.5">
      <IconAction action={open} />
      <ActionsMenu
        groups={groups}
        trigger={
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="size-8 px-0" aria-label="Más acciones">
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

function RowMenu({ row, onRemove }: { row: Row; onRemove: () => void }) {
  const { groups } = usePaymentActions(row, onRemove);
  return (
    <ActionsMenu
      groups={groups}
      trigger={
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={`Acciones de ${row.payment.reference}`}>
            <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      }
    />
  );
}

function exportCsv(rows: Row[], name: string) {
  downloadCsv(
    ["Fecha", "Tipo", "Documento", "Contacto", "Importe", "Método"],
    rows.map((r) => [
      r.payment.date,
      PAYMENT_SOURCES[r.payment.source].label,
      r.payment.reference,
      r.payment.counterparty,
      r.payment.amount,
      r.method,
    ]),
    name,
  );
}

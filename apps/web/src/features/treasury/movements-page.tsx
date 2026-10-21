import { useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ChevronDown,
  Download,
  FileUp,
  Link2,
  MoreHorizontal,
  PenLine,
  Plus,
  Search,
  Trash2,
  Unlink,
  Upload,
} from "lucide-react";
import { isInPeriod, periodKey, reconciliationStatus, sumBy, type ReconciliationStatus } from "@cuentalibre/core";
import type { BankMovement } from "@cuentalibre/contracts";
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
import { ImportDialog, MovementDialog, PageHeader, ReconciliationBadge, SignedAmount } from "./treasury-parts";
import {
  RECONCILIATION,
  RECONCILIATION_ORDER,
  RECONCILIATION_PATH,
  accountName,
  matchedAmount,
  type TreasuryPayment,
} from "./treasury-model";
import { treasuryStore, usePayments, useTreasury } from "./treasury-store";

const ALL = "all";

interface Row {
  movement: BankMovement;
  /** Position in the statement, which orders movements of the same day so the balance reads right. */
  order: number;
  account: string;
  status: ReconciliationStatus;
  linked: TreasuryPayment[];
}

type SortKey = "date" | "amount";
interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

export function MovementsPage() {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const [params, setParams] = useSearchParams();
  const { accounts } = useSettings();
  const { movements } = useTreasury();
  const payments = usePayments();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(ALL);
  const [sort, setSort] = useState<Sort>({ key: "date", dir: "desc" });
  const [dialog, setDialog] = useState<"import" | "movement" | null>(null);
  const [removing, setRemoving] = useState<BankMovement | null>(null);

  const account = params.get("cuenta") ?? ALL;
  const setAccount = (id: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === ALL) next.delete("cuenta");
        else next.set("cuenta", id);
        return next;
      },
      { replace: true },
    );

  const byKey = useMemo(() => new Map(payments.map((p) => [p.key, p])), [payments]);
  const periodRows = useMemo(
    () =>
      movements
        .map((movement, order) => ({ movement, order }))
        .filter(({ movement }) => isInPeriod(movement.date, period))
        .map(({ movement, order }): Row => {
          const linked = movement.paymentKeys.map((k) => byKey.get(k)).filter((p) => p !== undefined);
          return {
            movement,
            order,
            account: accountName(movement.accountId, accounts),
            status: reconciliationStatus(movement.amount, matchedAmount(movement, byKey)),
            linked,
          };
        }),
    [movements, period, byKey, accounts],
  );

  const q = query.trim().toLowerCase();
  const rows = periodRows
    .filter(
      (r) =>
        (account === ALL || r.movement.accountId === account) &&
        (status === ALL || r.status === status) &&
        (!q ||
          [r.movement.concept, r.movement.reference, ...r.linked.map((p) => p.reference)].some((v) =>
            v.toLowerCase().includes(q),
          )),
    )
    .sort((a, b) => {
      const sign = sort.dir === "asc" ? 1 : -1;
      return sort.key === "date"
        ? sign * (a.movement.date.localeCompare(b.movement.date) || a.order - b.order)
        : sign * (a.movement.amount - b.movement.amount);
    });
  const filtered = q !== "" || status !== ALL || account !== ALL;
  const sum = sumBy(rows, (r) => r.movement.amount);

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8">
        <PageHeader
          title="Movimientos"
          description="Los movimientos de tus cuentas tal como los registra el banco, importados del extracto o añadidos a mano."
        >
          <Button variant="secondary" onClick={() => setDialog("movement")}>
            <Plus strokeWidth={2} aria-hidden="true" />
            Nuevo movimiento manual
          </Button>
          <Button onClick={() => setDialog("import")}>
            <Upload strokeWidth={2} aria-hidden="true" />
            Importar movimientos
          </Button>
        </PageHeader>

        <section
          aria-label="Movimientos de tesorería"
          className="flex animate-rise-in flex-col lg:overflow-hidden lg:rounded-xl lg:border lg:border-border"
        >
          <div className="flex flex-wrap items-center gap-2.5 pb-3 lg:px-4 lg:py-3">
            <div className="flex h-10 min-w-0 flex-[1_1_220px] items-center gap-2 rounded-lg border border-input px-3 text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring lg:max-w-80">
              <Search className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por concepto o referencia"
                aria-label="Buscar"
                className="min-w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <GroupedSelect
              id="filter-account"
              aria-label="Filtrar por cuenta"
              value={account}
              onChange={setAccount}
              groups={[
                {
                  options: [
                    { value: ALL, label: "Todas las cuentas" },
                    ...accounts.map((a) => ({ value: a.id, label: a.name })),
                  ],
                },
              ]}
              className="w-auto min-w-44 font-medium"
            />
            <GroupedSelect
              id="filter-status"
              aria-label="Filtrar por estado de la conciliación"
              value={status}
              onChange={setStatus}
              groups={[
                {
                  options: [
                    { value: ALL, label: "Todos los estados" },
                    ...RECONCILIATION_ORDER.map((s) => ({ value: s, label: RECONCILIATION[s].label })),
                  ],
                },
              ]}
              className="w-auto min-w-44 font-medium"
            />
            <PeriodSelect value={period} onChange={setPeriod} years={availableYears} today={today} />
            <Button
              variant="secondary"
              size="md"
              className="ml-auto"
              disabled={rows.length === 0}
              onClick={() => exportCsv(rows, `movimientos-${periodCode(period)}`.toLowerCase())}
            >
              <Download strokeWidth={1.8} aria-hidden="true" />
              CSV
            </Button>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              message={filtered ? "Ningún movimiento coincide con los filtros." : "No hay movimientos en este periodo."}
              hint={
                filtered
                  ? "Prueba con otro término o quita algún filtro."
                  : "Importa el extracto de tu banco o cambia el periodo en el selector."
              }
              action={
                !filtered && (
                  <Button variant="secondary" className="mt-3" onClick={() => setDialog("import")}>
                    <FileUp strokeWidth={1.8} aria-hidden="true" />
                    Importar movimientos
                  </Button>
                )
              }
            />
          ) : (
            <>
              <div key={`table-${periodKey(period)}`} className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[960px] border-collapse">
                  <thead>
                    <tr className={table.headRow}>
                      <th scope="col" className={cn(table.th, "w-12 text-center")}>
                        Modo
                      </th>
                      <SortHeader
                        label="Fecha"
                        dir={sort.key === "date" ? sort.dir : null}
                        onClick={() => setSort(nextSort(sort, "date"))}
                        className={table.th}
                      />
                      <th scope="col" className={table.th}>
                        Cuenta
                      </th>
                      <th scope="col" className={table.th}>
                        Concepto
                      </th>
                      <SortHeader
                        label="Importe"
                        numeric
                        dir={sort.key === "amount" ? sort.dir : null}
                        onClick={() => setSort(nextSort(sort, "amount"))}
                        className={table.th}
                      />
                      <th scope="col" className={cn(table.th, "text-right")}>
                        Saldo
                      </th>
                      <th scope="col" className={table.th}>
                        Conciliación
                      </th>
                      <th scope="col" className={cn(table.th, "text-center")}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={r.movement.id}
                        className={cn(table.row, "animate-row-in")}
                        style={{ "--i": i } as CSSProperties}
                      >
                        <td className={cn(table.td, "text-center")}>
                          <SourceIcon movement={r.movement} />
                        </td>
                        <td className={cn(table.td, "whitespace-nowrap text-muted-foreground")}>
                          {formatDate(r.movement.date)}
                        </td>
                        <td className={cn(table.td, "max-w-36 truncate text-sm")}>{r.account}</td>
                        <td className={table.td}>
                          <div className="flex min-w-0 flex-col">
                            <span className="max-w-80 truncate font-medium" title={r.movement.concept}>
                              {r.movement.concept}
                            </span>
                            {r.movement.reference && (
                              <span className="font-mono text-xs text-muted-foreground">{r.movement.reference}</span>
                            )}
                          </div>
                        </td>
                        <td className={cn(table.td, "text-right font-semibold")}>
                          <SignedAmount value={r.movement.amount} />
                        </td>
                        <td className={cn(table.td, "text-right amount text-muted-foreground")}>
                          {r.movement.balance === null ? "—" : formatEUR(r.movement.balance)}
                        </td>
                        <td className={table.td}>
                          <StatusCell row={r} />
                        </td>
                        <td className={cn(table.td, "px-1.5 first:pl-1.5 last:pr-1.5")}>
                          <QuickActions row={r} onRemove={() => setRemoving(r.movement)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted font-semibold">
                      <td colSpan={4} className={cn(table.td, "text-sm text-muted-foreground")}>
                        {rows.length} {rows.length === 1 ? "movimiento" : "movimientos"}
                      </td>
                      <td className={cn(table.td, "text-right amount")}>
                        <AnimatedAmount value={sum} />
                      </td>
                      <td colSpan={3} className={table.td} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <ul key={`list-${periodKey(period)}`} className="m-0 flex list-none flex-col p-0 lg:hidden">
                {rows.map((r, i) => (
                  <li
                    key={r.movement.id}
                    className="flex animate-row-in items-center gap-2 border-b border-divider py-3"
                    style={{ "--i": i } as CSSProperties}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-medium">{r.movement.concept}</span>
                      <span className="truncate text-sm text-muted-foreground">
                        {r.account} · {formatShortDate(r.movement.date)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <SignedAmount value={r.movement.amount} className="text-base" />
                      <ReconciliationBadge status={r.status} />
                    </div>
                    <RowMenu row={r} onRemove={() => setRemoving(r.movement)} />
                  </li>
                ))}
                <li className="flex justify-between py-3 text-sm text-muted-foreground">
                  <span>
                    {rows.length} {rows.length === 1 ? "movimiento" : "movimientos"}
                  </span>
                  <span>
                    Total <AnimatedAmount value={sum} className="amount font-semibold text-foreground" />
                  </span>
                </li>
              </ul>
            </>
          )}
        </section>

        {dialog === "import" && (
          <ImportDialog
            open
            onOpenChange={(o) => !o && setDialog(null)}
            accountId={account === ALL ? undefined : account}
          />
        )}
        {dialog === "movement" && (
          <MovementDialog
            open
            onOpenChange={(o) => !o && setDialog(null)}
            accountId={account === ALL ? undefined : account}
          />
        )}
        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(open) => !open && setRemoving(null)}
          title="Eliminar movimiento"
          confirmLabel="Eliminar"
          danger
          onConfirm={() => removing && treasuryStore.removeMovement(removing.id)}
        >
          <p className="m-0">
            Se eliminará «{removing?.concept}» de {removing && formatEUR(removing.amount)}. Los cobros y pagos que
            tuviera conciliados siguen registrados en sus documentos.
          </p>
        </ConfirmDialog>
      </div>
    </TooltipProvider>
  );
}

function nextSort(current: Sort, key: SortKey): Sort {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: "desc" };
}

function SourceIcon({ movement }: { movement: BankMovement }) {
  const Icon = movement.source === "import" ? FileUp : PenLine;
  const label = movement.source === "import" ? "Importado del extracto" : "Movimiento manual";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-label={label} className="inline-flex text-muted-foreground">
          <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function StatusCell({ row }: { row: Row }) {
  if (row.linked.length === 0) return <ReconciliationBadge status={row.status} />;
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <ReconciliationBadge status={row.status} />
      <span className="flex max-w-56 flex-wrap gap-x-2 text-xs">
        {row.linked.map((p) =>
          p.href ? (
            <Link
              key={p.key}
              to={p.href}
              className="truncate text-muted-foreground underline-offset-2 hover:text-primary"
            >
              {p.reference}
            </Link>
          ) : (
            <span key={p.key} className="truncate text-muted-foreground">
              {p.reference}
            </span>
          ),
        )}
      </span>
    </div>
  );
}

function useMovementActions(row: Row, onRemove: () => void) {
  const navigate = useNavigate();
  const { movement, status } = row;
  const reconcile: Action = {
    label: status === "full" ? "Ya está conciliado" : "Conciliar",
    icon: Link2,
    run: status === "full" ? undefined : () => navigate(`${RECONCILIATION_PATH}?movimiento=${movement.id}`),
  };
  const groups: Action[][] = [
    [
      reconcile,
      {
        label: "Deshacer conciliación",
        icon: Unlink,
        run: movement.paymentKeys.length > 0 ? () => treasuryStore.unreconcile(movement.id) : undefined,
      },
    ],
    [{ label: "Eliminar movimiento", icon: Trash2, danger: true, run: onRemove }],
  ];
  return { reconcile, groups };
}

function QuickActions({ row, onRemove }: { row: Row; onRemove: () => void }) {
  const { reconcile, groups } = useMovementActions(row, onRemove);
  return (
    <div className="flex items-center justify-center gap-0.5">
      <IconAction action={reconcile} />
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
  const { groups } = useMovementActions(row, onRemove);
  return (
    <ActionsMenu
      groups={groups}
      trigger={
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={`Acciones de ${row.movement.concept}`}>
            <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      }
    />
  );
}

function exportCsv(rows: Row[], name: string) {
  downloadCsv(
    ["Fecha", "Cuenta", "Concepto", "Referencia", "Importe", "Saldo", "Conciliación", "Documentos"],
    rows.map((r) => [
      r.movement.date,
      r.account,
      r.movement.concept,
      r.movement.reference,
      r.movement.amount,
      r.movement.balance ?? "",
      RECONCILIATION[r.status].label,
      r.linked.map((p) => p.reference).join(", "),
    ]),
    name,
  );
}

import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { ArrowRight, Plus, Settings, Upload } from "lucide-react";
import { cents, monthlyFlows, reconciliationStatus, sumBy } from "@fiscalia/core";
import { Button } from "@fiscalia/ui/components/button";
import { Card, CardTitle } from "@fiscalia/ui/components/card";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { AnimatedAmount } from "@/components/animated-amount";
import { ACCOUNT_ICONS } from "@/features/settings/account-icons";
import { AccountDialog } from "@/features/settings/accounts-page";
import { ACCOUNTS_PATH, ACCOUNT_KINDS } from "@/features/settings/settings-model";
import { useSettings } from "@/features/settings/settings-store";
import { MONTHS, MONTHS_SHORT, formatDate, formatThousands } from "@/lib/format";
import { ImportDialog, MovementDialog, PageHeader, accountNumber } from "./treasury-parts";
import { MOVEMENTS_PATH, RECONCILIATION_PATH, accountBalance, matchedAmount } from "./treasury-model";
import { usePayments, useTreasury } from "./treasury-store";

type Dialog = "import" | "movement" | "account" | null;

export function TreasurySummaryPage() {
  const today = useMemo(() => new Date(), []);
  const { accounts } = useSettings();
  const { movements } = useTreasury();
  const payments = usePayments();
  const [dialog, setDialog] = useState<Dialog>(null);

  const byKey = useMemo(() => new Map(payments.map((p) => [p.key, p])), [payments]);
  const active = accounts.filter((a) => a.active);
  const toReconcile = movements.filter((m) => reconciliationStatus(m.amount, matchedAmount(m, byKey)) !== "full");
  const months = useMemo(() => monthlyFlows(payments, today), [payments, today]);
  const total = sumBy(active, (a) => accountBalance(a.id, movements));
  const collected = sumBy(months, (m) => m.collected);
  const paid = sumBy(months, (m) => m.paid);

  const close = (open: boolean) => !open && setDialog(null);

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8">
      <PageHeader
        title="Bancos y caja"
        description="El saldo de tus cuentas y todo lo que has cobrado y pagado en el último año."
      >
        <Button variant="secondary" onClick={() => setDialog("movement")}>
          <Plus strokeWidth={2} aria-hidden="true" />
          Movimiento manual
        </Button>
        <Button onClick={() => setDialog("import")}>
          <Upload strokeWidth={2} aria-hidden="true" />
          Importar movimientos
        </Button>
      </PageHeader>

      <dl className="m-0 grid animate-rise-in grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
        {[
          { label: "Saldo en cuentas", value: total, detail: `${active.length} cuentas activas` },
          { label: "Cobrado · 12 meses", value: collected, detail: "Facturas cobradas y cobros manuales" },
          { label: "Pagado · 12 meses", value: paid, detail: "Facturas recibidas, gastos y pagos" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1 bg-card px-4 py-3">
            <dt className="text-md font-semibold text-foreground lg:text-lg">{s.label}</dt>
            <dd className="m-0 amount text-xl font-semibold">
              <AnimatedAmount value={s.value} />
            </dd>
            <dd className="m-0 text-sm text-muted-foreground">{s.detail}</dd>
          </div>
        ))}
        <div className="flex flex-col gap-1 bg-card px-4 py-3">
          <dt className="text-sm text-muted-foreground">Por conciliar</dt>
          <dd className="m-0 text-xl font-semibold">
            {toReconcile.length} {toReconcile.length === 1 ? "movimiento" : "movimientos"}
          </dd>
          <dd className="m-0 text-xs">
            {toReconcile.length > 0 ? (
              <Link to={RECONCILIATION_PATH} className="font-medium text-primary no-underline hover:text-primary-hover">
                Revisar y conciliar →
              </Link>
            ) : (
              <span className="text-muted-foreground">Todo cuadra con tus documentos</span>
            )}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="accounts-title" className="flex flex-col gap-3">
        <h2 id="accounts-title" className="m-0 text-md font-semibold">
          Cuentas bancarias y de tesorería
        </h2>
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {active.map((a, i) => {
            const Icon = ACCOUNT_ICONS[a.kind];
            const own = movements.filter((m) => m.accountId === a.id);
            const pending = toReconcile.filter((m) => m.accountId === a.id).length;
            const last = own.at(-1);
            return (
              <li key={a.id} className="animate-rise-in" style={{ "--i": i } as CSSProperties}>
                <Link
                  to={`${MOVEMENTS_PATH}?cuenta=${a.id}`}
                  className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-foreground no-underline transition-[border-color,box-shadow] duration-150 hover:border-muted-strong hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">{a.name}</span>
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {accountNumber(a) ||
                          (a.name === ACCOUNT_KINDS[a.kind].label ? "" : ACCOUNT_KINDS[a.kind].label)}
                      </span>
                    </div>
                    <ArrowRight
                      className="size-4 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="amount text-2xl font-semibold">{formatEUR(accountBalance(a.id, movements))}</span>
                  <span className="mt-auto flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    {last ? `Último movimiento ${formatDate(last.date)}` : "Sin movimientos"}
                    {pending > 0 && <span className="font-medium text-warning">· {pending} por conciliar</span>}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="grid animate-rise-in grid-rows-2 gap-3" style={{ "--i": active.length } as CSSProperties}>
            <button
              type="button"
              onClick={() => setDialog("account")}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-input bg-transparent px-4 text-left font-medium text-foreground transition-colors duration-150 hover:bg-accent"
            >
              <Plus className="size-[18px] text-muted-foreground" strokeWidth={2} aria-hidden="true" />
              Nueva cuenta
            </button>
            <Link
              to={ACCOUNTS_PATH}
              className="flex items-center gap-3 rounded-xl border border-border px-4 font-medium text-foreground no-underline transition-colors duration-150 hover:bg-accent"
            >
              <Settings className="size-[18px] text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
              Configuración de cuentas
            </Link>
          </li>
        </ul>
      </section>

      <FlowsChart months={months} />

      {dialog === "import" && <ImportDialog open onOpenChange={close} />}
      {dialog === "movement" && <MovementDialog open onOpenChange={close} />}
      {dialog === "account" && <AccountDialog open onOpenChange={close} account={null} />}
    </div>
  );
}

const barClass =
  "origin-bottom animate-grow-up rounded-t-xs [animation-delay:calc(var(--i)*30ms)] transition-[height] duration-500 ease-out";

function FlowsChart({ months }: { months: ReturnType<typeof monthlyFlows> }) {
  // Start on the latest month with figures, not on a current month that has barely begun
  const [selected, setSelected] = useState(() => {
    const last = months.findLastIndex((m) => m.collected > 0);
    return last === -1 ? months.length - 1 : last;
  });
  const peak = Math.max(0, ...months.flatMap((m) => [m.collected, m.paid]));
  // Steps of 2.000 €
  const max = cents(Math.max(200_000, Math.ceil(peak / 200_000) * 200_000));
  const current = months[selected]!;
  const height = (v: number) => ({ height: `${(v / max) * 100}%` });

  return (
    <Card aria-labelledby="flows-title" className="gap-4 p-4 lg:p-5">
      <CardTitle id="flows-title" className="text-md lg:text-lg">
        Cobros y pagos de los últimos 12 meses
      </CardTitle>
      <div aria-live="polite" className="flex min-h-[22px] flex-wrap items-baseline gap-x-[18px] gap-y-1.5 text-sm">
        <span className="font-semibold">
          {MONTHS[current.month]} {current.year}
        </span>
        {(
          [
            ["Cobros", current.collected, "bg-chart-income"],
            ["Pagos", current.paid, "bg-chart-expense"],
            ["Neto", cents(current.collected - current.paid), "bg-foreground"],
          ] as const
        ).map(([label, value, dot]) => (
          <span key={label} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("size-2 rounded-xs", dot)} aria-hidden="true" />
            {label} <span className="amount text-foreground">{formatEUR(value)}</span>
          </span>
        ))}
      </div>
      <div className="flex gap-2.5">
        <div
          aria-hidden="true"
          className="-mt-1.5 mb-6 flex h-[200px] min-w-10 flex-col justify-between text-right font-mono text-2xs text-muted-foreground"
        >
          <span>{formatThousands(max)}</span>
          <span>{formatThousands(cents(max / 2))}</span>
          <span>0</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="relative h-[200px]">
            <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
              <div className="border-t border-dashed border-chart-grid" />
              <div className="border-t border-dashed border-chart-grid" />
              <div className="border-t border-chart-axis" />
            </div>
            <div className="absolute inset-0 flex items-end gap-1 sm:gap-1.5">
              {months.map((m, i) => (
                <button
                  key={`${m.year}-${m.month}`}
                  type="button"
                  aria-label={`${MONTHS[m.month]} ${m.year}: cobros ${formatEUR(m.collected)}, pagos ${formatEUR(m.paid)}`}
                  aria-pressed={i === selected}
                  onClick={() => setSelected(i)}
                  onMouseEnter={() => setSelected(i)}
                  onFocus={() => setSelected(i)}
                  className={cn(
                    "flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center gap-[2px] rounded-sm border-0 bg-transparent p-0 transition-colors duration-200 sm:gap-[3px]",
                    i === selected && "bg-chart-highlight",
                  )}
                >
                  <span
                    className={cn(barClass, "w-[38%] max-w-[18px] bg-chart-income")}
                    style={{ ...height(m.collected), "--i": i } as CSSProperties}
                  />
                  <span
                    className={cn(barClass, "w-[38%] max-w-[18px] bg-chart-expense")}
                    style={{ ...height(m.paid), "--i": i } as CSSProperties}
                  />
                </button>
              ))}
            </div>
          </div>
          <div aria-hidden="true" className="flex gap-1 sm:gap-1.5">
            {months.map((m, i) => (
              <span
                key={`${m.year}-${m.month}`}
                className={cn(
                  "min-w-0 flex-1 text-center text-2xs",
                  i === selected ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {MONTHS_SHORT[m.month]}
                {(m.month === 0 || i === 0) && <span className="hidden sm:inline"> {String(m.year).slice(2)}</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-xs bg-chart-income" aria-hidden="true" />
          Cobros
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-xs bg-chart-expense" aria-hidden="true" />
          Pagos
        </span>
      </div>
    </Card>
  );
}

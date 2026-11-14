import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Info,
  Lock,
  LockOpen,
  type LucideIcon,
} from "lucide-react";
import {
  cents,
  filingDeadline,
  filingStatus,
  incomeTaxYear,
  periodKey,
  toIsoDate,
  vatReturns,
  type Period,
  type Quarter,
} from "@cuentalibre/core";
import type { ClosedQuarter } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@cuentalibre/ui/components/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cuentalibre/ui/components/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { Page, PageHeader } from "@/components/page";
import { useFormsInUse } from "@/features/taxes/forms-in-use";
import { TAX_OPTIONS, useTaxBooks } from "@/features/taxes/tax-books";
import { FILING_STATUS, INCOME_TAX_PATH, modelPath, VAT_PATH } from "@/features/taxes/taxes-model";
import { formatDate, periodRange } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { useAvailableYears } from "@/lib/use-available-years";
import { quarterName, quarterToClose, useQuarterChecks, type QuarterCheck } from "./closing-model";
import { closingStore, useClosedQuarters, useFiledReturn, type ReturnToFile } from "./closing-store";

const QUARTERS = [1, 2, 3, 4] as const;

const CHECK_ICON: Record<QuarterCheck["tone"], { icon: LucideIcon; className: string }> = {
  ok: { icon: CircleCheck, className: "text-success" },
  warning: { icon: CircleAlert, className: "text-warning" },
  notice: { icon: Info, className: "text-muted-foreground" },
};

type QuarterState = "closed" | "open" | "inProgress" | "upcoming";

const QUARTER_STATE: Record<QuarterState, { label: string; tone: "neutral" | "primary" | "warning" | "success" }> = {
  closed: { label: "Cerrado", tone: "success" },
  open: { label: "Por cerrar", tone: "warning" },
  inProgress: { label: "En curso", tone: "primary" },
  upcoming: { label: "Sin empezar", tone: "neutral" },
};

function quarterState(period: Period, today: Date, closed: ClosedQuarter[]): QuarterState {
  if (closed.some((c) => c.period === periodKey(period))) return "closed";
  const start = new Date(period.year, (period.quarter! - 1) * 3, 1);
  const end = new Date(period.year, period.quarter! * 3, 1);
  if (today < start) return "upcoming";
  return today < end ? "inProgress" : "open";
}

function Step({
  index,
  title,
  children,
  style,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      aria-labelledby={`step-${index}`}
      className="flex animate-rise-in flex-col gap-3 surface p-4 lg:p-5"
      style={style}
    >
      <h2
        id={`step-${index}`}
        className="m-0 flex items-center gap-2.5 text-lg font-semibold tracking-tight"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {index}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Checks({ checks }: { checks: QuarterCheck[] }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {checks.map((check) => {
        const { icon: Icon, className } = CHECK_ICON[check.tone];
        return (
          <li key={check.id} className="flex items-start gap-3 border-b border-divider py-3 last:border-b-0">
            <Icon className={cn("mt-0.5 size-5 shrink-0", className)} strokeWidth={1.8} aria-hidden="true" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{check.title}</span>
              <span className="text-sm text-muted-foreground">{check.detail}</span>
            </div>
            {check.to && check.tone !== "ok" && (
              <Link to={check.to} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                <span className="sr-only sm:not-sr-only">Revisar</span>
                <ArrowRight aria-hidden="true" />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Forms 303 and 130 of the quarter as the books give them now: what closing it files. */
function useQuarterReturns({ year, quarter }: Period & { quarter: Quarter }): ReturnToFile[] {
  const books = useTaxBooks();
  return useMemo(() => {
    const vat = vatReturns(books, year)[quarter - 1]!;
    const irpf = incomeTaxYear(books, year, TAX_OPTIONS).quarters[quarter - 1]!;
    return [
      { form: "303", boxes: vat.boxes, result: vat.result },
      { form: "130", boxes: irpf.boxes, result: irpf.result },
    ];
  }, [books, year, quarter]);
}

/**
 * Forms 303 and 130 of the quarter, as filed once it is closed, plus reminders of the forms
 * cuentalibre doesn't prepare yet.
 */
function Returns({ period, today }: { period: Period & { quarter: Quarter }; today: Date }) {
  const inUse = useFormsInUse()(period.year);
  const [computedVat, computedIrpf] = useQuarterReturns(period);
  const filedVat = useFiledReturn("303", period);
  const filedIrpf = useFiledReturn("130", period);
  const status = FILING_STATUS[filingStatus(period.year, period.quarter, today)];
  const deadline = formatDate(toIsoDate(filingDeadline(period.year, period.quarter)));
  const others = [
    inUse.withholdings && "111 (retenciones de profesionales)",
    inUse.rentals && "115 (retenciones de alquileres)",
    inUse.intraEu && "349 (operaciones intracomunitarias)",
  ].filter(Boolean);

  const forms = [
    {
      code: "303",
      title: "IVA",
      amount: (filedVat ?? computedVat!).result,
      to: modelPath(VAT_PATH, period),
    },
    {
      code: "130",
      title: "IRPF",
      // A negative 130 is filed with nothing to pay
      amount: cents(Math.max(0, (filedIrpf ?? computedIrpf!).result)),
      to: modelPath(INCOME_TAX_PATH, period),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        Plazo hasta el {deadline}
        <Badge tone={status.tone}>{status.label}</Badge>
      </p>
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        {forms.map((f) => (
          <li key={f.code}>
            <Link
              to={f.to}
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 text-foreground no-underline transition-[background-color,scale] duration-150 hover:bg-muted active:scale-[0.98]"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold">Modelo {f.code}</span>
                <span className="text-sm text-muted-foreground">{f.title}</span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className={cn("amount text-lg font-semibold", f.amount < 0 && "text-success")}>
                  {formatEUR(f.amount)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {f.amount > 0 ? "A ingresar" : f.amount < 0 ? "A compensar" : "Sin cuota"}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      {others.length > 0 && (
        <p className="m-0 text-sm text-muted-foreground">
          Tus documentos también piden el{" "}
          {others.length > 1 ? `${others.slice(0, -1).join(", el ")} y el ${others.at(-1)}` : others[0]}. Por ahora,
          prepára{others.length > 1 ? "los" : "lo"} en la sede de la AEAT.
        </p>
      )}
    </div>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-col gap-2">{children}</div>
        </DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OpenQuarter({
  period,
  state,
  today,
}: {
  period: Period & { quarter: Quarter };
  state: QuarterState;
  today: Date;
}) {
  const checks = useQuarterChecks(period);
  const returns = useQuarterReturns(period);
  const [confirming, setConfirming] = useState(false);
  const warnings = checks.filter((c) => c.tone === "warning").length;
  const name = quarterName(period);

  return (
    <>
      <Step index={1} title="Revisa lo pendiente" style={{ "--i": 2 } as CSSProperties}>
        <Checks checks={checks} />
      </Step>
      <Step index={2} title="Presenta los impuestos" style={{ "--i": 3 } as CSSProperties}>
        <Returns period={period} today={today} />
      </Step>
      <Step index={3} title="Cierra el trimestre" style={{ "--i": 4 } as CSSProperties}>
        <p className="m-0 text-sm text-muted-foreground">
          Al cerrarlo, sus facturas emitidas, facturas recibidas y gastos quedan bloqueados, así las cifras que has
          presentado no cambian por error. Podrás reabrirlo si tienes que corregir algo.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {state === "upcoming" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button disabled>
                    <Lock aria-hidden="true" />
                    Cerrar el {name}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>El trimestre todavía no ha empezado.</TooltipContent>
            </Tooltip>
          ) : (
            <Button onClick={() => setConfirming(true)}>
              <Lock aria-hidden="true" />
              Cerrar el {name}
            </Button>
          )}
          {warnings > 0 && state !== "upcoming" && (
            <span className="text-sm text-warning">
              {warnings === 1 ? "Queda 1 aviso por revisar" : `Quedan ${warnings} avisos por revisar`}
            </span>
          )}
        </div>
      </Step>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`¿Cerrar el ${name}?`}
        confirmLabel="Cerrar trimestre"
        onConfirm={() => closingStore.close(period, today, returns)}
      >
        <p className="m-0">
          No podrás crear, editar ni eliminar facturas emitidas, facturas recibidas ni gastos con fecha del {name} (
          {periodRange(period)}). Podrás seguir marcándolos como cobrados o pagados desde las listas.
        </p>
        <p className="m-0">
          Se guardan los modelos 303 y 130 tal como están ahora, como lo presentado: los trimestres siguientes parten de
          esas cifras.
        </p>
        {state === "inProgress" && (
          <p className="m-0 font-medium text-warning">El trimestre todavía no ha terminado.</p>
        )}
        {warnings > 0 && (
          <p className="m-0 font-medium text-warning">
            {warnings === 1 ? "Hay 1 aviso sin resolver." : `Hay ${warnings} avisos sin resolver.`}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

function ReopenButton({ period, size }: { period: Period; size?: "sm" }) {
  const [confirming, setConfirming] = useState(false);
  const name = quarterName(period);
  return (
    <>
      <Button variant="secondary" size={size} onClick={() => setConfirming(true)}>
        <LockOpen aria-hidden="true" />
        Reabrir
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`¿Reabrir el ${name}?`}
        confirmLabel="Reabrir trimestre"
        onConfirm={() => closingStore.reopen(period)}
      >
        <p className="m-0">
          Sus documentos volverán a poder editarse. Si cambias algo después de presentar los impuestos, tendrás que
          presentar una declaración complementaria o rectificar la autoliquidación.
        </p>
      </ConfirmDialog>
    </>
  );
}

function ClosedQuarterPanel({
  period,
  closedOn,
  today,
}: {
  period: Period & { quarter: Quarter };
  closedOn: string;
  today: Date;
}) {
  return (
    <>
      <section
        aria-label="Trimestre cerrado"
        className="flex animate-rise-in flex-wrap items-center justify-between gap-4 surface p-4 lg:p-5"
        style={{ "--i": 2 } as CSSProperties}
      >
        <div className="flex items-center gap-3.5">
          <span className="flex size-10 items-center justify-center rounded-lg bg-success-soft text-success">
            <Lock className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">
              {quarterName(period)} cerrado el {formatDate(closedOn)}
            </span>
            <span className="text-sm text-muted-foreground">Sus facturas y gastos son de solo lectura.</span>
          </div>
        </div>
        <ReopenButton period={period} />
      </section>
      <Step index={1} title="Impuestos del trimestre" style={{ "--i": 3 } as CSSProperties}>
        <Returns period={period} today={today} />
      </Step>
    </>
  );
}

function QuarterPicker({
  year,
  selected,
  today,
  closed,
  onSelect,
}: {
  year: number;
  selected: Quarter;
  today: Date;
  closed: ClosedQuarter[];
  onSelect: (quarter: Quarter) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Trimestre"
      className="grid animate-rise-in grid-cols-2 gap-2 wide:grid-cols-4"
      style={{ "--i": 1 } as CSSProperties}
    >
      {QUARTERS.map((quarter) => {
        const state = QUARTER_STATE[quarterState({ year, quarter }, today, closed)];
        const active = quarter === selected;
        return (
          <button
            key={quarter}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(quarter)}
            className={cn(
              "flex cursor-pointer flex-col items-start gap-2 surface p-3.5 text-left transition-[border-color,background-color,scale] duration-150 hover:bg-accent active:scale-[0.98]",
              active && "border-primary ring-1 ring-primary",
            )}
          >
            <span className="flex w-full items-baseline justify-between gap-2">
              <span className="font-semibold">T{quarter}</span>
              <span className="text-xs text-muted-foreground">{periodRange({ year, quarter })}</span>
            </span>
            <Badge tone={state.tone}>
              {state.label === "Cerrado" && <Lock className="mr-1 size-3" aria-hidden="true" />}
              {state.label}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

function ClosedList({ closed, onSelect }: { closed: ClosedQuarter[]; onSelect: (period: Period) => void }) {
  const rows = [...closed]
    .sort((a, b) => b.period.localeCompare(a.period))
    .map((c) => {
      const [year, q] = c.period.split("-T").map(Number);
      return { ...c, period: { year: year!, quarter: q as Quarter } };
    });

  return (
    <section
      aria-labelledby="closed-title"
      className="flex animate-rise-in flex-col gap-3"
      style={{ "--i": 5 } as CSSProperties}
    >
      <h2 id="closed-title" className="m-0 text-lg font-semibold tracking-tight">
        Trimestres cerrados
      </h2>
      {rows.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          Aún no has cerrado ningún trimestre.
        </p>
      ) : (
        <div className="overflow-hidden surface">
          <table className="w-full border-collapse">
            <thead>
              <tr className={table.headRow}>
                <th scope="col" className={table.th}>
                  Trimestre
                </th>
                <th scope="col" className={cn(table.th, "hidden sm:table-cell")}>
                  Periodo
                </th>
                <th scope="col" className={table.th}>
                  Cerrado el
                </th>
                <th scope="col" className={cn(table.th, "w-0")}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={periodKey(row.period)} className={table.row}>
                  <td className={table.td}>
                    <button
                      type="button"
                      onClick={() => onSelect(row.period)}
                      className="cursor-pointer border-0 bg-transparent p-0 font-medium text-foreground hover:text-primary"
                    >
                      {quarterName(row.period)}
                    </button>
                  </td>
                  <td className={cn(table.td, "hidden text-muted-foreground sm:table-cell")}>
                    {periodRange(row.period)}
                  </td>
                  <td className={cn(table.td, "whitespace-nowrap text-muted-foreground")}>
                    {formatDate(row.closedOn)}
                  </td>
                  <td className={table.td}>
                    <ReopenButton period={row.period} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function QuarterClosePage() {
  const availableYears = useAvailableYears();
  const today = useMemo(() => new Date(), []);
  const closed = useClosedQuarters();
  const [urlPeriod, setPeriod] = usePeriod(today);
  // A whole-year period from another page opens on the quarter to close
  const period = (
    urlPeriod.quarter === null ? { ...quarterToClose(today, closed), year: urlPeriod.year } : urlPeriod
  ) as Period & {
    quarter: Quarter;
  };
  const state = quarterState(period, today, closed);
  const closedEntry = closed.find((c) => c.period === periodKey(period));
  const years = [...new Set([today.getFullYear(), ...availableYears])].sort((a, b) => b - a);

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <PageHeader
          title="Cierre de trimestres"
          description="Cierra cada trimestre tras presentarlo para bloquear sus documentos."
          actions={
            <Select
              value={String(period.year)}
              onValueChange={(y) => setPeriod({ year: Number(y), quarter: period.quarter })}
            >
              <SelectTrigger aria-label={`Año ${period.year}`} className="min-w-32">
                <Calendar className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
                <span className="flex-1 text-center">
                  <SelectValue />
                </span>
                <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <QuarterPicker
          year={period.year}
          selected={period.quarter}
          today={today}
          closed={closed}
          onSelect={(quarter) => setPeriod({ year: period.year, quarter })}
        />

        <div key={periodKey(period)} className="flex flex-col gap-4">
          {closedEntry ? (
            <ClosedQuarterPanel period={period} closedOn={closedEntry.closedOn} today={today} />
          ) : (
            <OpenQuarter period={period} state={state} today={today} />
          )}
        </div>

        <ClosedList closed={closed} onSelect={setPeriod} />
      </Page>
    </TooltipProvider>
  );
}

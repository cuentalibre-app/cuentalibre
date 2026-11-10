import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { FileBarChart } from "lucide-react";
import {
  cents,
  monthlyResults,
  periodDates,
  periodMonths,
  profitAndLoss,
  relativeChange,
  sumBy,
  type Cents,
  type MonthResult,
  type Period,
} from "@cuentalibre/core";
import { buttonVariants } from "@cuentalibre/ui/components/button";
import { Card, CardTitle } from "@cuentalibre/ui/components/card";
import { Badge } from "@cuentalibre/ui/components/badge";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { Page, PageHeader } from "@/components/page";
import { PeriodSelect } from "@/components/period-select";
import { TopCounterparties } from "@/features/home/top-counterparties";
import { PURCHASES_PATH } from "@/features/purchases/purchases-model";
import { KINDS } from "@/features/sales/sales-model";
import { formatPercent, formatThousands, MONTHS, MONTHS_SHORT, periodLabel } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { availableYears } from "@/mocks/data";
import { PNL_PATH, useReportSources } from "./reports-model";

/** "en 2026" or "en el 3.er trimestre de 2026". */
const periodPhrase = (period: Period) =>
  period.quarter === null ? `en ${period.year}` : `en el ${periodLabel(period).replace(/ (\d{4})$/, " de $1")}`;

/** Months that haven't started yet have nothing to show. */
const isFuture = (year: number, month: number, today: Date) =>
  year * 12 + month > today.getFullYear() * 12 + today.getMonth();

/** The same period a year earlier, which is what a freelancer compares with (seasonality). */
const yearBefore = (period: Period): Period => ({ ...period, year: period.year - 1 });

function Change({ value, inverse, year }: { value: number | null; inverse?: boolean; year: number }) {
  if (value === null) return <span className="text-sm text-muted-foreground">Sin datos de {year - 1}</span>;
  const up = value >= 0;
  const good = inverse ? !up : up;
  return (
    <span className="flex items-center gap-2 text-sm text-muted-foreground">
      <Badge tone={good ? "success" : "danger"} className="h-6 text-xs">
        {up ? "↑" : "↓"} {formatPercent(Math.abs(value) * 100)}
      </Badge>
      {/* Phones: the year itself, so the line fits beside the badge in a half-width card */}
      <span className="lg:hidden">vs. {year - 1}</span>
      <span className="max-lg:hidden">vs. año anterior</span>
    </span>
  );
}

function Kpi({
  label,
  value,
  change,
  inverse,
  year,
  index,
  children,
}: {
  label: string;
  value: string;
  change?: number | null;
  year: number;
  inverse?: boolean;
  index: number;
  children?: ReactNode;
}) {
  return (
    <div className="flex animate-rise-in flex-col gap-2 surface p-4 lg:p-5" style={{ "--i": index } as CSSProperties}>
      <span className="text-sm font-semibold lg:text-lg">{label}</span>
      <span className="amount text-xl font-semibold lg:text-2xl">{value}</span>
      {change !== undefined && <Change value={change} inverse={inverse} year={year} />}
      {children}
    </div>
  );
}

const barClass =
  "origin-bottom animate-grow-up rounded-t-sm [animation-delay:calc(var(--i)*30ms)] transition-[height] duration-500 ease-out";

/** Income and expenses per month of the year, with the selected period highlighted. */
function MonthlyChart({ year, months, inPeriod }: { year: number; months: MonthResult[]; inPeriod: number[] }) {
  // Start on the period's last month with figures, not on an empty future month
  const [selected, setSelected] = useState(
    [...inPeriod].reverse().find((m) => months[m]!.income || months[m]!.expenses) ?? inPeriod[0] ?? 0,
  );
  const peak = Math.max(0, ...months.flatMap((m) => [m.income, m.expenses]));
  // Steps of 2.000 €
  const max = cents(Math.max(200_000, Math.ceil(peak / 200_000) * 200_000));
  const current = months[selected]!;
  const height = (v: number) => ({ height: `${(Math.max(0, v) / max) * 100}%` });

  return (
    <Card aria-labelledby="monthly-title" className="gap-4 p-4 lg:p-5">
      <CardTitle id="monthly-title" className="text-md lg:text-lg">
        Ingresos y gastos por mes · {year}
      </CardTitle>
      <div aria-live="polite" className="flex min-h-[22px] flex-wrap items-baseline gap-x-[18px] gap-y-1.5 text-sm">
        <span className="font-semibold">{MONTHS[selected]}</span>
        {(
          [
            ["Ingresos", current.income, "bg-chart-income"],
            ["Gastos", current.expenses, "bg-chart-expense"],
            ["Resultado", current.profit, "bg-foreground"],
          ] as const
        ).map(([label, value, dot]) => (
          <span key={label} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("size-2 rounded-full", dot)} aria-hidden="true" />
            {label} <span className="amount text-foreground">{formatEUR(value)}</span>
          </span>
        ))}
      </div>
      <div className="flex gap-2.5">
        <div
          aria-hidden="true"
          className="-mt-1.5 mb-6 flex h-[180px] min-w-10 flex-col justify-between text-right text-2xs text-muted-foreground tabular-nums"
        >
          <span>{formatThousands(max)}</span>
          <span>{formatThousands(cents(max / 2))}</span>
          <span>0</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="relative h-[180px]">
            <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
              <div className="border-t border-dashed border-chart-grid" />
              <div className="border-t border-dashed border-chart-grid" />
              <div className="border-t border-chart-axis" />
            </div>
            <div className="absolute inset-0 flex items-end gap-1 sm:gap-1.5">
              {months.map((m, i) => (
                <button
                  key={m.month}
                  type="button"
                  aria-label={`${MONTHS[i]}: ingresos ${formatEUR(m.income)}, gastos ${formatEUR(m.expenses)}`}
                  aria-pressed={i === selected}
                  onClick={() => setSelected(i)}
                  onMouseEnter={() => setSelected(i)}
                  onFocus={() => setSelected(i)}
                  className={cn(
                    "flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center gap-[2px] rounded-sm border-0 bg-transparent p-0 transition-colors duration-200 sm:gap-[3px]",
                    i === selected && "bg-chart-highlight",
                    !inPeriod.includes(i) && "opacity-30",
                  )}
                >
                  <span
                    className={cn(barClass, "w-[38%] max-w-[18px] bg-chart-income")}
                    style={{ ...height(m.income), "--i": i } as CSSProperties}
                  />
                  <span
                    className={cn(barClass, "w-[38%] max-w-[18px] bg-chart-expense")}
                    style={{ ...height(m.expenses), "--i": i } as CSSProperties}
                  />
                </button>
              ))}
            </div>
          </div>
          <div aria-hidden="true" className="flex gap-1 sm:gap-1.5">
            {MONTHS_SHORT.map((label, i) => (
              <span
                key={label}
                className={cn(
                  "min-w-0 flex-1 text-center text-2xs",
                  inPeriod.includes(i) ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {/* Phones: the initial, as twelve short names don't fit side by side */}
                <span className="sm:hidden">{label[0]}</span>
                <span className="max-sm:hidden">{label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-chart-income" aria-hidden="true" />
          Ingresos (base imponible)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-chart-expense" aria-hidden="true" />
          Gastos deducibles
        </span>
      </div>
    </Card>
  );
}

function MonthsTable({ months }: { months: MonthResult[] }) {
  const totals = {
    income: sumBy(months, (m) => m.income),
    expenses: sumBy(months, (m) => m.expenses),
    profit: sumBy(months, (m) => m.profit),
  };
  const margin = (m: { income: Cents; profit: Cents }) => (m.income ? formatPercent((m.profit / m.income) * 100) : "—");
  const th = cn(table.th, "text-right first:text-left");
  const td = cn(table.td, "text-right amount");

  return (
    <section
      aria-labelledby="months-title"
      className="flex animate-rise-in flex-col gap-3"
      style={{ "--i": 5 } as CSSProperties}
    >
      <h2 id="months-title" className="m-0 text-lg font-semibold tracking-tight lg:text-title">
        Detalle por meses
      </h2>
      <div className="overflow-x-auto surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={table.headRow}>
              <th scope="col" className={th}>
                Mes
              </th>
              <th scope="col" className={th}>
                Ingresos
              </th>
              <th scope="col" className={th}>
                Gastos
              </th>
              <th scope="col" className={th}>
                Resultado
              </th>
              <th scope="col" className={cn(th, "hidden sm:table-cell")}>
                Margen
              </th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className={table.row}>
                <th scope="row" className={cn(table.td, "text-left font-medium")}>
                  <span className="sm:hidden">{MONTHS_SHORT[m.month]}</span>
                  <span className="hidden sm:inline">{MONTHS[m.month]}</span>
                </th>
                <td className={td}>{formatEUR(m.income)}</td>
                <td className={td}>{formatEUR(m.expenses)}</td>
                <td className={cn(td, m.profit < 0 && "text-destructive")}>{formatEUR(m.profit)}</td>
                <td className={cn(td, "hidden text-muted-foreground sm:table-cell")}>{margin(m)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/50 font-semibold">
              <th scope="row" className={cn(table.td, "text-left")}>
                Total
              </th>
              <td className={td}>{formatEUR(totals.income)}</td>
              <td className={td}>{formatEUR(totals.expenses)}</td>
              <td className={cn(td, totals.profit < 0 && "text-destructive")}>{formatEUR(totals.profit)}</td>
              <td className={cn(td, "hidden sm:table-cell")}>{margin(totals)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export function ReportsSummaryPage() {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const { books, breakdowns } = useReportSources();

  const data = useMemo(() => {
    const range = periodDates(period);
    const pnl = profitAndLoss(books, range.from, range.to);
    const before = periodDates(yearBefore(period));
    const prev = profitAndLoss(books, before.from, before.to);
    const hasPrevious = prev.income !== 0 || prev.expenses !== 0;
    const compare = (a: number, b: number) => (hasPrevious ? relativeChange(a, b) : null);
    return {
      pnl,
      margin: pnl.income ? pnl.operating / pnl.income : null,
      changes: {
        income: compare(pnl.income, prev.income),
        expenses: compare(pnl.expenses, prev.expenses),
        result: compare(pnl.operating, prev.operating),
      },
      months: monthlyResults(books, period.year),
      breakdowns: breakdowns(range),
    };
  }, [books, breakdowns, period]);

  const inPeriod = periodMonths(period);

  return (
    <Page>
      <PageHeader
        title="Informes"
        description={`Cómo va tu negocio ${periodPhrase(period)}: ingresos sin IVA y gastos deducibles.`}
        descriptionClassName="max-lg:hidden"
        // Phones: the report link and the period share one line under the title
        actionsClassName="max-lg:w-full max-lg:flex-nowrap max-lg:[&>a]:flex-1"
        actions={
          <>
            <Link to={PNL_PATH} className={buttonVariants({ variant: "secondary" })}>
              <FileBarChart strokeWidth={1.8} aria-hidden="true" />
              Pérdidas y ganancias
            </Link>
            <PeriodSelect value={period} onChange={setPeriod} years={availableYears} today={today} compact />
          </>
        }
      />

      <section aria-label="Cifras del periodo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Ingresos"
          value={formatEUR(data.pnl.income)}
          change={data.changes.income}
          year={period.year}
          index={0}
        />
        <Kpi
          label="Gastos"
          value={formatEUR(data.pnl.expenses)}
          change={data.changes.expenses}
          inverse
          year={period.year}
          index={1}
        />
        <Kpi
          label="Resultado"
          value={formatEUR(data.pnl.operating)}
          change={data.changes.result}
          year={period.year}
          index={2}
        />
        <Kpi
          label="Margen"
          value={data.margin === null ? "—" : formatPercent(data.margin * 100)}
          year={period.year}
          index={3}
        >
          <span className="text-sm text-muted-foreground">del resultado sobre los ingresos</span>
        </Kpi>
      </section>

      <div className="animate-rise-in" style={{ "--i": 4 } as CSSProperties}>
        <MonthlyChart
          key={`${period.year}-${period.quarter}`}
          year={period.year}
          months={data.months}
          inPeriod={inPeriod}
        />
      </div>
      <MonthsTable months={inPeriod.filter((m) => !isFuture(period.year, m, today)).map((m) => data.months[m]!)} />

      <section
        aria-label="Desglose"
        className="grid animate-rise-in grid-cols-1 gap-4 lg:grid-cols-3"
        style={{ "--i": 6 } as CSSProperties}
      >
        <TopCounterparties
          id="by-client"
          title="Ingresos por cliente"
          noun="clientes"
          ranking={data.breakdowns.clients}
          barClass="bg-chart-income"
          href={KINDS.invoice.path}
          empty="No hay facturas emitidas en este periodo."
        />
        <TopCounterparties
          id="by-category"
          title="Gastos por categoría"
          noun="categorías"
          ranking={data.breakdowns.categories}
          barClass="bg-chart-expense"
          href={PNL_PATH}
          empty="No hay gastos en este periodo."
        />
        <TopCounterparties
          id="by-supplier"
          title="Gastos por proveedor"
          noun="proveedores"
          ranking={data.breakdowns.suppliers}
          barClass="bg-chart-expense"
          href={PURCHASES_PATH}
          empty="No hay gastos en este periodo."
        />
      </section>
    </Page>
  );
}

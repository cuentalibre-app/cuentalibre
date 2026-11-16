import { useMemo, useState, type CSSProperties } from "react";
import { Download } from "lucide-react";
import {
  PNL_EXPENSE_LINES,
  PNL_INCOME_LINES,
  PNL_LABELS,
  profitAndLoss,
  rankCounterparties,
  relativeChange,
  toIsoDate,
  yearToQuarter,
  type Period,
  type PnlLine,
  type ProfitAndLoss,
} from "@cuentalibre/core";
import { Button } from "@cuentalibre/ui/components/button";
import { SegmentedControl } from "@cuentalibre/ui/components/segmented-control";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { BackLink, HelpTip, Page, PageHeader } from "@/components/page";
import { PeriodSelect } from "@/components/period-select";
import { TopCounterparties } from "@/features/home/top-counterparties";
import { businessName } from "@/features/settings/settings-model";
import { useSettings } from "@/features/settings/settings-store";
import { formatDate, formatPercent, MONTHS } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { useAvailableYears } from "@/lib/use-available-years";
import { pnlRows, type PnlRow } from "./pnl-rows";
import { REPORTS_PATH, useReportSources } from "./reports-model";

type Version = "summary" | "extended";

/** A year counts as the full year; a quarter as from January to its end. */
const lastQuarter = (period: Period) => period.quarter ?? 4;

/** "1 de enero – 30 de septiembre de 2026" */
function rangeLabel(to: string): string {
  const [year, month, day] = to.split("-").map(Number);
  return `1 de enero – ${day} de ${MONTHS[month! - 1]!.toLowerCase()} de ${year}`;
}

function Variation({ current, previous }: { current: number; previous: number }) {
  const change = relativeChange(current, previous);
  if (change === null || (current === 0 && previous === 0)) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-muted-foreground">
      {change > 0 ? "+" : change < 0 ? "−" : ""}
      {formatPercent(Math.abs(change) * 100)}
    </span>
  );
}

function ReportTable({ rows, years }: { rows: PnlRow[]; years: [number, number] }) {
  return (
    <table className="w-full border-collapse text-sm sm:text-base">
      <thead>
        <tr className="bg-foreground text-background">
          <th scope="col" className="border-l border-border px-3 py-2 text-left font-semibold first:border-l-0">
            <span className="sr-only">Concepto</span>
          </th>
          {years.map((y) => (
            <th
              key={y}
              scope="col"
              className="border-l border-border px-3 py-2 text-right amount font-semibold first:border-l-0"
            >
              {y}
            </th>
          ))}
          <th
            scope="col"
            className="hidden w-20 border-l border-border px-3 py-2 text-right text-xs font-medium first:border-l-0 sm:table-cell"
          >
            Var.
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const [current, previous] = row.values;
          const isTotal = row.kind === "section" || row.kind === "result";
          return (
            <tr
              key={`${row.kind}-${row.label}`}
              className={cn(
                "animate-row-in",
                row.kind === "section" && "border-b border-border [&>*]:pt-5",
                row.kind === "result" && "[&>*]:py-3.5",
                row.kind === "result" && row.final && "border-t-2 border-foreground",
              )}
              style={{ "--i": i } as CSSProperties}
            >
              <th
                scope="row"
                className={cn(
                  "border-l border-border px-3 py-1.5 text-left font-normal first:border-l-0",
                  row.kind === "section" && "text-md font-medium",
                  row.kind === "line" && "pl-6",
                  row.kind === "account" && "pl-10 text-sm text-muted-foreground",
                  row.kind === "result" && "font-semibold",
                )}
              >
                {row.label}
              </th>
              {row.values.map((v, j) => (
                <td
                  key={j}
                  className={cn(
                    "border-l border-border px-3 py-1.5 text-right amount whitespace-nowrap first:border-l-0",
                    isTotal ? "font-semibold" : "pr-5",
                    row.kind === "account" && "text-sm text-muted-foreground",
                    v === 0 && row.kind === "line" && "text-muted-foreground",
                    row.kind === "result" && v < 0 && "text-destructive",
                  )}
                >
                  {formatEUR(v)}
                </td>
              ))}
              <td className="hidden border-l border-border px-3 py-1.5 text-right amount text-xs first:border-l-0 sm:table-cell">
                {row.kind !== "account" && <Variation current={current} previous={previous} />}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The report's lines as ranked bars, readable on a phone. */
function Distribution({ pnl, year }: { pnl: ProfitAndLoss; year: number }) {
  const ranking = (keys: readonly PnlLine[]) =>
    rankCounterparties(
      keys.map((k) => ({ name: `${k}. ${PNL_LABELS[k]}`, amount: pnl.lines[k] })),
      6,
    );
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <TopCounterparties
        id="income-distribution"
        title={`Distribución de ingresos ${year}`}
        noun="partidas"
        ranking={ranking([...PNL_INCOME_LINES, "76"])}
        barClass="bg-chart-income"
        empty={`No hay ingresos en ${year}.`}
      />
      <TopCounterparties
        id="expense-distribution"
        title={`Distribución de gastos ${year}`}
        noun="partidas"
        ranking={ranking([...PNL_EXPENSE_LINES, "68", "66"])}
        barClass="bg-chart-expense"
        empty={`No hay gastos en ${year}.`}
      />
    </div>
  );
}

export function ProfitLossPage() {
  const availableYears = useAvailableYears();
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const [version, setVersion] = useState<Version>("summary");
  const { profile } = useSettings();
  const { books } = useReportSources();

  const year = period.year;
  const quarter = lastQuarter(period);
  const years: [number, number] = [year, year - 1];
  const [chartYear, setChartYear] = useState<"current" | "previous">("current");

  const { current, previous, rows } = useMemo(() => {
    const now = yearToQuarter(year, quarter);
    const before = yearToQuarter(year - 1, quarter);
    const current = profitAndLoss(books, now.from, now.to);
    const previous = profitAndLoss(books, before.from, before.to);
    return { current, previous, rows: pnlRows(current, previous, version === "extended") };
  }, [books, year, quarter, version]);

  const range = yearToQuarter(year, quarter);
  const generatedOn = formatDate(toIsoDate(today));
  const empty = [current, previous].every((p) => p.income === 0 && p.expenses === 0 && p.financial === 0);

  const exportPdf = () =>
    void import("./pnl-pdf").then((m) =>
      m.downloadPnlPdf({
        business: businessName(profile),
        taxId: profile.taxId,
        generatedOn,
        periodLabel: rangeLabel(range.to),
        years,
        rows,
        fileName: `perdidas-y-ganancias-${year}-${quarter}T.pdf`,
      }),
    );

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <PageHeader
          back={<BackLink to={REPORTS_PATH} label="Volver a informes" />}
          title="Pérdidas y ganancias"
          inline={
            <HelpTip side="bottom">
              Ingresos menos gastos desde enero hasta el periodo elegido, comparados con el año anterior.
            </HelpTip>
          }
          actions={
            <>
              <SegmentedControl
                label="Versión del informe"
                value={version}
                onChange={setVersion}
                options={[
                  { value: "summary", label: "Resumida" },
                  { value: "extended", label: "Extendida" },
                ]}
              />
              <PeriodSelect value={period} onChange={setPeriod} years={availableYears} today={today} compact />
              {/* An icon on phones, so the version, the period and the export share the row under the title */}
              <Button variant="secondary" onClick={exportPdf} className="max-lg:size-10 max-lg:px-0">
                <Download strokeWidth={1.8} aria-hidden="true" />
                <span className="max-lg:sr-only">Exportar PDF</span>
              </Button>
            </>
          }
        />

        <article aria-labelledby="pnl-title" className="flex animate-rise-in flex-col gap-5 surface p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-2 border-b border-foreground pb-3">
            <h2 id="pnl-title" className="m-0 text-lg font-semibold tracking-tight">
              Informe de pérdidas y ganancias
            </h2>
            <dl className="m-0 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Empresa:</dt>
                <dd className="m-0 font-medium">{businessName(profile)}</dd>
              </div>
              <div className="flex gap-1.5 sm:justify-end">
                <dt className="text-muted-foreground">Generado el</dt>
                <dd className="m-0 font-medium">{generatedOn}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">NIF:</dt>
                <dd className="m-0 font-medium tabular-nums">{profile.taxId}</dd>
              </div>
              <div className="flex gap-1.5 sm:justify-end">
                <dt className="text-muted-foreground">Periodo:</dt>
                <dd className="m-0 font-medium">{rangeLabel(range.to)}</dd>
              </div>
            </dl>
          </div>

          {empty ? (
            <p className="m-0 py-10 text-center text-muted-foreground">
              No hay facturas ni gastos entre el 1 de enero y el final del periodo, ni en {year} ni en {year - 1}.
            </p>
          ) : (
            <div className="-mx-3 overflow-x-auto sm:mx-0">
              <ReportTable rows={rows} years={years} />
            </div>
          )}
          <p className="m-0 text-xs text-muted-foreground">
            Ingresos por su base imponible y gastos por su parte deducible, como en los modelos 130 y 100. No incluye
            los gastos de difícil justificación de la estimación directa simplificada.
          </p>
        </article>

        {!empty && (
          <section
            aria-label="Distribución"
            className="flex animate-rise-in flex-col gap-3"
            style={{ "--i": 2 } as CSSProperties}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-lg font-semibold tracking-tight">Distribución en el ejercicio</h2>
              <SegmentedControl
                label="Ejercicio"
                value={chartYear}
                onChange={setChartYear}
                options={[
                  { value: "current", label: String(year) },
                  { value: "previous", label: String(year - 1) },
                ]}
              />
            </div>
            <Distribution
              pnl={chartYear === "current" ? current : previous}
              year={chartYear === "current" ? year : year - 1}
            />
          </section>
        )}
      </Page>
    </TooltipProvider>
  );
}

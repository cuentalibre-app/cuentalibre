import { useState } from "react";
import { Card, CardTitle } from "@fiscalia/ui/components/card";
import { SegmentedControl } from "@fiscalia/ui/components/segmented-control";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { formatThousands, MONTHS, MONTHS_INITIAL, MONTHS_SHORT } from "@/lib/format";
import type { HomeData } from "./home-data";

/** Rounds `value` up to a multiple of `step`, never below `step`. */
function niceMax(value: number, step: number) {
  return Math.max(step, Math.ceil(value / step) * step);
}

function pct(value: number, max: number) {
  return `${(Math.max(0, value) / max) * 100}%`;
}

function Gridlines() {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
      <div className="border-t border-dashed border-chart-grid" />
      <div className="border-t border-dashed border-chart-grid" />
      <div className="border-t border-chart-axis" />
    </div>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={cn("size-2 shrink-0 rounded-full", className)} aria-hidden="true" />;
}

type View = "monthly" | "cumulative";

/** Desktop chart: income vs. expenses per month, or cumulative profit for the year. */
export function CashFlowChart({ data, className }: { data: HomeData; className?: string }) {
  const [view, setView] = useState<View>("monthly");
  const [selected, setSelected] = useState(data.lastMonthWithData);
  const { monthly, months, period } = data;
  const points = monthly.filter((m) => m !== null);

  const monthlyMax = niceMax(Math.max(0, ...points.flatMap((m) => [m.income, m.expenses])), 2000);
  const cumulativeMax = niceMax(Math.max(0, ...points.map((m) => m.cumulativeProfit)), 5000);
  const max = view === "monthly" ? monthlyMax : cumulativeMax;

  const current = monthly[selected];
  const linePoints = points
    .map((m) => `${(m.month + 0.5) * 100},${(200 - (Math.max(0, m.cumulativeProfit) / cumulativeMax) * 196).toFixed(1)}`)
    .join(" ");
  const first = points[0];
  const last = points.at(-1);
  const areaPoints = first && last ? `${(first.month + 0.5) * 100},200 ${linePoints} ${(last.month + 0.5) * 100},200` : "";

  return (
    <Card aria-labelledby="cash-flow-title" className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle id="cash-flow-title">Ingresos y gastos {period.year}</CardTitle>
        <SegmentedControl
          label="Vista"
          value={view}
          onChange={setView}
          options={[
            { value: "monthly", label: "Mensual" },
            { value: "cumulative", label: "Beneficio acumulado" },
          ]}
        />
      </div>

      <div aria-live="polite" className="flex min-h-[22px] flex-wrap items-baseline gap-x-[18px] gap-y-1.5">
        {!current ? (
          <>
            <span className="font-semibold">
              {MONTHS[selected]} {period.year}
            </span>
            <span className="text-muted-foreground">Sin datos todavía</span>
          </>
        ) : view === "monthly" ? (
          <>
            <span className="font-semibold">
              {MONTHS[selected]} {period.year}
            </span>
            {(
              [
                ["Ingresos", current.income, "bg-chart-income"],
                ["Gastos", current.expenses, "bg-chart-expense"],
                ["Beneficio", current.profit, "bg-foreground"],
              ] as const
            ).map(([label, value, dot]) => (
              <span key={label} className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Dot className={dot} />
                {label} <span className="amount text-foreground">{formatEUR(value)}</span>
              </span>
            ))}
          </>
        ) : (
          <>
            <span className="font-semibold">
              Hasta {MONTHS[selected]!.toLowerCase()} {period.year}
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Dot className="bg-chart-income" />
              Beneficio acumulado <span className="amount text-foreground">{formatEUR(current.cumulativeProfit)}</span>
            </span>
          </>
        )}
      </div>

      <div className="flex gap-2.5">
        <div
          aria-hidden="true"
          className="-mt-1.5 mb-1.5 flex h-[200px] min-w-10 flex-col justify-between text-right font-mono text-2xs text-muted-foreground"
        >
          <span>{formatThousands(max)}</span>
          <span>{formatThousands(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="relative h-[200px]">
            <Gridlines />
            {view === "monthly" ? (
              <div className="absolute inset-0 flex items-end gap-1.5">
                {monthly.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={
                      m
                        ? `${MONTHS[i]}: ingresos ${formatEUR(m.income)}, gastos ${formatEUR(m.expenses)}`
                        : `${MONTHS[i]}: sin datos`
                    }
                    aria-pressed={i === selected}
                    onClick={() => setSelected(i)}
                    onMouseEnter={() => setSelected(i)}
                    onFocus={() => setSelected(i)}
                    className={cn(
                      "flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center gap-[3px] rounded-sm",
                      i === selected && "bg-chart-highlight",
                      !months.includes(i) && "opacity-30",
                    )}
                  >
                    <span
                      className="w-[36%] max-w-[18px] rounded-t-xs bg-chart-income"
                      style={{ height: pct(m?.income ?? 0, max) }}
                    />
                    <span
                      className="w-[36%] max-w-[18px] rounded-t-xs bg-chart-expense"
                      style={{ height: pct(m?.expenses ?? 0, max) }}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <>
                <svg
                  viewBox="0 0 1200 200"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute inset-0 block h-[200px] w-full"
                >
                  <rect
                    x={months[0]! * 100}
                    y="0"
                    width={months.length * 100}
                    height="200"
                    className="fill-chart-highlight"
                  />
                  <polygon points={areaPoints} className="fill-chart-income" fillOpacity="0.1" />
                  <polyline
                    points={linePoints}
                    fill="none"
                    className="stroke-chart-income"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="absolute inset-0 flex">
                  {monthly.map((m, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={
                        m ? `${MONTHS[i]}: beneficio acumulado ${formatEUR(m.cumulativeProfit)}` : `${MONTHS[i]}: sin datos`
                      }
                      aria-pressed={i === selected}
                      onClick={() => setSelected(i)}
                      onMouseEnter={() => setSelected(i)}
                      onFocus={() => setSelected(i)}
                      className="flex-1 cursor-pointer"
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          <div aria-hidden="true" className="flex gap-1.5">
            {MONTHS_SHORT.map((label, i) => (
              <span
                key={i}
                className={cn(
                  "min-w-0 flex-1 text-center text-2xs",
                  months.includes(i) ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-xs bg-chart-income" aria-hidden="true" />
          Ingresos (base)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-xs bg-chart-expense" aria-hidden="true" />
          Gastos
        </span>
        <span>Resaltado: periodo seleccionado</span>
      </div>
    </Card>
  );
}

/** Mobile chart: profit per month. */
export function ProfitChart({ data, className }: { data: HomeData; className?: string }) {
  const [selected, setSelected] = useState(data.lastMonthWithData);
  const { monthly, months, period } = data;
  const max = niceMax(Math.max(0, ...monthly.map((m) => m?.profit ?? 0)), 2000);
  const current = monthly[selected];

  return (
    <Card aria-labelledby="profit-title" className={cn("gap-3 p-4", className)}>
      <h2 id="profit-title" className="m-0 text-md font-semibold">
        Beneficio por mes · {period.year}
      </h2>
      <div aria-live="polite" className="flex justify-between text-sm text-muted-foreground">
        <span>
          {MONTHS[selected]}
          {current && ` ${period.year}`}
        </span>
        <span className="amount text-foreground">{current ? formatEUR(current.profit) : "Sin datos"}</span>
      </div>
      <div className="relative h-[120px]">
        <Gridlines />
        <div className="absolute inset-0 flex items-end gap-1">
          {monthly.map((m, i) => (
            <button
              key={i}
              type="button"
              aria-label={m ? `${MONTHS[i]}: beneficio ${formatEUR(m.profit)}` : `${MONTHS[i]}: sin datos`}
              aria-pressed={i === selected}
              onClick={() => setSelected(i)}
              className={cn(
                "flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center rounded-[5px]",
                i === selected && "bg-chart-highlight",
                !months.includes(i) && "opacity-30",
              )}
            >
              <span className="w-[70%] rounded-t-xs bg-chart-income" style={{ height: pct(m?.profit ?? 0, max) }} />
            </button>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="flex gap-1">
        {MONTHS_INITIAL.map((label, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 text-center text-2xs",
              months.includes(i) ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </Card>
  );
}

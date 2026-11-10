import { useRef, useState, type CSSProperties } from "react";
import { cents, eurosToCents, type Cents } from "@cuentalibre/core";
import { Card, CardTitle } from "@cuentalibre/ui/components/card";
import { SegmentedControl } from "@cuentalibre/ui/components/segmented-control";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { formatThousands, MONTHS, MONTHS_SHORT, periodLabel } from "@/lib/format";
import { useDismiss } from "@/lib/use-dismiss";
import type { HomeData } from "./home-data";

/** Rounds `value` up to a multiple of `step`, never below `step`. */
function niceMax(value: number, step: Cents): Cents {
  return cents(Math.max(step, Math.ceil(value / step) * step));
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

/** Bars grow from the baseline on mount, left to right; later changes in height ease. */
const barClass =
  "origin-bottom animate-grow-up rounded-t-sm [animation-delay:calc(var(--i)*30ms)] transition-[height] duration-500 ease-out";

function barStyle(value: number, max: number, index: number) {
  return { height: pct(value, max), "--i": index } as CSSProperties;
}

function Dot({ className }: { className: string }) {
  return <span className={cn("size-2 shrink-0 rounded-full", className)} aria-hidden="true" />;
}

type View = "monthly" | "cumulative";

/**
 * Desktop chart: income vs. expenses per month, or cumulative profit for the year. Hovering a month shows its
 * figures; clicking pins it until it's clicked again, or the click lands anywhere else. With nothing selected
 * the header shows the period's totals.
 */
export function CashFlowChart({ data, className }: { data: HomeData; className?: string }) {
  const [view, setView] = useState<View>("monthly");
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const selected = hovered ?? pinned;
  const plot = useRef<HTMLDivElement>(null);
  useDismiss(plot, pinned !== null, () => setPinned(null));

  /** What every month's button does: hover and focus preview it, a click pins or unpins it. */
  const monthHandlers = (i: number) => ({
    "aria-pressed": i === pinned,
    onClick: () => setPinned((p) => (p === i ? null : i)),
    onMouseEnter: () => setHovered(i),
    onFocus: () => setHovered(i),
    onBlur: () => setHovered(null),
  });
  const { monthly, months, period } = data;
  const points = monthly.filter((m) => m !== null);

  const monthlyMax = niceMax(Math.max(0, ...points.flatMap((m) => [m.income, m.expenses])), eurosToCents(2_000));
  const cumulativeMax = niceMax(Math.max(0, ...points.map((m) => m.cumulativeProfit)), eurosToCents(5_000));
  const max = view === "monthly" ? monthlyMax : cumulativeMax;

  const current = selected === null ? null : monthly[selected];
  const lastPoint = monthly[data.lastMonthWithData];
  const lineY = (v: number) => 200 - (Math.max(0, v) / cumulativeMax) * 196;
  const linePoints = points
    .map(
      (m) => `${(m.month + 0.5) * 100},${lineY(m.cumulativeProfit).toFixed(1)}`,
    )
    .join(" ");
  const first = points[0];
  const last = points.at(-1);
  const areaPoints =
    first && last ? `${(first.month + 0.5) * 100},200 ${linePoints} ${(last.month + 0.5) * 100},200` : "";

  return (
    <Card aria-labelledby="cash-flow-title" className={cn("gap-4", className)}>
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
        {selected === null ? (
          view === "monthly" ? (
            <>
              <span className="font-semibold">{periodLabel(period)}</span>
              {(
                [
                  ["Ingresos", data.totals.income, "bg-chart-income"],
                  ["Gastos", data.totals.expenses, "bg-chart-expense"],
                  ["Beneficio", data.profit, "bg-foreground"],
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
              <span className="font-semibold">Hasta {MONTHS[data.lastMonthWithData]!.toLowerCase()} {period.year}</span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Dot className="bg-chart-income" />
                Beneficio acumulado{" "}
                <span className="amount text-foreground">{formatEUR(lastPoint?.cumulativeProfit ?? cents(0))}</span>
              </span>
            </>
          )
        ) : !current ? (
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
          className="-mt-1.5 mb-1.5 flex h-[200px] min-w-10 flex-col justify-between text-right text-2xs text-muted-foreground tabular-nums"
        >
          <span>{formatThousands(max)}</span>
          <span>{formatThousands(cents(max / 2))}</span>
          <span>0</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div ref={plot} onMouseLeave={() => setHovered(null)} className="relative h-[200px]">
            <Gridlines />
            {view === "monthly" ? (
              <div className="absolute inset-0 flex animate-fade-in items-end gap-1.5">
                {monthly.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={
                      m
                        ? `${MONTHS[i]}: ingresos ${formatEUR(m.income)}, gastos ${formatEUR(m.expenses)}`
                        : `${MONTHS[i]}: sin datos`
                    }
                    {...monthHandlers(i)}
                    className={cn(
                      "flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center gap-[3px] rounded-sm transition-colors duration-200",
                      i === selected && "bg-chart-highlight",
                      !months.includes(i) && "opacity-30",
                    )}
                  >
                    <span
                      className={cn(barClass, "w-[36%] max-w-[18px] bg-chart-income")}
                      style={barStyle(m?.income ?? 0, max, i)}
                    />
                    <span
                      className={cn(barClass, "w-[36%] max-w-[18px] bg-chart-expense")}
                      style={barStyle(m?.expenses ?? 0, max, i)}
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
                  className="absolute inset-0 block h-[200px] w-full animate-fade-in"
                >
                  <rect
                    x={months[0]! * 100}
                    y="0"
                    width={months.length * 100}
                    height="200"
                    className="fill-chart-highlight"
                  />
                </svg>
                {/* The line draws itself from left to right */}
                <svg
                  viewBox="0 0 1200 200"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute inset-0 block h-[200px] w-full"
                >
                  {/* Clipped on a group: Chrome can leave a clip-path animated on the <svg> itself unpainted */}
                  <g className="animate-reveal-x">
                    <polygon points={areaPoints} className="fill-chart-income" fillOpacity="0.1" />
                    <polyline
                      points={linePoints}
                      fill="none"
                      className="stroke-chart-income"
                      strokeWidth="2.5"
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                    />
                  </g>
                </svg>
                {/* The selected month: a guide down to the axis and a dot on the line */}
                {current && (
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                    <div
                      className="absolute inset-y-0 w-px -translate-x-1/2 bg-chart-axis"
                      style={{ left: `${((selected! + 0.5) / 12) * 100}%` }}
                    />
                    <div
                      className="absolute size-3 -translate-1/2 rounded-full bg-chart-income ring-4 ring-card"
                      style={{
                        left: `${((selected! + 0.5) / 12) * 100}%`,
                        top: `${(lineY(current.cumulativeProfit) / 200) * 100}%`,
                      }}
                    />
                  </div>
                )}
                <div className="absolute inset-0 flex">
                  {monthly.map((m, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={
                        m
                          ? `${MONTHS[i]}: beneficio acumulado ${formatEUR(m.cumulativeProfit)}`
                          : `${MONTHS[i]}: sin datos`
                      }
                      {...monthHandlers(i)}
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
    </Card>
  );
}

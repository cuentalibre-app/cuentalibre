import { useTranslation } from "react-i18next";
import { useRef, useState, type CSSProperties } from "react";
import { ChartColumn } from "lucide-react";
import { cents, eurosToCents, type Cents } from "@cuentalibre/core";
import { Card } from "@cuentalibre/ui/components/card";
import { cardHeaderClass, cardIconClass, cardTitleClass } from "@/components/page";
import { SegmentedControl } from "@cuentalibre/ui/components/segmented-control";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { formatThousands } from "@/lib/format";
import { MONTH_KEYS, useDateLabels } from "@/i18n/dates";
import { useDismiss } from "@/lib/use-dismiss";
import type { HomeData } from "./home-data";

/** Rounds `value` up to a multiple of `step`, never below `step`. */
function niceMax(value: number, step: Cents): Cents {
  return cents(Math.max(step, Math.ceil(value / step) * step));
}

function pct(value: number, max: number) {
  return `${(Math.max(0, value) / max) * 100}%`;
}

/** Dashed rows at each axis tick; with `columns`, also a dashed line down every month. */
function Gridlines({ columns = false }: { columns?: boolean }) {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div className="absolute inset-0 flex flex-col justify-between">
        <div className="border-t border-dashed border-chart-grid" />
        <div className="border-t border-dashed border-chart-grid" />
        <div className="border-t border-chart-axis" />
      </div>
      {columns &&
        MONTH_KEYS.map((_, i) => (
          <div
            key={i}
            className="absolute inset-y-0 border-l border-dashed border-chart-grid"
            style={{ left: `${((i + 0.5) / 12) * 100}%` }}
          />
        ))}
    </div>
  );
}

/** Bars grow from the baseline on mount, left to right; later changes in height ease. */
const barClass =
  "origin-bottom animate-grow-up rounded-t-[3px] [animation-delay:calc(var(--i)*30ms)] transition-[height] duration-500 ease-out";

function barStyle(value: number, max: number, index: number) {
  return { height: pct(value, max), "--i": index } as CSSProperties;
}

function Dot({ className }: { className: string }) {
  return <span className={cn("size-2.5 shrink-0 rounded-[2px]", className)} aria-hidden="true" />;
}

type View = "monthly" | "cumulative";

/**
 * Desktop chart: income vs. expenses per month, or cumulative profit for the year. Hovering a month shows its
 * figures; clicking pins it until it's clicked again, or the click lands anywhere else. With nothing selected
 * the header shows the period's totals.
 */
export function CashFlowChart({ data, className }: { data: HomeData; className?: string }) {
  const { t } = useTranslation();
  const { month: monthName, monthShort, monthInSentence, periodLabel } = useDateLabels();
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
  const linePoints = points.map((m) => `${(m.month + 0.5) * 100},${lineY(m.cumulativeProfit).toFixed(1)}`).join(" ");
  const first = points[0];
  const last = points.at(-1);
  const areaPoints =
    first && last ? `${(first.month + 0.5) * 100},200 ${linePoints} ${(last.month + 0.5) * 100},200` : "";

  return (
    <Card aria-labelledby="cash-flow-title" className={cn("gap-4 p-0", className)}>
      <div className={cn("flex flex-wrap items-center justify-between gap-3 lg:py-2", cardHeaderClass)}>
        <h2 id="cash-flow-title" className={cardTitleClass}>
          <ChartColumn className={cardIconClass} strokeWidth={1.8} aria-hidden="true" />
          {t("home.chart.title", { year: period.year })}
        </h2>
        <SegmentedControl
          label={t("home.chart.view")}
          value={view}
          onChange={setView}
          options={[
            { value: "monthly", label: t("home.chart.monthly") },
            { value: "cumulative", label: t("home.chart.cumulative") },
          ]}
        />
      </div>

      <div aria-live="polite" className="flex min-h-[22px] flex-wrap items-baseline gap-x-[18px] gap-y-1.5 px-4">
        {selected === null ? (
          view === "monthly" ? (
            <>
              <span className="font-semibold">{periodLabel(period)}</span>
              {(
                [
                  [t("home.metrics.income"), data.totals.income, "bg-chart-income"],
                  [t("home.metrics.expenses"), data.totals.expenses, "bg-chart-expense"],
                  [t("home.metrics.profit"), data.profit, "bg-success"],
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
                {t("home.chart.throughMonth", {
                  month: monthInSentence(data.lastMonthWithData),
                  year: period.year,
                })}
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Dot className="bg-chart-income" />
                {t("home.chart.cumulative")}{" "}
                <span className="amount text-foreground">{formatEUR(lastPoint?.cumulativeProfit ?? cents(0))}</span>
              </span>
            </>
          )
        ) : !current ? (
          <>
            <span className="font-semibold">
              {monthName(selected)} {period.year}
            </span>
            <span className="text-muted-foreground">{t("home.chart.empty")}</span>
          </>
        ) : view === "monthly" ? (
          <>
            <span className="font-semibold">
              {monthName(selected)} {period.year}
            </span>
            {(
              [
                [t("home.metrics.income"), current.income, "bg-chart-income"],
                [t("home.metrics.expenses"), current.expenses, "bg-chart-expense"],
                [t("home.metrics.profit"), current.profit, "bg-success"],
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
              {t("home.chart.throughMonth", { month: monthInSentence(selected), year: period.year })}
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Dot className="bg-chart-income" />
              {t("home.chart.cumulative")}{" "}
              <span className="amount text-foreground">{formatEUR(current.cumulativeProfit)}</span>
            </span>
          </>
        )}
      </div>

      <div className="flex gap-2.5 px-4 pb-4">
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
            <Gridlines columns={view === "cumulative"} />
            {view === "monthly" ? (
              <div className="absolute inset-0 flex animate-fade-in items-end gap-1.5">
                {monthly.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={
                      m
                        ? t("home.chart.monthActivity", {
                            month: monthName(i),
                            income: formatEUR(m.income),
                            expenses: formatEUR(m.expenses),
                          })
                        : t("home.chart.monthEmpty", { month: monthName(i) })
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
                          ? t("home.chart.monthCumulative", { month: monthName(i), profit: formatEUR(m.cumulativeProfit) })
                          : t("home.chart.monthEmpty", { month: monthName(i) })
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
            {MONTH_KEYS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "min-w-0 flex-1 text-center text-2xs",
                  months.includes(i) ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {monthShort(i)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

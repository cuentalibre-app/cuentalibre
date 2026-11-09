import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { CalendarDays, ChartColumn, ChevronRight, TrendingUp } from "lucide-react";
import { cents, periodKey, quarterOfMonth, type Cents, type Period } from "@cuentalibre/core";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@cuentalibre/ui/components/select";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { AnimatedAmount } from "@/components/animated-amount";
import { ListGroup, listRowClass } from "@/components/page";
import { MONTHS, MONTHS_SHORT, formatPercent, periodLabel, periodShortLabel } from "@/lib/format";
import type { HomeData } from "./home-data";
import type { TaxReserve } from "./kpi-grid";

const W = 1200;
const H = 200;
/** Room above and below the line so its peaks and the selection dot aren't clipped. */
const PAD = 16;

/** Monotone cubic path (Fritsch–Carlson): smooth, without overshooting between months. */
function smoothPath(points: [number, number][]) {
  if (points.length < 2) return "";
  const n = points.length;
  const d = points.slice(1).map(([x, y], i) => (y - points[i]![1]) / (x - points[i]![0]));
  const m = points.map((_, i) => {
    if (i === 0) return d[0]!;
    if (i === n - 1) return d[n - 2]!;
    const [a, b] = [d[i - 1]!, d[i]!];
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  let path = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const h = (x1 - x0) / 3;
    path += ` C${x0 + h},${y0 + m[i]! * h} ${x1 - h},${y1 - m[i + 1]! * h} ${x1},${y1}`;
  }
  return path;
}

const signed = (change: number) => `${change >= 0 ? "+" : "−"}${formatPercent(Math.abs(change))}`;

export type ChartView = "line" | "bars";

const VIEW_KEY = "cuentalibre:home-chart";

function readView(): ChartView {
  try {
    return localStorage.getItem(VIEW_KEY) === "bars" ? "bars" : "line";
  } catch {
    return "line";
  }
}

function storeView(view: ChartView) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Storage unavailable: the choice lasts until reload
  }
}

/** Line or bars, as a pill of two icons. */
function ViewToggle({ view, onChange }: { view: ChartView; onChange: (v: ChartView) => void }) {
  const options = [
    { value: "line", label: "Beneficio acumulado", icon: TrendingUp },
    { value: "bars", label: "Ingresos y gastos por mes", icon: ChartColumn },
  ] as const;
  return (
    <div role="radiogroup" aria-label="Gráfica" className="flex items-center gap-0.5 rounded-full border border-glass-edge bg-glass p-1 backdrop-blur-xl">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={view === value}
          aria-label={label}
          onClick={() => onChange(value)}
          className={cn(
            "grid h-9 w-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-muted-foreground transition-[background-color,color,scale] duration-150 active:scale-90",
            view === value && "bg-card text-foreground shadow-card",
          )}
        >
          <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/** Bars grow from the baseline on mount, left to right; later changes in height ease. */
const barClass =
  "w-[30%] max-w-6 origin-bottom animate-grow-up rounded-t-[3px] [animation-delay:calc(var(--i)*40ms)] transition-[height] duration-500 ease-out";

interface ChartProps {
  data: HomeData;
  view: ChartView;
  /** Index of the selected month among the period's months, or null. */
  selected: number | null;
  onSelect: (slot: number | null) => void;
}

/**
 * The period's months side by side: income and expenses as bars, or the profit adding up month by month
 * as a line that ends on the period's figure. Touching a month selects it; touching it again clears it.
 */
function PeriodChart({ data, view, selected, onSelect }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const toggling = useRef(false);
  const { monthly, months } = data;
  const n = months.length;
  const slots = months.map((m) => monthly[m] ?? null);
  const filled = slots.flatMap((s, i) => (s ? [i] : []));
  const lastFilled = filled.at(-1) ?? -1;
  const center = (i: number) => (i + 0.5) / n;

  // Profit adding up from the start of the period
  let running = 0;
  const totals = slots.map((s) => (s ? (running += s.profit) : null));

  const slotAt = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return null;
    const i = Math.floor(((clientX - box.left) / box.width) * n);
    return Math.min(lastFilled, Math.max(0, i));
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const i = slotAt(e.clientX);
    if (i === null || i < 0) return;
    toggling.current = i === selected;
    onSelect(toggling.current ? null : i);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    // Dragging with a finger or a pressed button moves the selection; hovering doesn't
    if (toggling.current || !e.buttons) return;
    const i = slotAt(e.clientX);
    if (i !== null && i >= 0) onSelect(i);
  };

  const summary =
    view === "line"
      ? `Beneficio acumulado en ${periodLabel(data.period).toLowerCase()}: ${formatEUR(cents(running))}`
      : slots
          .map((s, i) =>
            s ? `${MONTHS[months[i]!]}: ingresos ${formatEUR(s.income)}, gastos ${formatEUR(s.expenses)}` : null,
          )
          .filter(Boolean)
          .join("; ");

  // The line runs edge to edge; bars keep the page margins
  return (
    <div className={cn("-mx-5 flex flex-col gap-2", view === "bars" && "px-4")}>
      <div
        ref={ref}
        role="img"
        aria-label={summary || "Sin datos todavía"}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => (toggling.current = false)}
        className="relative h-[180px] touch-pan-y select-none"
      >
        {/* Selected month */}
        {selected !== null && (
          <div
            aria-hidden="true"
            className={cn(
              "absolute inset-y-0 transition-[left] duration-150 ease-out",
              view === "bars" ? "rounded-lg bg-chart-highlight" : "w-px -translate-x-1/2 bg-chart-axis",
            )}
            style={
              view === "bars"
                ? { left: `calc(${(selected / n) * 100}% + 4px)`, width: `calc(${100 / n}% - 8px)` }
                : { left: `${center(selected) * 100}%` }
            }
          />
        )}
        {view === "bars" ? (
          <BarsView slots={slots} selected={selected} />
        ) : (
          <LineView totals={totals} n={n} selected={selected} />
        )}
      </div>
      <div aria-hidden="true" className="flex">
        {months.map((m, i) => (
          <span
            key={m}
            className={cn(
              "min-w-0 flex-1 text-center text-2xs transition-colors duration-150",
              i === selected ? "font-semibold text-foreground" : "text-muted-foreground",
              !slots[i] && "opacity-40",
            )}
          >
            {n > 6 ? MONTHS_SHORT[m] : MONTHS[m]}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarsView({ slots, selected }: { slots: (HomeData["monthly"][number] | null)[]; selected: number | null }) {
  const max = Math.max(1, ...slots.flatMap((s) => (s ? [s.income, s.expenses] : [])));
  const pct = (v: number) => `${(Math.max(0, v) / max) * 92}%`;
  return (
    <div aria-hidden="true" className="absolute inset-0 flex items-end border-b border-chart-axis px-1">
      {slots.map((s, i) => (
        <div
          key={i}
          className={cn(
            "flex h-full min-w-0 flex-1 items-end justify-center gap-[3px] pb-px transition-opacity duration-150",
            selected !== null && i !== selected && "opacity-45",
          )}
        >
          <span className={cn(barClass, "bg-chart-income")} style={{ height: pct(s?.income ?? 0), "--i": i } as CSSProperties} />
          <span className={cn(barClass, "bg-chart-expense")} style={{ height: pct(s?.expenses ?? 0), "--i": i } as CSSProperties} />
        </div>
      ))}
    </div>
  );
}

function LineView({ totals, n, selected }: { totals: (number | null)[]; n: number; selected: number | null }) {
  const values = totals.filter((t) => t !== null);
  const top = Math.max(1, ...values);
  const bottom = Math.min(0, ...values);
  const y = (v: number) => PAD + (1 - (v - bottom) / (top - bottom)) * (H - 2 * PAD);
  // Starts at nothing on the period's left edge, then one point per month
  const points: [number, number][] = [
    [0, y(0)],
    ...totals.flatMap((t, i): [number, number][] => (t === null ? [] : [[((i + 0.5) / n) * W, y(t)]])),
  ];
  const line = smoothPath(points);
  const last = points.at(-1)!;
  const area = points.length > 1 ? `${line} L${last[0]},${H} L0,${H} Z` : "";
  const shown = selected === null ? null : totals[selected];

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id="profit-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" className="[stop-color:var(--color-chart-income)] [stop-opacity:0.22]" />
            <stop offset="100%" className="[stop-color:var(--color-chart-income)] [stop-opacity:0]" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="stroke-chart-grid" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <g className="animate-reveal-x">
          <path d={area} fill="url(#profit-fill)" />
          <path
            d={line}
            fill="none"
            className="stroke-chart-income"
            strokeWidth="2.5"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
      {shown != null && (
        <div
          aria-hidden="true"
          className="absolute size-3 -translate-1/2 rounded-full bg-chart-income ring-4 ring-background"
          style={{ left: `${((selected! + 0.5) / n) * 100}%`, top: `${(y(shown) / H) * 100}%` }}
        />
      )}
    </>
  );
}

const chip =
  "grid h-10 min-w-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent px-3 font-medium text-muted-foreground transition-[background-color,color,scale] duration-150 active:scale-95 disabled:cursor-default disabled:opacity-35";

/** Quarters and the whole year as chips; the calendar picks the year. */
function PeriodChips({
  period,
  onChange,
  years,
  today,
}: {
  period: Period;
  onChange: (p: Period) => void;
  years: number[];
  today: Date;
}) {
  const lastQuarter = period.year === today.getFullYear() ? quarterOfMonth(today.getMonth()) : 4;
  const options: { quarter: Period["quarter"]; label: string }[] = [
    ...([1, 2, 3, 4] as const).map((q) => ({ quarter: q, label: `T${q}` })),
    { quarter: null, label: "Año" },
  ];

  return (
    <div className="flex items-center justify-between gap-1">
      <div role="radiogroup" aria-label={`Periodo de ${period.year}`} className="flex items-center gap-1">
        {options.map(({ quarter, label }) => {
          const active = period.quarter === quarter;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={periodLabel({ year: period.year, quarter })}
              disabled={quarter !== null && quarter > lastQuarter}
              onClick={() => onChange({ year: period.year, quarter })}
              className={cn(chip, active && "bg-card font-semibold text-foreground shadow-card")}
            >
              {label}
            </button>
          );
        })}
      </div>
      <Select
        value={String(period.year)}
        onValueChange={(value) => {
          const year = Number(value);
          const last = year === today.getFullYear() ? quarterOfMonth(today.getMonth()) : 4;
          onChange({ year, quarter: period.quarter === null ? null : Math.min(period.quarter, last) as Period["quarter"] });
        }}
      >
        <SelectTrigger
          aria-label={`Año: ${period.year}`}
          className="h-10 gap-1.5 rounded-full border-0 bg-card px-3.5 font-medium shadow-card hover:bg-card"
        >
          <CalendarDays className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
          {period.year}
        </SelectTrigger>
        <SelectContent align="end">
          {years.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface Line {
  label: string;
  to: string;
  value: Cents;
  detail: string;
  /** Tone of the detail: good news, bad news or plain. */
  tone?: "success" | "danger";
}

function SummaryRow({ line, index }: { line: Line; index: number }) {
  return (
    <li className="animate-rise-in" style={{ "--i": index } as CSSProperties}>
      <Link to={line.to} className={cn(listRowClass, "min-h-[72px]")}>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-semibold">{line.label}</span>
          <span
            className={cn(
              "truncate text-sm",
              line.tone === "success" ? "text-success" : line.tone === "danger" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {line.detail}
          </span>
        </span>
        <span className="amount text-lg font-semibold">{formatEUR(line.value)}</span>
        <ChevronRight className="size-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

interface MobileOverviewProps {
  data: HomeData;
  period: Period;
  onPeriodChange: (p: Period) => void;
  years: number[];
  today: Date;
  /** What to set aside for taxes, worked out with the desktop KPIs. */
  reserve: TaxReserve;
  /** Round shortcuts on the right of the header. */
  actions: ReactNode;
}

/** The phone's home: the period's profit large, a chart of its months, and the figures behind it. */
export function MobileOverview({ data, period, onPeriodChange, years, today, reserve, actions }: MobileOverviewProps) {
  const [view, setView] = useState(readView);
  // The selection belongs to one period and view; changing either clears it
  const key = `${periodKey(period)}:${view}`;
  const [selection, setSelection] = useState<{ key: string; slot: number } | null>(null);
  const slot = selection?.key === key ? selection.slot : null;
  const month = slot === null ? null : data.months[slot]!;
  const point = month === null ? null : data.monthly[month];
  const compare = periodShortLabel(data.previous, period.year);
  const change = data.changes.profit;

  // Profit from the start of the period to the selected month, for the line
  const upTo =
    slot === null
      ? 0
      : data.months.slice(0, slot + 1).reduce((sum, m) => sum + (data.monthly[m]?.profit ?? 0), 0);

  const changeView = (next: ChartView) => {
    setView(next);
    storeView(next);
  };

  const tone = (value: number | null, upIsGood: boolean) =>
    value === null ? undefined : value >= 0 === upIsGood ? ("success" as const) : ("danger" as const);
  const vs = (value: number | null) => (value === null ? "Sin periodo anterior" : `${signed(value)} vs. ${compare}`);

  const lines: Line[] = [
    {
      label: "Ingresos",
      to: "/ventas/facturas",
      value: data.totals.income,
      detail: vs(data.changes.income),
      tone: tone(data.changes.income, true),
    },
    {
      label: "Gastos",
      to: "/compras/facturas",
      value: data.totals.expenses,
      detail: vs(data.changes.expenses),
      tone: tone(data.changes.expenses, false),
    },
    {
      label: "Reserva para impuestos",
      to: "/impuestos",
      value: reserve.value,
      detail: vs(reserve.change),
      tone: tone(reserve.change, false),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-2">
        <h1 className="sr-only">Inicio</h1>
        <ViewToggle view={view} onChange={changeView} />
        <div className="flex items-center gap-2">{actions}</div>
      </header>

      <section aria-label="Beneficio" className="flex flex-col gap-4">
        <div aria-live="polite" className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">
            {month === null
              ? `Beneficio, ${periodLabel(period).toLowerCase()}`
              : view === "line" && slot! > 0
                ? `Beneficio acumulado hasta ${MONTHS[month]!.toLowerCase()}`
                : `Beneficio de ${MONTHS[month]!.toLowerCase()}`}
          </span>
          <AnimatedAmount
            value={point ? cents(view === "line" ? upTo : point.profit) : data.profit}
            className="amount text-5xl font-semibold"
          />
          {point ? (
            <span className="flex items-center gap-4 text-sm text-muted-foreground">
              {(
                [
                  ["Ingresos", point.income, "bg-chart-income"],
                  ["Gastos", point.expenses, "bg-chart-expense"],
                ] as const
              ).map(([label, value, dot]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", dot)} aria-hidden="true" />
                  {label} <span className="amount text-foreground">{formatEUR(value)}</span>
                </span>
              ))}
            </span>
          ) : (
            <span className="flex items-center gap-2.5 text-sm">
              {change !== null && (
                <>
                  <span className={cn("font-medium", tone(change, true) === "success" ? "text-success" : "text-destructive")}>
                    {signed(change)}
                  </span>
                  <span aria-hidden="true" className="h-3.5 w-px bg-border" />
                </>
              )}
              <span className="text-muted-foreground">
                {change !== null ? `vs. ${compare}` : `Margen del ${formatPercent(data.margin)}`}
              </span>
            </span>
          )}
        </div>
        <PeriodChart
          key={key}
          data={data}
          view={view}
          selected={slot}
          onSelect={(next) => setSelection(next === null ? null : { key, slot: next })}
        />
        <PeriodChips period={period} onChange={onPeriodChange} years={years} today={today} />
      </section>

      <section aria-labelledby="summary-title" className="flex flex-col gap-2.5 pt-2">
        <h2 id="summary-title" className="m-0 text-lg font-semibold tracking-tight">
          Resumen
        </h2>
        <ListGroup>
          {lines.map((line, i) => (
            <SummaryRow key={line.label} line={line} index={i} />
          ))}
        </ListGroup>
      </section>
    </div>
  );
}

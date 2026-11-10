import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { CalendarDays, ChartColumn, ChevronRight, TrendingUp } from "lucide-react";
import { cents, periodKey, quarterOfMonth, type Cents, type Period } from "@cuentalibre/core";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@cuentalibre/ui/components/select";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { AnimatedAmount } from "@/components/animated-amount";
import { listRowClass } from "@/components/page";
import { TAX_SETTINGS_PATH } from "@/features/settings/settings-model";
import { MONTHS, MONTHS_SHORT, formatCompactEUR, formatPercent, periodLabel, periodShortLabel } from "@/lib/format";
import { useDismiss } from "@/lib/use-dismiss";
import type { HomeData } from "./home-data";

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
  "flex w-[46%] max-w-16 origin-bottom animate-grow-up flex-col gap-[2px] overflow-hidden rounded-[10px] [animation-delay:calc(var(--i)*50ms)] transition-[height] duration-500 ease-out";

interface ChartProps {
  data: HomeData;
  view: ChartView;
  /** Index of the selected month among the period's months, or null. */
  selected: number | null;
  onSelect: (slot: number | null) => void;
}

/**
 * The period's months side by side: income and expenses as bars, or the profit adding up month by month
 * as a line that ends on the period's figure. Touching a month selects it; touching it again, or anywhere
 * else on the screen, clears it.
 */
function PeriodChart({ data, view, selected, onSelect }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const toggling = useRef(false);
  useDismiss(ref, selected !== null, () => onSelect(null));
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
        className="relative h-[160px] touch-pan-y select-none"
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

/**
 * One bar per month as tall as what was invoiced: the expenses at the bottom and the profit on top, so each bar
 * shows how much of every euro stays. A month with a loss is as tall as its expenses. The profit sits above it.
 */
function BarsView({ slots, selected }: { slots: (HomeData["monthly"][number] | null)[]; selected: number | null }) {
  const max = Math.max(1, ...slots.flatMap((s) => (s ? [s.income, s.expenses] : [])));
  // Leave room above the tallest bar for its label
  const pct = (v: number) => `${(Math.max(0, v) / max) * 80}%`;
  const narrow = slots.length > 6;
  return (
    <div aria-hidden="true" className="absolute inset-0 flex items-end px-1">
      {slots.map((s, i) => (
        <div
          key={i}
          className={cn(
            "flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5 transition-opacity duration-150",
            selected !== null && i !== selected && "opacity-45",
          )}
        >
          {s && (s.income > 0 || Math.abs(s.profit) >= 50) && (
            <span
              className={cn(
                "amount font-semibold whitespace-nowrap",
                narrow ? "text-[10px]" : "text-xs",
                s.profit < 0 ? "text-destructive" : "text-foreground",
              )}
            >
              {/* Twelve months leave no room for the currency */}
              {narrow ? formatCompactEUR(s.profit).replace(" €", "") : formatCompactEUR(s.profit)}
            </span>
          )}
          <div
            className={barClass}
            style={{ height: pct(s ? Math.max(s.income, s.expenses) : 0), "--i": i } as CSSProperties}
          >
            {s && s.profit > 0 && <span className="min-h-0 bg-chart-income" style={{ flexGrow: s.profit }} />}
            {s && s.expenses > 0 && (
              <span className="min-h-1 bg-chart-expense" style={{ flexGrow: s.expenses }} />
            )}
          </div>
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
  /** Colour of its share in the bar; "outline" for what stays out of it. */
  dot: string;
}

/**
 * Where the period's income goes: what stays after expenses and the estimated taxes, as one bar split in three,
 * then each part as a row leading to its page. VAT is charged on top of the invoices, so it stays out of the bar.
 */
function TakeHomeSummary({ data }: { data: HomeData }) {
  const { income, expenses } = data.totals;
  const { takeHome, incomeTax } = data.takeHome;
  const taxes = cents(incomeTax + data.socialSecurityEstimate);
  const share = (v: number) => (income ? Math.max(0, (v / income) * 100) : 0);

  const parts = [
    { label: "Te queda", value: takeHome, color: "bg-chart-income" },
    { label: "Impuestos estimados", value: taxes, color: "bg-chart-tax" },
    { label: "Gastos", value: expenses, color: "bg-chart-expense" },
  ];

  const lines: Line[] = [
    { label: "Facturado", to: "/ventas/facturas", value: income, dot: "" },
    { label: "Gastos", to: "/compras/facturas", value: expenses, dot: "bg-chart-expense" },
    { label: "Impuestos estimados", to: "/impuestos", value: taxes, dot: "bg-chart-tax" },
    ...(data.taxes.vat > 0
      ? [{ label: "IVA a pagar", to: "/impuestos", value: data.taxes.vat, dot: "outline" }]
      : []),
  ];

  return (
    <section aria-labelledby="mobile-take-home-title" className="flex flex-col gap-2.5 pt-2">
      <h2 id="mobile-take-home-title" className="m-0 text-lg font-semibold tracking-tight">
        Lo que te queda
      </h2>
      <div className="surface flex flex-col overflow-hidden">
        <div className="flex flex-col gap-3.5 px-4 pt-4 pb-3">
          <div className="flex items-baseline justify-between gap-3">
            <AnimatedAmount value={takeHome} className="amount text-3xl font-semibold" />
            <span className="text-sm font-medium text-success">{formatPercent(share(takeHome))} de lo facturado</span>
          </div>
          <div
            role="img"
            aria-label={parts.map((p) => `${p.label}: ${formatEUR(p.value)}`).join(", ")}
            className="flex h-3 animate-reveal-x gap-[3px] overflow-hidden rounded-full bg-muted"
          >
            {parts.map((p) => (
              <div
                key={p.label}
                className={cn("transition-[width] duration-500 ease-out", p.color)}
                style={{ width: `${share(p.value)}%` }}
              />
            ))}
          </div>
        </div>
        <ul className="m-0 flex list-none flex-col px-4 py-0 [&>li>*]:border-t [&>li>*]:border-divider">
          {lines.map((line) => (
            <li key={line.label}>
              <Link to={line.to} className={cn(listRowClass, "min-h-13 gap-2.5")}>
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    line.dot === "outline" ? "border-2 border-muted-foreground" : line.dot,
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{line.label}</span>
                <span className="amount font-semibold">{formatEUR(line.value)}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        {data.socialSecurityFeeMissing && (
          <p className="m-0 border-t border-divider px-4 py-3 text-xs text-muted-foreground">
            No incluye tu cuota de autónomos.{" "}
            <Link to={TAX_SETTINGS_PATH} className="font-medium text-foreground">
              Indícala en Configuración
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}

interface MobileOverviewProps {
  data: HomeData;
  period: Period;
  onPeriodChange: (p: Period) => void;
  years: number[];
  today: Date;
  /** Round shortcuts on the right of the header. */
  actions: ReactNode;
}

/** The phone's home: the period's profit large, a chart of its months, and the figures behind it. */
export function MobileOverview({ data, period, onPeriodChange, years, today, actions }: MobileOverviewProps) {
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

  const tone = (value: number, upIsGood: boolean) => (value >= 0 === upIsGood ? "success" : "danger");

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
                  ["Ingresos", point.income, view === "line" ? "bg-chart-income" : null],
                  ["Gastos", point.expenses, "bg-chart-expense"],
                ] as const
              ).map(([label, value, dot]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  {dot && <span className={cn("size-2 rounded-full", dot)} aria-hidden="true" />}
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

      <TakeHomeSummary data={data} />
    </div>
  );
}

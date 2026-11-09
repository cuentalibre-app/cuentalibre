import type { CSSProperties } from "react";
import { cents, type Cents } from "@cuentalibre/core";
import { Badge } from "@cuentalibre/ui/components/badge";
import { cn } from "@cuentalibre/ui/lib/cn";
import { AnimatedAmount } from "@/components/animated-amount";
import { formatPercent, periodShortLabel } from "@/lib/format";
import type { HomeData } from "./home-data";

interface Kpi {
  label: string;
  /** Marker color, matching the figure's color in the charts. */
  dot: string;
  value: Cents;
  change: number | null;
  /** Whether going up is good news (true), bad news (false) or neither (null). */
  upIsGood: boolean | null;
}

function tone(change: number, upIsGood: boolean | null) {
  if (upIsGood === null) return "neutral" as const;
  return change >= 0 === upIsGood ? ("success" as const) : ("danger" as const);
}

function KpiCard({ kpi, compareLabel, index }: { kpi: Kpi; compareLabel: string; index: number }) {
  const change = kpi.change;
  const t = change === null ? null : tone(change, kpi.upIsGood);
  const changeText = change === null ? null : `${change >= 0 ? "↑" : "↓"} ${formatPercent(Math.abs(change))}`;

  return (
    <div
      className="flex animate-rise-in flex-col gap-1.5 surface p-3.5 lg:gap-2.5 lg:p-5"
      style={{ "--i": index } as CSSProperties}
    >
      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold lg:text-lg">
        <span className={cn("size-2.5 shrink-0 rounded-full", kpi.dot)} aria-hidden="true" />
        <span className="truncate">{kpi.label}</span>
      </span>
      <AnimatedAmount value={kpi.value} className="amount text-xl font-semibold lg:text-2xl" />
      {changeText && t ? (
        <span className="flex items-center gap-2 text-xs text-muted-foreground lg:text-sm">
          <Badge tone={t} className="h-6 text-xs">
            {changeText}
          </Badge>
          vs. {compareLabel}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground lg:text-sm">{"\u00a0"}</span>
      )}
    </div>
  );
}

/**
 * What to set aside for the period: the VAT due (303), the period's share of the yearly income tax estimate and
 * the self-employed fees not booked yet, the same figures as in "Neto después de impuestos". The 130 advances
 * are paid out of this reserve.
 */
function reserveOf(data: HomeData): Cents {
  return cents(Math.max(0, data.taxes.vat) + data.takeHome.incomeTax + data.socialSecurityEstimate);
}

export interface TaxReserve {
  value: Cents;
  /** Percentage change against the previous period, or null when it had nothing to set aside. */
  change: number | null;
}

/** The period's tax reserve and how it moved against the previous period's. */
export function taxReserve(data: HomeData, previous: HomeData): TaxReserve {
  const value = reserveOf(data);
  const before = reserveOf(previous);
  return { value, change: before ? ((value - before) / before) * 100 : null };
}

export function KpiGrid({ data, reserve, className }: { data: HomeData; reserve: TaxReserve; className?: string }) {
  const compareLabel = periodShortLabel(data.previous, data.period.year);

  const kpis: Kpi[] = [
    {
      label: "Ingresos",
      dot: "bg-chart-income",
      value: data.totals.income,
      change: data.changes.income,
      upIsGood: true,
    },
    {
      label: "Gastos",
      dot: "bg-chart-expense",
      value: data.totals.expenses,
      change: data.changes.expenses,
      upIsGood: false,
    },
    {
      label: "Beneficio",
      dot: "bg-success",
      value: data.profit,
      change: data.changes.profit,
      upIsGood: true,
    },
    {
      label: "Reserva para impuestos",
      dot: "bg-chart-tax",
      value: reserve.value,
      change: reserve.change,
      // More to set aside means more taxes to pay, as with expenses
      upIsGood: false,
    },
  ];

  return (
    <section aria-label="Resumen del periodo" className={cn("grid grid-cols-2 gap-2.5 lg:gap-5 xl:grid-cols-4", className)}>
      {kpis.map((kpi, i) => (
        <KpiCard key={kpi.label} kpi={kpi} compareLabel={compareLabel} index={i} />
      ))}
    </section>
  );
}

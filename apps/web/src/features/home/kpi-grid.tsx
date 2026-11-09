import type { CSSProperties } from "react";
import { cents, type Cents } from "@cuentalibre/core";
import { Badge } from "@cuentalibre/ui/components/badge";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
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
  /** Shown in place of the change when there is none. */
  note?: string;
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
      className="flex animate-rise-in flex-col gap-1.5 rounded-xl border border-border bg-card p-3.5 lg:gap-2.5 lg:p-5"
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
        <span className="text-xs text-muted-foreground lg:text-sm">{kpi.note ?? "\u00a0"}</span>
      )}
    </div>
  );
}

/**
 * What to set aside for the period: the VAT due (303), the period's share of the yearly income tax estimate and
 * the self-employed fees not booked yet, the same figures as in "Neto después de impuestos". The 130 advances
 * are paid out of this reserve.
 */
function taxReserve(data: HomeData) {
  const { vat } = data.taxes;
  const irpf = data.takeHome.incomeTax;
  const fees = data.socialSecurityEstimate;
  const due = [vat > 0 && `IVA ${formatEUR(vat)}`, `IRPF ${formatEUR(irpf)}`, fees > 0 && `cuota ${formatEUR(fees)}`]
    .filter(Boolean)
    .join(" + ");
  return {
    value: cents(Math.max(0, vat) + irpf + fees),
    note: vat < 0 ? `${due} · IVA a compensar ${formatEUR(cents(-vat))}` : due,
  };
}

export function KpiGrid({ data }: { data: HomeData }) {
  const compareLabel = periodShortLabel(data.previous, data.period.year);
  const reserve = taxReserve(data);

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
      change: null,
      upIsGood: null,
      note: reserve.note,
    },
  ];

  return (
    <section aria-label="Resumen del periodo" className="grid grid-cols-2 gap-2.5 lg:gap-5 xl:grid-cols-4">
      {kpis.map((kpi, i) => (
        <KpiCard key={kpi.label} kpi={kpi} compareLabel={compareLabel} index={i} />
      ))}
    </section>
  );
}

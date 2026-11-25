import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import { cents, type Cents } from "@cuentalibre/core";
import { ArrowDownLeft, ArrowUpRight, PiggyBank, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@cuentalibre/ui/lib/cn";
import { AnimatedAmount } from "@/components/animated-amount";
import { formatPercent } from "@/lib/format";
import { useDateLabels } from "@/i18n/dates";
import type { HomeData } from "./home-data";

interface Kpi {
  label: string;
  icon: LucideIcon;
  /** Icon color, matching the figure's color in the charts. */
  tint: string;
  value: Cents;
  change: number | null;
  /** Whether going up is good news (true), bad news (false) or neither (null). */
  upIsGood: boolean | null;
}

function tone(change: number, upIsGood: boolean | null) {
  if (upIsGood === null) return "neutral" as const;
  return change >= 0 === upIsGood ? ("success" as const) : ("danger" as const);
}

const TONE_TEXT = { success: "text-success", danger: "text-destructive", neutral: "text-muted-foreground" } as const;

function KpiCard({ kpi, compareLabel, index }: { kpi: Kpi; compareLabel: string; index: number }) {
  const { t } = useTranslation();
  const change = kpi.change;
  const changeTone = change === null ? null : tone(change, kpi.upIsGood);
  const changeText = change === null ? null : `${change >= 0 ? "↑" : "↓"} ${formatPercent(Math.abs(change))}`;
  const Icon = kpi.icon;

  return (
    <div className="flex animate-rise-in flex-col surface" style={{ "--i": index } as CSSProperties}>
      {/* Header row: the series-colored icon and the label, ruled off from the figure */}
      <span className="flex min-w-0 items-center gap-2.5 border-b border-divider px-3.5 py-2.5 text-sm font-semibold lg:px-4 lg:py-3 lg:text-lg">
        <Icon className={cn("size-4 shrink-0 lg:size-5", kpi.tint)} strokeWidth={2} aria-hidden="true" />
        <span className="truncate">{kpi.label}</span>
      </span>
      <div className="flex flex-col gap-1.5 px-3.5 pt-3 pb-3.5 lg:gap-2 lg:px-4 lg:pt-4 lg:pb-4">
        <AnimatedAmount
          value={kpi.value}
          className="amount text-xl font-semibold lg:text-[2rem] lg:leading-10 lg:font-medium @[52rem]:text-[1.625rem] @[64rem]:text-[2rem]"
        />
        {changeText && changeTone ? (
          <span className="text-xs text-muted-foreground lg:text-sm">
            <span className={cn("amount font-medium", TONE_TEXT[changeTone])}>{changeText}</span>{" "}
            {t("home.metrics.change", { period: compareLabel })}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground lg:text-sm">{"\u00a0"}</span>
        )}
      </div>
    </div>
  );
}

/**
 * What to set aside for the period: the VAT due (303), the period's share of the yearly income tax estimate and
 * the self-employed fees not booked yet, the same figures as in "Beneficio neto estimado". The 130 advances
 * are paid out of this reserve. A company has neither estimate, so it only sets aside the VAT.
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
  const { t } = useTranslation();
  const { periodShortLabel } = useDateLabels();
  const compareLabel = periodShortLabel(data.previous, data.period.year);

  const kpis: Kpi[] = [
    {
      label: t("home.metrics.income"),
      icon: ArrowDownLeft,
      tint: "text-chart-income",
      value: data.totals.income,
      change: data.changes.income,
      upIsGood: true,
    },
    {
      label: t("home.metrics.expenses"),
      icon: ArrowUpRight,
      tint: "text-chart-expense",
      value: data.totals.expenses,
      change: data.changes.expenses,
      upIsGood: false,
    },
    {
      label: t("home.metrics.profit"),
      icon: TrendingUp,
      tint: "text-success",
      value: data.profit,
      change: data.changes.profit,
      upIsGood: true,
    },
    {
      label: t("home.metrics.taxReserve"),
      icon: PiggyBank,
      tint: "text-chart-tax",
      value: reserve.value,
      change: reserve.change,
      // More to set aside means more taxes to pay, as with expenses
      upIsGood: false,
    },
  ];

  return (
    <section
      aria-label={t("home.metrics.summary")}
      className={cn("grid grid-cols-2 gap-2.5 lg:gap-3 @[52rem]:grid-cols-4", className)}
    >
      {kpis.map((kpi, i) => (
        <KpiCard key={kpi.label} kpi={kpi} compareLabel={compareLabel} index={i} />
      ))}
    </section>
  );
}

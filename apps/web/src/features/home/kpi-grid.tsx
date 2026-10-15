import { Badge } from "@fiscalia/ui/components/badge";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { formatPercent, periodShortLabel } from "@/lib/format";
import type { HomeData } from "./home-data";

interface Kpi {
  label: string;
  value: number;
  change: number | null;
  /** Whether going up is good news (true), bad news (false) or neither (null). */
  upIsGood: boolean | null;
  /** Extra detail lines, shown on desktop. */
  details: [string, string];
  /** Replaces the change on mobile when there is none. */
  mobileNote?: string;
}

function tone(change: number, upIsGood: boolean | null) {
  if (upIsGood === null) return "neutral" as const;
  return change >= 0 === upIsGood ? ("success" as const) : ("danger" as const);
}

const toneText = { neutral: "text-muted-foreground", success: "text-success", danger: "text-destructive" };

function KpiCard({ kpi, compareLabel }: { kpi: Kpi; compareLabel: string }) {
  const change = kpi.change;
  const t = change === null ? null : tone(change, kpi.upIsGood);
  const changeText = change === null ? null : `${change >= 0 ? "↑" : "↓"} ${formatPercent(Math.abs(change))}`;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border p-3.5 lg:gap-2.5 lg:p-5">
      <div className="flex items-center justify-between gap-2 lg:min-h-6">
        <span className="text-sm text-muted-foreground lg:text-base">{kpi.label}</span>
        {changeText && t && (
          <Badge tone={t} className="hidden h-6 px-2.5 text-xs lg:inline-flex">
            {changeText}
          </Badge>
        )}
      </div>
      <span className="amount text-xl font-medium lg:text-2xl">{formatEUR(kpi.value)}</span>
      {changeText && t ? (
        <span className={cn("text-xs font-semibold lg:hidden", toneText[t])}>
          {changeText} vs. {compareLabel}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground lg:hidden">{kpi.mobileNote ?? " "}</span>
      )}
      <div className="hidden flex-col gap-0.5 text-xs text-muted-foreground lg:flex">
        <span>{kpi.details[0]}</span>
        <span>{kpi.details[1]}</span>
      </div>
    </div>
  );
}

export function KpiGrid({ data }: { data: HomeData }) {
  const compareLabel = periodShortLabel(data.previous, data.period.year);
  const vs = data.hasPrevious ? ` · vs. ${compareLabel}` : "";

  const kpis: Kpi[] = [
    {
      label: "Ingresos",
      value: data.totals.income,
      change: data.changes.income,
      upIsGood: true,
      details: [`IVA repercutido ${formatEUR(data.totals.outputVat)}`, `${data.counts.invoices} facturas${vs}`],
    },
    {
      label: "Gastos",
      value: data.totals.expenses,
      change: data.changes.expenses,
      upIsGood: null,
      details: [`IVA soportado ${formatEUR(data.totals.inputVat)}`, `${data.counts.receipts} justificantes`],
    },
    {
      label: "Beneficio",
      value: data.profit,
      change: data.changes.profit,
      upIsGood: true,
      details: [`Margen ${formatPercent(data.margin)}`, "Antes de IRPF"],
    },
    {
      label: "Impuestos est.",
      value: data.taxes.total,
      change: null,
      upIsGood: null,
      details: [`303 IVA ${formatEUR(data.taxes.vat)}`, `130 IRPF ${formatEUR(data.taxes.irpf)}`],
      mobileNote: "303 + 130",
    },
  ];

  return (
    <section
      aria-label="Resumen del periodo"
      className="grid grid-cols-2 gap-2.5 lg:grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] lg:gap-4"
    >
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} compareLabel={compareLabel} />
      ))}
    </section>
  );
}

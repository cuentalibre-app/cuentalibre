import { Card, CardTitle } from "@fiscalia/ui/components/card";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { AnimatedAmount } from "@/components/animated-amount";
import { currentUser } from "@/mocks/data";
import { formatPercent } from "@/lib/format";
import type { HomeData } from "./home-data";

/** What's left of the period's income after expenses and an income tax estimate. */
export function TakeHomeCard({ data, className }: { data: HomeData; className?: string }) {
  const { income, outputVat } = data.totals;
  const { takeHome, incomeTax } = data.takeHome;
  const share = (v: number) => (income ? Math.max(0, (v / income) * 100) : 0);

  const parts = [
    { label: "Neto", value: takeHome, color: "bg-chart-income" },
    { label: "IRPF estimado (~20 %)", value: incomeTax, color: "bg-chart-tax" },
    { label: "Gastos", value: data.totals.expenses, color: "bg-chart-expense" },
  ];

  return (
    <Card aria-labelledby="take-home-title" className={cn("gap-3 p-4 lg:gap-3 lg:p-4", className)}>
      <div className="flex flex-col gap-1">
        <CardTitle id="take-home-title" className="text-md lg:text-lg">
          Neto después de impuestos
        </CardTitle>
        <span className="text-sm text-muted-foreground">Estimación sobre {formatEUR(income)} facturados sin IVA</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <AnimatedAmount value={takeHome} className="amount text-2xl font-medium lg:text-4xl" />
        <span className="text-sm font-medium text-success">{formatPercent(share(takeHome))} de lo facturado</span>
      </div>

      <div
        role="img"
        aria-label={parts.map((p) => `${p.label}: ${formatEUR(p.value)}`).join(", ")}
        className="flex h-3 animate-reveal-x gap-0.5 overflow-hidden rounded-xs bg-muted lg:h-3.5"
      >
        {parts.map((p) => (
          <div
            key={p.label}
            className={cn("transition-[width] duration-500 ease-out", p.color)}
            style={{ width: `${share(p.value)}%` }}
          />
        ))}
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0 lg:gap-2.5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2.5">
            <span className={cn("size-2.5 shrink-0 rounded-xs", p.color)} aria-hidden="true" />
            <span className="flex-1">{p.label}</span>
            <span className="amount">{formatEUR(p.value)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-1 border-t border-divider pt-3 text-xs text-muted-foreground">
        <span>
          Además has cobrado <span className="amount text-foreground">{formatEUR(outputVat)}</span> de IVA, que es de
          Hacienda.
        </span>
        <span>No incluye tu cuota de autónomos ({formatEUR(currentUser.socialSecurityFee)} al mes).</span>
      </div>
    </Card>
  );
}

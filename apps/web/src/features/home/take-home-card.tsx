import { INCOME_TAX_BRACKETS, PERSONAL_ALLOWANCE, centsToEuros, type Cents } from "@fiscalia/core";
import { Info } from "lucide-react";
import { Card, CardTitle } from "@fiscalia/ui/components/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { AnimatedAmount } from "@/components/animated-amount";
import { useSettings } from "@/features/settings/settings-store";
import { formatPercent } from "@/lib/format";
import type { HomeData } from "./home-data";

/** Whole euros for the bracket limits: "12.450 €". */
const euros = (amount: Cents) => `${centsToEuros(amount).toLocaleString("es-ES", { useGrouping: "always" })} €`;

/** How the income tax estimate is worked out: the scale and the figures of the year. */
function IncomeTaxHint({ estimate, year }: { estimate: HomeData["incomeTax"]; year: number }) {
  let from = 0 as Cents;
  const brackets = INCOME_TAX_BRACKETS.map(({ upTo, rate }) => {
    const label = upTo === null ? `Más de ${euros(from)}` : `${euros(from)} – ${euros(upTo)}`;
    from = upTo ?? from;
    return { label, rate: formatPercent(rate * 100) };
  });

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="Cómo se estima el IRPF" className="cursor-help text-muted-foreground">
            <Info className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="block max-w-80 px-3.5 py-3 leading-snug font-normal">
          <p className="m-0 mb-1.5 text-center font-semibold">IRPF estimado</p>
          <div className="flex flex-col gap-2">
            <p className="m-0">
              El IRPF es <strong>progresivo</strong>: cada tramo de tu rendimiento anual paga su tipo, así que el tipo
              medio sube cuanto más ganas. Los primeros {euros(PERSONAL_ALLOWANCE)} (mínimo personal) no tributan.
            </p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-background/30">
                  <th className="py-1 text-left font-semibold">Rendimiento anual</th>
                  <th className="py-1 text-right font-semibold">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {brackets.map((b) => (
                  <tr key={b.label}>
                    <td className="py-0.5">{b.label}</td>
                    <td className="py-0.5 text-right font-semibold">{b.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="m-0">
              Rendimiento neto de {year}
              {estimate.projectedNet !== estimate.projectedProfit && ", tras los gastos de difícil justificación"}
              {", proyectado a todo el año"}: <strong>{formatEUR(estimate.projectedNet)}</strong>. IRPF del año:{" "}
              <strong>{formatEUR(estimate.tax)}</strong>, un{" "}
              <strong className="whitespace-nowrap">{formatPercent(estimate.rate * 100)}</strong> de tu beneficio, que
              se aplica al del periodo.
            </p>
            <p className="m-0">
              Es una aproximación: usa la escala estatal más una autonómica media (cada comunidad varía uno o dos
              puntos) y no tiene en cuenta deducciones, otros ingresos ni tu situación familiar. El modelo 130 adelanta
              un 20 %; la diferencia se paga o devuelve en la renta.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** What's left of the period's income after expenses and an estimate of its yearly income tax. */
export function TakeHomeCard({ data, className }: { data: HomeData; className?: string }) {
  const { income, outputVat } = data.totals;
  const { takeHome, incomeTax } = data.takeHome;
  const fee = useSettings().tax.socialSecurityFee;
  const share = (v: number) => (income ? Math.max(0, (v / income) * 100) : 0);

  const parts = [
    { label: "Neto", value: takeHome, color: "bg-chart-income" },
    {
      label: `IRPF estimado (~${formatPercent(data.incomeTax.rate * 100)})`,
      hint: <IncomeTaxHint estimate={data.incomeTax} year={data.period.year} />,
      value: incomeTax,
      color: "bg-chart-tax",
    },
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
            <span className="flex flex-1 items-center gap-1.5">
              {p.label}
              {"hint" in p && p.hint}
            </span>
            <span className="amount">{formatEUR(p.value)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-1 border-t border-divider pt-3 text-xs text-muted-foreground">
        <span>
          Además has cobrado <span className="amount text-foreground">{formatEUR(outputVat)}</span> de IVA, que es de
          Hacienda.
        </span>
        {data.socialSecurityBooked > 0 ? (
          <span>
            Los gastos incluyen tu cuota de autónomos:{" "}
            <span className="amount text-foreground">{formatEUR(data.socialSecurityBooked)}</span> en el periodo.
          </span>
        ) : (
          <span>No incluye tu cuota de autónomos ({formatEUR(fee)} al mes).</span>
        )}
      </div>
    </Card>
  );
}

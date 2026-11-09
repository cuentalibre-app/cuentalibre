import { INCOME_TAX_BRACKETS, PERSONAL_ALLOWANCE, cents, centsToEuros, type Cents } from "@cuentalibre/core";
import { Link } from "react-router";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { AnimatedAmount } from "@/components/animated-amount";
import { TAX_SETTINGS_PATH } from "@/features/settings/settings-model";
import { HelpTip, Section } from "@/components/page";
import { formatPercent } from "@/lib/format";
import type { HomeData } from "./home-data";

/** Whole euros for the bracket limits: "12.450 €". */
const euros = (amount: Cents) => `${centsToEuros(amount).toLocaleString("es-ES", { useGrouping: "always" })} €`;

/** What the estimated taxes add up to, and how the income tax is worked out: the scale and the figures of the year. */
function TaxesHint({ data }: { data: HomeData }) {
  const estimate = data.incomeTax;
  const year = data.period.year;
  let from = 0 as Cents;
  const brackets = INCOME_TAX_BRACKETS.map(({ upTo, rate }) => {
    const label = upTo === null ? `Más de ${euros(from)}` : `${euros(from)} – ${euros(upTo)}`;
    from = upTo ?? from;
    return { label, rate: formatPercent(rate * 100) };
  });

  return (
    <TooltipProvider delayDuration={300}>
      <HelpTip label="Cómo se estiman los impuestos" side="left" contentClassName="max-w-80 px-3.5 py-3">
          <p className="m-0 mb-1.5 text-center font-semibold">Impuestos estimados</p>
          <div className="flex flex-col gap-2">
            {data.socialSecurityEstimate > 0 && (
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="py-0.5">IRPF (~{formatPercent(estimate.rate * 100)})</td>
                    <td className="py-0.5 text-right font-semibold">{formatEUR(data.takeHome.incomeTax)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5">Cuota de autónomos sin registrar</td>
                    <td className="py-0.5 text-right font-semibold">{formatEUR(data.socialSecurityEstimate)}</td>
                  </tr>
                </tbody>
              </table>
            )}
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
      </HelpTip>
    </TooltipProvider>
  );
}

/** What's left of the period's income after expenses and an estimate of its yearly income tax. */
export function TakeHomeCard({ data, className }: { data: HomeData; className?: string }) {
  const { income } = data.totals;
  // Net VAT (the 303), the same figure as in the tax reserve card
  const vatDue = data.taxes.vat;
  const { takeHome, incomeTax } = data.takeHome;
  const share = (v: number) => (income ? Math.max(0, (v / income) * 100) : 0);

  const parts = [
    { label: "Neto", value: takeHome, color: "bg-chart-income" },
    {
      label: "Impuestos estimados",
      hint: <TaxesHint data={data} />,
      // The self-employed fees not booked yet go here; the booked ones are already among the expenses
      value: cents(incomeTax + data.socialSecurityEstimate),
      color: "bg-chart-tax",
    },
    { label: "Gastos", value: data.totals.expenses, color: "bg-chart-expense" },
  ];

  return (
    <Section id="take-home-title" title="Neto después de impuestos" className={className}>

      <div className="flex flex-col gap-1.5">
        <AnimatedAmount value={takeHome} className="amount text-2xl font-semibold lg:text-4xl" />
        <span className="text-sm font-medium text-success">{formatPercent(share(takeHome))} de lo facturado</span>
      </div>

      <div
        role="img"
        aria-label={parts.map((p) => `${p.label}: ${formatEUR(p.value)}`).join(", ")}
        className="flex h-2.5 animate-reveal-x gap-0.5 overflow-hidden rounded-full bg-muted"
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
            <span className={cn("size-2.5 shrink-0 rounded-full", p.color)} aria-hidden="true" />
            <span className="flex flex-1 items-center gap-1.5">
              {p.label}
              {"hint" in p && p.hint}
            </span>
            <span className="amount">{formatEUR(p.value)}</span>
          </li>
        ))}
      </ul>

      {/* VAT sits on top of what was invoiced, so it stays out of the bar and the split above */}
      {vatDue > 0 && (
        <div className="flex items-center gap-2.5 border-t border-divider pt-3 lg:pt-4">
          <span className="size-2.5 shrink-0 rounded-full border-2 border-muted-foreground" aria-hidden="true" />
          <span className="flex-1">IVA a pagar</span>
          <span className="amount">{formatEUR(vatDue)}</span>
        </div>
      )}

      {data.socialSecurityFeeMissing && (
        <p className="m-0 mt-auto text-xs text-muted-foreground">
          No incluye tu cuota de autónomos.{" "}
          <Link to={TAX_SETTINGS_PATH} className="font-medium text-foreground">
            Indícala en Configuración
          </Link>
        </p>
      )}
    </Section>
  );
}

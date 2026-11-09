import { useState, type CSSProperties } from "react";
import { cents, type monthlyFlows } from "@cuentalibre/core";
import { Card, CardTitle } from "@cuentalibre/ui/components/card";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { MONTHS, MONTHS_SHORT, formatThousands } from "@/lib/format";

const barClass =
  "origin-bottom animate-grow-up rounded-t-sm [animation-delay:calc(var(--i)*30ms)] transition-[height] duration-500 ease-out";

export function FlowsChart({ months }: { months: ReturnType<typeof monthlyFlows> }) {
  // Start on the latest month with figures, not on a current month that has barely begun
  const [selected, setSelected] = useState(() => {
    const last = months.findLastIndex((m) => m.collected > 0);
    return last === -1 ? months.length - 1 : last;
  });
  const peak = Math.max(0, ...months.flatMap((m) => [m.collected, m.paid]));
  // Steps of 2.000 €
  const max = cents(Math.max(200_000, Math.ceil(peak / 200_000) * 200_000));
  const current = months[selected]!;
  const height = (v: number) => ({ height: `${(v / max) * 100}%` });

  return (
    <Card aria-labelledby="flows-title" className="gap-4 p-4 lg:p-5">
      <CardTitle id="flows-title" className="text-md lg:text-lg">
        Cobros y pagos de los últimos 12 meses
      </CardTitle>
      <div aria-live="polite" className="flex min-h-[22px] flex-wrap items-baseline gap-x-[18px] gap-y-1.5 text-sm">
        <span className="font-semibold">
          {MONTHS[current.month]} {current.year}
        </span>
        {(
          [
            ["Cobros", current.collected, "bg-chart-income"],
            ["Pagos", current.paid, "bg-chart-expense"],
            ["Neto", cents(current.collected - current.paid), "bg-foreground"],
          ] as const
        ).map(([label, value, dot]) => (
          <span key={label} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("size-2 rounded-full", dot)} aria-hidden="true" />
            {label} <span className="amount text-foreground">{formatEUR(value)}</span>
          </span>
        ))}
      </div>
      <div className="flex gap-2.5">
        <div
          aria-hidden="true"
          className="-mt-1.5 mb-6 flex h-[200px] min-w-10 flex-col justify-between text-right text-2xs text-muted-foreground tabular-nums"
        >
          <span>{formatThousands(max)}</span>
          <span>{formatThousands(cents(max / 2))}</span>
          <span>0</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="relative h-[200px]">
            <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
              <div className="border-t border-dashed border-chart-grid" />
              <div className="border-t border-dashed border-chart-grid" />
              <div className="border-t border-chart-axis" />
            </div>
            <div className="absolute inset-0 flex items-end gap-1 sm:gap-1.5">
              {months.map((m, i) => (
                <button
                  key={`${m.year}-${m.month}`}
                  type="button"
                  aria-label={`${MONTHS[m.month]} ${m.year}: cobros ${formatEUR(m.collected)}, pagos ${formatEUR(m.paid)}`}
                  aria-pressed={i === selected}
                  onClick={() => setSelected(i)}
                  onMouseEnter={() => setSelected(i)}
                  onFocus={() => setSelected(i)}
                  className={cn(
                    "flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center gap-[2px] rounded-sm border-0 bg-transparent p-0 transition-colors duration-200 sm:gap-[3px]",
                    i === selected && "bg-chart-highlight",
                  )}
                >
                  <span
                    className={cn(barClass, "w-[38%] max-w-[18px] bg-chart-income")}
                    style={{ ...height(m.collected), "--i": i } as CSSProperties}
                  />
                  <span
                    className={cn(barClass, "w-[38%] max-w-[18px] bg-chart-expense")}
                    style={{ ...height(m.paid), "--i": i } as CSSProperties}
                  />
                </button>
              ))}
            </div>
          </div>
          <div aria-hidden="true" className="flex gap-1 sm:gap-1.5">
            {months.map((m, i) => (
              <span
                key={`${m.year}-${m.month}`}
                className={cn(
                  "min-w-0 flex-1 text-center text-2xs",
                  i === selected ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {MONTHS_SHORT[m.month]}
                {(m.month === 0 || i === 0) && <span className="hidden sm:inline"> {String(m.year).slice(2)}</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

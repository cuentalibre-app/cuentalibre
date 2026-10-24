import type { BillingPeriod } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { perMonth, PERIODS, savingOf } from "./billing-model";

/**
 * The three Cloud periods, with what each comes to per month: side by side, or one
 * row each where the column is too narrow for three (the welcome steps).
 */
export function PeriodPicker({
  value,
  onChange,
  rows = false,
}: {
  value: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
  rows?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Cada cuánto pagas" className={cn("grid gap-3", !rows && "sm:grid-cols-3")}>
      {PERIODS.map((option) => {
        const checked = option.value === value;
        const saving = savingOf(option);
        const charged = option.months === 1 ? "Se cobra cada mes" : `${formatEUR(option.price)} ${option.every}`;
        const price = (
          <span className={cn(rows && "shrink-0 text-right")}>
            <span className={cn("amount font-semibold tracking-tight", rows ? "text-lg" : "text-2xl")}>
              {formatEUR(perMonth(option))}
            </span>
            <span className="text-sm text-muted-foreground"> /mes</span>
          </span>
        );
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex rounded-lg border text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              rows ? "items-center justify-between gap-3 px-4 py-3" : "flex-col items-start gap-1 p-4",
              checked ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-accent",
            )}
          >
            {rows ? (
              <>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{option.label}</span>
                    {saving > 0 && <Badge tone="success">Ahorras un {saving} %</Badge>}
                  </span>
                  <span className="text-sm text-muted-foreground">{charged}</span>
                </span>
                {price}
              </>
            ) : (
              <>
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-semibold">{option.label}</span>
                  {saving > 0 && <Badge tone="success">Ahorras un {saving} %</Badge>}
                </span>
                {price}
                <span className="text-sm text-muted-foreground">{charged}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

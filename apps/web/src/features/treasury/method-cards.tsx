import { useState, type CSSProperties } from "react";
import { Plus, Settings } from "lucide-react";
import { monthlyFlows, sumBy } from "@cuentalibre/core";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { METHOD_ICONS } from "@/features/settings/method-icons";
import { MethodDialog } from "@/features/settings/method-dialog";
import { SettingsLink } from "@/features/settings/settings-parts";
import {
  PAYMENT_METHODS_PATH,
  maskNumber,
  methodTypeLabel,
  usePaymentMethods,
} from "@/features/settings/settings-model";
import { formatDate } from "@/lib/format";
import type { TreasuryPayment } from "./treasury-model";

/**
 * The active payment methods at a glance, with what went through each over the last year.
 * Picking one filters the list below by it; picking it again clears the filter.
 */
export function MethodCards({
  payments,
  today,
  selected,
  onSelect,
}: {
  payments: TreasuryPayment[];
  today: Date;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [creating, setCreating] = useState(false);
  // The default first, as in settings
  const active = usePaymentMethods().filter((m) => m.active);

  return (
    <section aria-labelledby="methods-title" className="flex flex-col gap-3">
      <h2 id="methods-title" className="m-0 text-md font-semibold">
        Cuentas y formas de pago
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {active.map((m, i) => {
          const Icon = METHOD_ICONS[m.type];
          const own = payments.filter((p) => p.paymentMethodId === m.id);
          const months = monthlyFlows(own, today);
          const collected = sumBy(months, (x) => x.collected);
          const paid = sumBy(months, (x) => x.paid);
          const last = own[0];
          const pressed = selected === m.id;
          return (
            <li key={m.id} className="animate-rise-in" style={{ "--i": i } as CSSProperties}>
              <button
                type="button"
                aria-pressed={pressed}
                onClick={() => onSelect(pressed ? null : m.id)}
                className={cn(
                  "flex h-full w-full cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 text-left text-foreground transition-[border-color,box-shadow] duration-150 hover:shadow-sm",
                  pressed ? "border-primary" : "border-border hover:border-muted-strong",
                )}
              >
                <span className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{m.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {m.number ? <span className="font-mono">{maskNumber(m.number)}</span> : methodTypeLabel(m.type)}
                    </span>
                  </span>
                </span>
                <span className="grid grid-cols-2 gap-3">
                  <span className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Cobrado · 12 meses</span>
                    <span className={cn("amount font-semibold", collected > 0 && "text-success")}>
                      {formatEUR(collected)}
                    </span>
                  </span>
                  <span className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Pagado · 12 meses</span>
                    <span className="amount font-semibold">{formatEUR(paid)}</span>
                  </span>
                </span>
                <span className="mt-auto text-xs text-muted-foreground">
                  {last ? `Último cobro o pago ${formatDate(last.date)}` : "Sin cobros ni pagos"}
                </span>
              </button>
            </li>
          );
        })}
        <li
          className="grid min-h-28 animate-rise-in grid-rows-2 gap-3"
          style={{ "--i": active.length } as CSSProperties}
        >
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-input bg-transparent px-4 text-left font-medium text-foreground transition-colors duration-150 hover:bg-accent"
          >
            <Plus className="size-[18px] text-muted-foreground" strokeWidth={2} aria-hidden="true" />
            Nueva forma de pago
          </button>
          <SettingsLink
            from="Bancos"
            to={PAYMENT_METHODS_PATH}
            className="flex items-center gap-3 rounded-xl border border-border px-4 font-medium text-foreground no-underline transition-colors duration-150 hover:bg-accent"
          >
            <Settings className="size-[18px] text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            Configurar formas de pago
          </SettingsLink>
        </li>
      </ul>
      {creating && <MethodDialog open onOpenChange={setCreating} method={null} />}
    </section>
  );
}

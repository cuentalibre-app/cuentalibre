import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { formatPercent } from "@/lib/format";
import type { HomeData, InvoiceStatus } from "./home-data";

const STATUSES: { key: InvoiceStatus; label: string; bar: string; icon: typeof Clock; iconClass: string }[] = [
  { key: "paid", label: "Cobrado", bar: "bg-success", icon: CircleCheck, iconClass: "text-success" },
  { key: "pending", label: "Pendiente", bar: "bg-muted-strong", icon: Clock, iconClass: "text-muted-foreground" },
  { key: "overdue", label: "Vencido", bar: "bg-destructive", icon: CircleAlert, iconClass: "text-destructive" },
];

const invoiceCount = (n: number) => (n === 1 ? "1 factura" : `${n} facturas`);

/** How much of the period's invoicing has been collected, is pending or overdue (totals with VAT). */
export function CollectionSummary({ data, className }: { data: HomeData; className?: string }) {
  const { byStatus, total, count } = data.collection;
  const share = (v: number) => (total ? (v / total) * 100 : 0);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="m-0 text-base font-semibold">Cobro del periodo</h3>
        <span className="text-sm text-muted-foreground">
          {invoiceCount(count)} · <span className="amount">{formatEUR(total)}</span> con IVA
        </span>
      </div>

      {count === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No hay facturas emitidas en este periodo.</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="amount shrink-0 text-lg font-medium">{formatPercent(share(byStatus.paid.amount))}</span>
            <div
              role="img"
              aria-label={STATUSES.map((s) => `${s.label}: ${formatEUR(byStatus[s.key].amount)}`).join(", ")}
              className="flex h-2.5 flex-1 animate-reveal-x gap-0.5 overflow-hidden rounded-xs bg-muted"
            >
              {STATUSES.map((s) => (
                <div
                  key={s.key}
                  className={cn("transition-[width] duration-500 ease-out", s.bar)}
                  style={{ width: `${share(byStatus[s.key].amount)}%` }}
                />
              ))}
            </div>
          </div>

          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-3 sm:gap-4">
            {STATUSES.map(({ key, label, icon: Icon, iconClass }) => (
              <li key={key} className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-0.5">
                <span className="flex flex-1 items-center gap-1.5 text-sm">
                  <Icon className={cn("size-4 shrink-0", iconClass)} strokeWidth={2} aria-hidden="true" />
                  {label}
                  <span className="text-muted-foreground">· {byStatus[key].count}</span>
                </span>
                <span className="amount">{formatEUR(byStatus[key].amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

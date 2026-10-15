import { Link } from "react-router";
import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import { Card, CardTitle } from "@fiscalia/ui/components/card";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { formatPercent } from "@/lib/format";
import type { HomeData, InvoiceStatus } from "./home-data";

const STATUSES: { key: InvoiceStatus; label: string; bar: string; icon: typeof Clock; iconClass: string }[] = [
  { key: "paid", label: "Cobrado", bar: "bg-success", icon: CircleCheck, iconClass: "text-success" },
  { key: "pending", label: "Pendiente", bar: "bg-muted-strong", icon: Clock, iconClass: "text-muted-foreground" },
  { key: "overdue", label: "Vencido", bar: "bg-destructive", icon: CircleAlert, iconClass: "text-destructive" },
];

const invoiceCount = (n: number) => (n === 1 ? "1 factura" : `${n} facturas`);

/** How much of the period's invoicing has been collected, is pending or overdue (totals with VAT). */
export function CollectionCard({ data, className }: { data: HomeData; className?: string }) {
  const { byStatus, total, count } = data.collection;
  const share = (v: number) => (total ? (v / total) * 100 : 0);

  return (
    <Card aria-labelledby="collection-title" className={cn("gap-3 p-4 lg:gap-3 lg:p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <CardTitle id="collection-title" className="text-md lg:text-lg">
            Estado de cobro
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {invoiceCount(count)} · <span className="amount">{formatEUR(total)}</span> con IVA
          </span>
        </div>
        <Link to="/ventas/facturas" className="shrink-0 font-medium text-primary no-underline hover:text-primary-hover">
          Ver facturas
        </Link>
      </div>

      {count === 0 ? (
        <p className="m-0 py-6 text-center text-sm text-muted-foreground">No hay facturas emitidas en este periodo.</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="amount text-2xl font-medium">{formatPercent(share(byStatus.paid.amount))}</span>
            <span className="text-sm text-muted-foreground">de lo facturado ya está cobrado</span>
          </div>

          <div
            role="img"
            aria-label={STATUSES.map((s) => `${s.label}: ${formatEUR(byStatus[s.key].amount)}`).join(", ")}
            className="flex h-3 animate-reveal-x gap-0.5 overflow-hidden rounded-xs bg-muted"
          >
            {STATUSES.map((s) => (
              <div
                key={s.key}
                className={cn("transition-[width] duration-500 ease-out", s.bar)}
                style={{ width: `${share(byStatus[s.key].amount)}%` }}
              />
            ))}
          </div>

          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {STATUSES.map(({ key, label, icon: Icon, iconClass }) => (
              <li key={key} className="flex items-center gap-2.5">
                <Icon className={cn("size-4 shrink-0", iconClass)} strokeWidth={2} aria-hidden="true" />
                <span className="flex-1">
                  {label} <span className="text-sm text-muted-foreground">· {invoiceCount(byStatus[key].count)}</span>
                </span>
                <span className="amount">{formatEUR(byStatus[key].amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

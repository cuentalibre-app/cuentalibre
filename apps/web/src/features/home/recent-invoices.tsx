import { Link } from "react-router";
import { Badge, type BadgeProps } from "@fiscalia/ui/components/badge";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import type { InvoiceStatus } from "@/mocks/data";
import { formatDate, formatShortDate } from "@/lib/format";
import type { HomeData } from "./home-data";

const STATUS: Record<InvoiceStatus, { label: string; tone: BadgeProps["tone"] }> = {
  paid: { label: "Cobrada", tone: "success" },
  pending: { label: "Pendiente", tone: "neutral" },
  overdue: { label: "Vencida", tone: "danger" },
};

const headers = ["Nº", "Cliente", "Fecha", "Total", "Estado"];

export function RecentInvoices({ data, className }: { data: HomeData; className?: string }) {
  return (
    <section
      aria-labelledby="recent-invoices-title"
      className={cn("flex flex-col lg:overflow-hidden lg:rounded-xl lg:border lg:border-border", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1.5 lg:items-center lg:px-5 lg:py-[18px]">
        <h2 id="recent-invoices-title" className="m-0 text-md font-semibold lg:text-lg">
          <span className="lg:hidden">Últimas facturas</span>
          <span className="hidden lg:inline">Últimas facturas emitidas</span>
        </h2>
        <Link to="/ventas/facturas" className="font-medium text-primary no-underline hover:text-primary-hover">
          Ver todas
        </Link>
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              {headers.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className={cn("border-y border-border px-5 py-2.5 font-medium", h === "Total" && "text-right")}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.invoices.map((inv) => (
              <tr key={inv.number} className="border-b border-divider transition-colors duration-150 last:border-b-0 hover:bg-muted">
                <td className="px-5 py-3.5 font-mono text-sm">{inv.number}</td>
                <td className="px-5 py-3.5 font-medium">{inv.client}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{formatDate(inv.issuedOn)}</td>
                <td className="amount px-5 py-3.5 text-right">{formatEUR(inv.total)}</td>
                <td className="px-5 py-3.5">
                  <Badge tone={STATUS[inv.status].tone}>{STATUS[inv.status].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pinned to the bottom so the card can stretch to match the tax calendar beside it */}
      <div className="mt-auto hidden items-center justify-between gap-3 border-t border-border bg-muted px-5 py-3.5 text-sm lg:flex">
        <span className="text-muted-foreground">Pendiente de cobro</span>
        <span className="amount font-semibold">{formatEUR(data.pendingCollection)}</span>
      </div>

      {/* Mobile: list */}
      <ul className="m-0 flex list-none flex-col p-0 lg:hidden">
        {data.invoices.slice(0, 3).map((inv) => (
          <li key={inv.number}>
            <Link
              to="/ventas/facturas"
              className="flex min-h-11 items-center gap-3 border-b border-divider py-3 text-foreground no-underline transition-opacity duration-150 active:opacity-60"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{inv.client}</span>
                <span className="text-sm text-muted-foreground">
                  {inv.number} · {formatShortDate(inv.issuedOn)}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="amount text-base">{formatEUR(inv.total)}</span>
                <Badge tone={STATUS[inv.status].tone}>{STATUS[inv.status].label}</Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

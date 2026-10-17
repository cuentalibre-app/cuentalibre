import { Link } from "react-router";
import { Badge, type BadgeProps } from "@fiscalia/ui/components/badge";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { table } from "@fiscalia/ui/lib/table";
import { formatDate, formatShortDate } from "@/lib/format";
import { CollectionSummary } from "./collection-summary";
import type { HomeData, InvoiceStatus } from "./home-data";

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
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1.5 lg:items-center lg:px-4 lg:py-3">
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
            <tr className={table.headRow}>
              {headers.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(table.th, h === "Total" && "text-right")}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.invoices.map((inv) => (
              <tr key={inv.id} className={table.row}>
                <td className={cn(table.td, "font-mono text-sm")}>
                  <Link to={`/ventas/facturas/${inv.id}`} className="text-foreground no-underline hover:text-primary">
                    {inv.number}
                  </Link>
                </td>
                <td className={cn(table.td, "font-medium")}>{inv.client}</td>
                <td className={cn(table.td, "text-muted-foreground")}>{formatDate(inv.issuedOn)}</td>
                <td className={cn(table.td, "amount text-right")}>{formatEUR(inv.total)}</td>
                <td className={table.td}>
                  <Badge tone={STATUS[inv.status].tone}>{STATUS[inv.status].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: list */}
      <ul className="m-0 flex list-none flex-col p-0 lg:hidden">
        {data.invoices.slice(0, 3).map((inv) => (
          <li key={inv.id}>
            <Link
              to={`/ventas/facturas/${inv.id}`}
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

      {/* Pinned to the bottom so the card can stretch to match the tax calendar beside it */}
      <CollectionSummary
        data={data}
        className="mt-4 lg:mt-auto lg:border-t lg:border-border lg:bg-muted/40 lg:px-4 lg:py-3.5"
      />
    </section>
  );
}

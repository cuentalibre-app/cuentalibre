import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ReceiptText } from "lucide-react";
import { Badge, type BadgeProps } from "@cuentalibre/ui/components/badge";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { formatDate, formatShortDate } from "@/lib/format";
import { cardHeaderClass, cardIconClass, cardTitleClass, ListGroup, listRowClass, SeeAllLink } from "@/components/page";
import { CollectionSummary } from "./collection-summary";
import type { HomeData, InvoiceStatus } from "./home-data";

const STATUS: Record<InvoiceStatus, BadgeProps["tone"]> = {
  paid: "success",
  pending: "primary",
  overdue: "danger",
};

const headers = ["number", "client", "date", "total", "status"] as const;

export function RecentInvoices({ data, className }: { data: HomeData; className?: string }) {
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby="recent-invoices-title"
      className={cn("flex flex-col lg:overflow-hidden lg:surface", className)}
    >
      <div className={cn("flex items-baseline justify-between gap-3 pb-2.5", cardHeaderClass)}>
        <h2 id="recent-invoices-title" className={cardTitleClass}>
          <ReceiptText className={cardIconClass} strokeWidth={1.8} aria-hidden="true" />
          <span className="lg:hidden">{t("home.invoices.mobileTitle")}</span>
          <span className="hidden lg:inline">{t("home.invoices.title")}</span>
        </h2>
        <SeeAllLink to="/ventas/facturas">{t("home.invoices.seeAll")}</SeeAllLink>
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className={table.headRow}>
              {headers.map((h) => (
                <th key={h} scope="col" className={cn(table.th, h === "total" && "text-right")}>
                  {t(`home.invoices.columns.${h}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.invoices.map((inv) => (
              <tr key={inv.id} className={table.row}>
                <td className={cn(table.td, "amount")}>
                  <Link to={`/ventas/facturas/${inv.id}`} className="text-foreground no-underline hover:text-primary">
                    {inv.number}
                  </Link>
                </td>
                <td className={cn(table.td, "font-medium")}>{inv.client}</td>
                <td className={cn(table.td, "text-muted-foreground")}>{formatDate(inv.issuedOn)}</td>
                <td className={cn(table.td, "text-right amount")}>{formatEUR(inv.total)}</td>
                <td className={table.td}>
                  <Badge tone={STATUS[inv.status]}>
                    <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                    {t(`home.invoices.status.${inv.status}`)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: list */}
      <ListGroup className="lg:hidden">
        {data.invoices.slice(0, 3).map((inv) => (
          <li key={inv.id}>
            <Link to={`/ventas/facturas/${inv.id}`} className={listRowClass}>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{inv.client}</span>
                <span className="text-sm text-muted-foreground">
                  {inv.number} · {formatShortDate(inv.issuedOn)}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="amount text-base">{formatEUR(inv.total)}</span>
                <Badge tone={STATUS[inv.status]}>{t(`home.invoices.status.${inv.status}`)}</Badge>
              </div>
            </Link>
          </li>
        ))}
      </ListGroup>

      {/* Pinned to the bottom so the card can stretch to match the tax calendar beside it */}
      <CollectionSummary
        data={data}
        className="hidden lg:mt-auto lg:flex lg:border-t lg:border-divider lg:px-4 lg:py-3"
      />
    </section>
  );
}

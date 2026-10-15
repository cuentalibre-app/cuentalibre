import { useMemo, type CSSProperties } from "react";
import { Link } from "react-router";
import { Bell, Camera, Plus, Search } from "lucide-react";
import { periodKey } from "@fiscalia/core";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import { cn } from "@fiscalia/ui/lib/cn";
import { availableYears } from "@/mocks/data";
import { periodRange } from "@/lib/format";
import { CashFlowChart, ProfitChart } from "./charts";
import { CollectionCard } from "./collection-card";
import { buildHomeData } from "./home-data";
import { KpiGrid } from "./kpi-grid";
import { PeriodSelect } from "@/components/period-select";
import { RecentInvoices } from "./recent-invoices";
import { TakeHomeCard } from "./take-home-card";
import { TaxCalendar } from "./tax-calendar";
import { dependencyWarning, TopCounterparties } from "./top-counterparties";
import { usePeriod } from "@/lib/use-period";
import { useSalesDocuments } from "@/features/sales/sales-store";

// On desktop the dashboard is a single sheet: panels share 1px rules instead of floating as
// separate cards. The rules are the sheet's background showing through 1px gaps, so rows don't
// fade in individually (that would flash the rule color); the page transition covers them.
const sheet =
  "flex flex-col gap-5 lg:gap-px lg:overflow-hidden lg:rounded-xl lg:border lg:border-border lg:bg-border";
const row =
  "flex animate-rise-in flex-col gap-5 lg:animate-none lg:flex-row lg:flex-wrap lg:items-stretch lg:gap-px";
const panel = "lg:rounded-none lg:border-0 lg:bg-card";

export function HomePage() {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const documents = useSalesDocuments();
  const data = useMemo(() => buildHomeData(period, today, documents), [period, today, documents]);
  // Charts keep their own selection; remount them when the period changes
  const chartKey = periodKey(period);

  const periodSelect = (className?: string) => (
    <PeriodSelect
      value={period}
      onChange={setPeriod}
      years={availableYears}
      today={today}
      className={className}
    />
  );

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 lg:gap-4 lg:px-8 lg:pt-6 lg:pb-8">
      {/* Mobile header */}
      <header className="flex flex-col gap-5 lg:hidden">
        <div className="flex items-center justify-between">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Inicio</h1>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Avisos"
            className="border-border"
          >
            <Bell strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {periodSelect("h-12 flex-1")}
          <span className="text-sm text-muted-foreground">
            {periodRange(period)}
          </span>
        </div>
      </header>

      {/* Desktop header */}
      <header className="hidden flex-wrap items-end justify-between gap-4 lg:flex">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="m-0 text-3xl font-semibold tracking-tight">Inicio</h1>
          {periodSelect()}
          <span className="text-sm text-muted-foreground">
            {periodRange(period)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <div className="flex h-10 min-w-[220px] items-center gap-2 rounded-lg border border-border px-3.5 text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
            <Search
              className="size-[18px] shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Buscar factura, cliente, NIF…"
              aria-label="Buscar"
              className="min-w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Link
            to="/compras/gastos/nuevo"
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "no-underline",
            )}
          >
            <Camera strokeWidth={1.8} aria-hidden="true" />
            Subir gasto
          </Link>
          <Link
            to="/ventas/facturas/nueva"
            className={cn(buttonVariants(), "no-underline")}
          >
            <Plus strokeWidth={2} aria-hidden="true" />
            Nueva factura
          </Link>
        </div>
      </header>

      <div className={sheet}>
        <KpiGrid data={data} />

        <div className={row} style={{ "--i": 4 } as CSSProperties}>
          <CashFlowChart
            key={`cash-${chartKey}`}
            data={data}
            className={cn(panel, "hidden min-w-0 lg:flex lg:flex-[2_1_560px]")}
          />
          <ProfitChart
            key={`profit-${chartKey}`}
            data={data}
            className="lg:hidden"
          />
          <TakeHomeCard
            data={data}
            className={cn(panel, "min-w-0 lg:flex-[1_1_320px]")}
          />
        </div>

        {/* Mobile quick actions */}
        <div
          className="grid animate-rise-in grid-cols-2 gap-2.5 lg:hidden"
          style={{ "--i": 5 } as CSSProperties}
        >
          <Link
            to="/ventas/facturas/nueva"
            className={cn(buttonVariants({ size: "xl" }), "no-underline")}
          >
            <Plus strokeWidth={2} aria-hidden="true" />
            Factura
          </Link>
          <Link
            to="/compras/gastos/nuevo"
            className={cn(
              buttonVariants({ variant: "secondary", size: "xl" }),
              "font-semibold no-underline",
            )}
          >
            <Camera strokeWidth={1.8} aria-hidden="true" />
            Foto gasto
          </Link>
        </div>

        <div className={row} style={{ "--i": 6 } as CSSProperties}>
          <RecentInvoices
            data={data}
            className={cn(
              panel,
              "order-2 min-w-0 lg:order-none lg:flex-[2_1_560px]",
            )}
          />
          <TaxCalendar
            data={data}
            className={cn(
              panel,
              "order-1 min-w-0 lg:order-none lg:flex-[1_1_320px]",
            )}
          />
        </div>

        <div className={row} style={{ "--i": 7 } as CSSProperties}>
          <TopCounterparties
            id="top-clients"
            title="Principales clientes"
            noun={data.clients.count === 1 ? "cliente" : "clientes"}
            ranking={data.clients}
            barClass="bg-chart-income"
            href="/contactos/clientes"
            empty="No hay ingresos en este periodo."
            warning={
              data.economicallyDependent
                ? dependencyWarning(data.clients)
                : undefined
            }
            className={cn(panel, "min-w-0 lg:flex-[1_1_320px]")}
          />
          <TopCounterparties
            id="top-suppliers"
            title="Principales proveedores"
            noun={data.suppliers.count === 1 ? "proveedor" : "proveedores"}
            ranking={data.suppliers}
            barClass="bg-chart-expense"
            href="/contactos/proveedores"
            empty="No hay gastos en este periodo."
            className={cn(panel, "min-w-0 lg:flex-[1_1_320px]")}
          />
          <CollectionCard
            data={data}
            className={cn(panel, "min-w-0 lg:flex-[1_1_320px]")}
          />
        </div>
      </div>
    </div>
  );
}

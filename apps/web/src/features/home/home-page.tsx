import { useMemo, type CSSProperties } from "react";
import { Link } from "react-router";
import { Camera, Plus } from "lucide-react";
import { periodKey } from "@cuentalibre/core";
import { buttonVariants } from "@cuentalibre/ui/components/button";
import { cn } from "@cuentalibre/ui/lib/cn";
import { availableYears } from "@/mocks/data";
import { periodRange } from "@/lib/format";
import { CashFlowChart, ProfitChart } from "./charts";
import { buildHomeData } from "./home-data";
import { KpiGrid } from "./kpi-grid";
import { Notifications } from "./notifications";
import { PeriodSelect } from "@/components/period-select";
import { UserMenu } from "@/components/layout/user-menu";
import { RecentInvoices } from "./recent-invoices";
import { TakeHomeCard } from "./take-home-card";
import { TaxCalendar } from "./tax-calendar";
import { dependencyWarning, TopCounterparties } from "./top-counterparties";
import { usePeriod } from "@/lib/use-period";
import { useExpenses } from "@/features/purchases/expenses-store";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { useSalesDocuments } from "@/features/sales/sales-store";

// On desktop the dashboard is a single sheet: panels share 1px rules instead of floating as
// separate cards. The rules are the sheet's background showing through 1px gaps, so rows don't
// fade in individually (that would flash the rule color); the page transition covers them.
const sheet = "flex flex-col gap-5 lg:gap-px lg:overflow-hidden lg:rounded-xl lg:border lg:border-border lg:bg-border";
const row = "flex animate-rise-in flex-col gap-5 lg:animate-none lg:flex-row lg:flex-wrap lg:items-stretch lg:gap-px";
const panel = "lg:rounded-none lg:border-0 lg:bg-card";

export function HomePage() {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  const data = useMemo(
    () => buildHomeData(period, today, documents, purchases, expenses),
    [period, today, documents, purchases, expenses],
  );
  // Charts keep their own selection; remount them when the period changes
  const chartKey = periodKey(period);

  const periodSelect = (className?: string) => (
    <PeriodSelect value={period} onChange={setPeriod} years={availableYears} today={today} className={className} />
  );

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 lg:gap-4 lg:px-8 lg:pt-6 lg:pb-8">
      {/* Mobile header */}
      <header className="flex flex-col gap-5 lg:hidden">
        <div className="flex items-center justify-between">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Inicio</h1>
          <div className="flex items-center gap-2.5">
            <Notifications />
            <UserMenu />
          </div>
        </div>
        {periodSelect("h-12 w-full")}
      </header>

      {/* Desktop header */}
      <header className="hidden flex-wrap items-end justify-between gap-4 lg:flex">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="m-0 text-3xl font-semibold tracking-tight">Inicio</h1>
          {periodSelect()}
          <span className="text-sm text-muted-foreground">{periodRange(period)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/compras/gastos/nuevo" className={cn(buttonVariants({ variant: "secondary" }), "no-underline")}>
            <Camera strokeWidth={1.8} aria-hidden="true" />
            Subir gasto
          </Link>
          <Link to="/ventas/facturas/nueva" className={cn(buttonVariants(), "no-underline")}>
            <Plus strokeWidth={2} aria-hidden="true" />
            Nueva factura
          </Link>
          <div className="ml-2 flex items-center gap-2.5 border-l border-divider pl-4">
            <Notifications />
            <UserMenu />
          </div>
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
          <ProfitChart key={`profit-${chartKey}`} data={data} className="lg:hidden" />
          <TakeHomeCard data={data} className={cn(panel, "min-w-0 lg:flex-[1_1_320px]")} />
        </div>

        {/* Mobile quick actions */}
        <div className="grid animate-rise-in grid-cols-2 gap-2.5 lg:hidden" style={{ "--i": 5 } as CSSProperties}>
          <Link to="/ventas/facturas/nueva" className={cn(buttonVariants({ size: "xl" }), "no-underline")}>
            <Plus strokeWidth={2} aria-hidden="true" />
            Factura
          </Link>
          <Link
            to="/compras/gastos/nuevo"
            className={cn(buttonVariants({ variant: "secondary", size: "xl" }), "font-semibold no-underline")}
          >
            <Camera strokeWidth={1.8} aria-hidden="true" />
            Foto gasto
          </Link>
        </div>

        <div className={row} style={{ "--i": 6 } as CSSProperties}>
          <RecentInvoices data={data} className={cn(panel, "order-2 min-w-0 lg:order-none lg:flex-[2_1_560px]")} />
          <TaxCalendar
            data={data}
            today={today}
            className={cn(panel, "order-1 min-w-0 lg:order-none lg:flex-[1_1_320px]")}
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
            warning={data.economicallyDependent ? dependencyWarning(data.clients) : undefined}
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
        </div>
      </div>
    </div>
  );
}

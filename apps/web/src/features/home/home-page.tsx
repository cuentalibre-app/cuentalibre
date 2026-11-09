import { useMemo, type CSSProperties } from "react";
import { Link } from "react-router";
import { Camera, Plus } from "lucide-react";
import { periodKey } from "@cuentalibre/core";
import { buttonVariants } from "@cuentalibre/ui/components/button";
import { cn } from "@cuentalibre/ui/lib/cn";
import { availableYears } from "@/mocks/data";
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

// Panels are separate cards with room between them; rows rise in one after another.
const sheet = "flex flex-col gap-5 lg:gap-5";
const row = "flex animate-rise-in flex-col gap-5 lg:flex-row lg:flex-wrap lg:items-stretch";
const panel = "lg:p-5";

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
    <div className="flex flex-col gap-5 px-5 pt-6 lg:gap-6 lg:px-10 lg:pt-8 lg:pb-10">
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
          <RecentInvoices data={data} className={cn("order-2 min-w-0 lg:order-none lg:flex-[2_1_560px]")} />
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

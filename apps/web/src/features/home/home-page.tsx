import { useMemo, type CSSProperties } from "react";
import { Link } from "react-router";
import { Camera, Plus, Store, Users } from "lucide-react";
import { periodKey, previousPeriod } from "@cuentalibre/core";
import { buttonVariants } from "@cuentalibre/ui/components/button";
import { useAvailableYears } from "@/lib/use-available-years";
import { CashFlowChart } from "./charts";
import { buildHomeData } from "./home-data";
import { KpiGrid, taxReserve } from "./kpi-grid";
import { MobileOverview } from "./mobile-overview";
import { Notifications } from "./notifications";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { HelpTip, Page, PageHeader } from "@/components/page";
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
import { useSettings } from "@/features/settings/settings-store";

// Panels are separate cards with room between them; rows rise in one after another.
const sheet = "@container flex flex-col gap-5 lg:gap-3";
const row = "flex animate-rise-in flex-col gap-5 lg:flex-row lg:flex-wrap lg:items-stretch lg:gap-3";

export function HomePage() {
  const availableYears = useAvailableYears();
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  // Read inside through the store; listed so the estimate follows a change of fee
  const fee = useSettings().tax.socialSecurityFee;
  const data = useMemo(
    () => buildHomeData(period, today, documents, purchases, expenses),
    [period, today, documents, purchases, expenses, fee],
  );
  // The previous period, to see how the tax reserve moved
  const previousData = useMemo(
    () => buildHomeData(previousPeriod(period), today, documents, purchases, expenses),
    [period, today, documents, purchases, expenses, fee],
  );
  const reserve = taxReserve(data, previousData);
  // Charts keep their own selection; remount them when the period changes
  const chartKey = periodKey(period);

  const periodSelect = (className?: string) => (
    <PeriodSelect value={period} onChange={setPeriod} years={availableYears} today={today} className={className} />
  );

  return (
    <Page>
      {/* Mobile: round shortcuts on the right, then the period's profit and its line through the year */}
      <div className="flex flex-col gap-4 lg:hidden">
        <MobileOverview
          data={data}
          period={period}
          onPeriodChange={setPeriod}
          years={availableYears}
          today={today}
          actions={
            <>
              <Notifications className="size-11 rounded-full border-glass-edge bg-glass backdrop-blur-xl hover:bg-glass" />
              <UserMenu className="size-11" />
            </>
          }
        />
      </div>

      {/* Desktop header */}
      <PageHeader
        className="hidden lg:flex"
        title="Inicio"
        inline={
          <>
            <TooltipProvider delayDuration={300}>
              <HelpTip side="bottom">
                Cómo va tu negocio en el periodo: lo facturado, lo gastado y lo que apartar para impuestos.
              </HelpTip>
            </TooltipProvider>
            {periodSelect()}
          </>
        }
        actions={
          <>
            <Link to="/compras/gastos/nuevo" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <Camera strokeWidth={1.8} aria-hidden="true" />
              Subir gasto
            </Link>
            <Link to="/ventas/facturas/nueva" className={buttonVariants({ variant: "primary", size: "sm" })}>
              <Plus strokeWidth={2} aria-hidden="true" />
              Nueva factura
            </Link>
            <div className="ml-1 flex items-center gap-2 border-l border-divider pl-3">
              <Notifications className="size-8" />
              <UserMenu className="size-8" />
            </div>
          </>
        }
      />

      <div className={sheet}>
        <KpiGrid data={data} reserve={reserve} className="hidden lg:grid" />

        <div className={row} style={{ "--i": 4 } as CSSProperties}>
          <CashFlowChart key={`cash-${chartKey}`} data={data} className="hidden min-w-0 lg:flex lg:flex-[2_1_560px]" />
          {/* On phones it sits right under the chart, in the overview */}
          <TakeHomeCard data={data} className="min-w-0 max-lg:hidden lg:flex-[1_1_320px]" />
        </div>

        <div className={row} style={{ "--i": 6 } as CSSProperties}>
          <RecentInvoices data={data} className="order-2 min-w-0 lg:order-none lg:flex-[2_1_560px]" />
          <TaxCalendar data={data} today={today} className="order-1 min-w-0 lg:order-none lg:flex-[1_1_320px]" />
        </div>

        <div className={row} style={{ "--i": 7 } as CSSProperties}>
          <TopCounterparties
            id="top-clients"
            title="Principales clientes"
            icon={Users}
            ranking={data.clients}
            barClass="bg-chart-income"
            href="/contactos/clientes"
            empty="No hay ingresos en este periodo."
            warning={data.economicallyDependent ? dependencyWarning(data.clients) : undefined}
            className="min-w-0 lg:flex-[1_1_320px]"
          />
          <TopCounterparties
            id="top-suppliers"
            title="Principales proveedores"
            icon={Store}
            ranking={data.suppliers}
            barClass="bg-chart-expense"
            href="/contactos/proveedores"
            empty="No hay gastos en este periodo."
            className="min-w-0 lg:flex-[1_1_320px]"
          />
        </div>
      </div>
    </Page>
  );
}

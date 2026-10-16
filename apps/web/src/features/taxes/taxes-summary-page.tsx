import { useMemo, type CSSProperties } from "react";
import { Link } from "react-router";
import { ArrowRight, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import {
  daysUntil,
  filingDeadline,
  filingStatus,
  incomeTaxYear,
  toIsoDate,
  upcomingDeadlines,
  vatReturns,
  type Quarter,
} from "@fiscalia/core";
import { Badge } from "@fiscalia/ui/components/badge";
import { buttonVariants } from "@fiscalia/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@fiscalia/ui/components/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { table } from "@fiscalia/ui/lib/table";
import { useExpenses } from "@/features/purchases/expenses-store";
import { purchaseTotals } from "@/features/purchases/purchases-model";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { useSalesDocuments } from "@/features/sales/sales-store";
import { daysLeftLabel, deadlineTitle, formatDate, MONTHS_SHORT, periodRange } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { availableYears } from "@/mocks/data";
import { TAX_OPTIONS, useTaxBooks } from "./tax-books";
import { FILING_STATUS, INCOME_TAX_PATH, modelPath, quarterOf, VAT_PATH } from "./taxes-model";

const QUARTERS = [1, 2, 3, 4] as const;

/** "A compensar" for a negative 303, which is carried forward rather than paid. */
function VatAmount({ amount }: { amount: number }) {
  if (amount >= 0) return <span className={cn("amount", amount === 0 && "text-muted-foreground")}>{formatEUR(amount)}</span>;
  return (
    <span className="flex flex-col items-end">
      <span className="amount text-success">{formatEUR(amount)}</span>
      <span className="text-2xs text-muted-foreground">a compensar</span>
    </span>
  );
}

function useYearReturns(year: number) {
  const books = useTaxBooks();
  return useMemo(() => {
    return { vat: vatReturns(books, year), income: incomeTaxYear(books, year, TAX_OPTIONS) };
  }, [books, year]);
}

/** Other forms Fiscalia doesn't prepare yet, and whether the books suggest they apply. */
function useOtherForms(year: number) {
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  return useMemo(() => {
    const inYear = (date: string) => date.startsWith(String(year));
    const yearPurchases = purchases.filter((p) => inYear(p.bookedOn));
    const withholdings = yearPurchases.some((p) => !p.rental && purchaseTotals(p).withholding !== 0);
    const rentals = yearPurchases.some((p) => p.rental) || expenses.some((e) => inYear(e.date) && e.rental);
    const intraEu =
      documents.some((d) => d.kind === "invoice" && inYear(d.issuedOn) && d.operationType === "intraEu") ||
      yearPurchases.some((p) => p.operationType === "intraEu");
    return [
      {
        codes: "111 · 190",
        title: "Retenciones de facturas recibidas",
        detail: "Si pagas a profesionales que te aplican retención.",
        applies: withholdings,
      },
      {
        codes: "115 · 180",
        title: "Retenciones de alquileres",
        detail: "Si alquilas un local u oficina para tu actividad.",
        applies: rentals,
      },
      {
        codes: "347",
        title: "Operaciones con terceras personas",
        detail: "Clientes y proveedores con más de 3.005,06 € al año.",
        applies: false,
      },
      {
        codes: "349",
        title: "Operaciones intracomunitarias",
        detail: "Ventas y compras a empresas de otros países de la UE.",
        applies: intraEu,
      },
    ];
  }, [documents, purchases, expenses, year]);
}

function NextFiling({ today }: { today: Date }) {
  const books = useTaxBooks();
  const next = upcomingDeadlines(today, 10).filter((d) => d.kind !== "social-security");
  const first = next[0];
  const sameDay = first ? next.filter((d) => d.date.getTime() === first.date.getTime()) : [];
  if (!first) return null;
  const items = sameDay.map((d) => {
    const quarter = d.quarter;
    if (d.kind === "vat-303" && quarter) {
      return { d, amount: vatReturns(books, d.year)[quarter - 1]!.result, to: modelPath(VAT_PATH, d) };
    }
    if (d.kind === "irpf-130" && quarter) {
      const result = incomeTaxYear(books, d.year, TAX_OPTIONS).quarters[quarter - 1]!.result;
      return { d, amount: Math.max(0, result), to: modelPath(INCOME_TAX_PATH, d) };
    }
    return { d, amount: null, to: modelPath(VAT_PATH, { year: d.year, quarter: null }) };
  });
  const days = daysUntil(today, first.date);

  return (
    <section
      aria-label="Próxima presentación"
      className="flex animate-rise-in flex-col gap-4 rounded-xl border border-border bg-card p-5 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex items-center gap-4">
        <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-warning-soft py-1.5 text-warning">
          <span className="text-xl font-semibold">{first.date.getDate()}</span>
          <span className="text-2xs uppercase">{MONTHS_SHORT[first.date.getMonth()]}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-muted-foreground">Próxima presentación</span>
          <span className="font-semibold">{sameDay.map(deadlineTitle).join(" y ")}</span>
          <span className="text-xs font-semibold text-warning">{daysLeftLabel(days)}</span>
        </div>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 lg:flex-row lg:gap-3">
        {items.map(({ d, amount, to }) => (
          <li key={d.kind}>
            <Link
              to={to}
              className="flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-2.5 text-foreground no-underline transition-[background-color,scale] duration-150 hover:bg-accent active:scale-[0.98] lg:min-w-56"
            >
              <span className="flex flex-col">
                <span className="text-xs text-muted-foreground">{deadlineTitle(d).split(" · ")[0]}</span>
                {amount === null ? (
                  <span className="text-sm text-muted-foreground">Informativo</span>
                ) : (
                  <VatAmount amount={amount} />
                )}
              </span>
              <ArrowRight className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuarterStatus({ year, quarter, today }: { year: number; quarter: Quarter | null; today: Date }) {
  const status = FILING_STATUS[filingStatus(year, quarter, today)];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>
          <Badge tone={status.tone}>{status.label}</Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent>{status.hint}</TooltipContent>
    </Tooltip>
  );
}

function QuartersTable({ year, today }: { year: number; today: Date }) {
  const { vat, income } = useYearReturns(year);
  const rows = QUARTERS.map((quarter) => {
    const v = vat[quarter - 1]!.result;
    const i = Math.max(0, income.quarters[quarter - 1]!.result);
    return { quarter, vat: v, irpf: i, total: Math.max(0, v) + i, deadline: filingDeadline(year, quarter) };
  });
  const totals = rows.reduce(
    (acc, r) => ({ vat: acc.vat + Math.max(0, r.vat), irpf: acc.irpf + r.irpf, total: acc.total + r.total }),
    { vat: 0, irpf: 0, total: 0 },
  );
  const th = cn(table.th, "px-3");
  const td = cn(table.td, "px-3");
  const linkClass = "inline-flex items-center gap-1 text-foreground no-underline hover:text-primary";

  return (
    <section
      aria-labelledby="quarters-title"
      className="flex animate-rise-in flex-col gap-3 lg:overflow-hidden lg:rounded-xl lg:border lg:border-border"
      style={{ "--i": 1 } as CSSProperties}
    >
      <div className="flex items-baseline justify-between lg:px-4 lg:pt-3">
        <h2 id="quarters-title" className="m-0 text-md font-semibold">
          Trimestres de {year}
        </h2>
        <span className="text-xs text-muted-foreground">Lo que sale a ingresar en cada presentación</span>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className={table.headRow}>
              <th scope="col" className={th}>Trimestre</th>
              <th scope="col" className={cn(th, "text-right")}>IVA · 303</th>
              <th scope="col" className={cn(th, "text-right")}>IRPF · 130</th>
              <th scope="col" className={cn(th, "text-right")}>Total a ingresar</th>
              <th scope="col" className={th}>Plazo</th>
              <th scope="col" className={th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.quarter} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
                <td className={td}>
                  <span className="font-medium">T{r.quarter}</span>{" "}
                  <span className="text-sm text-muted-foreground">{periodRange({ year, quarter: r.quarter })}</span>
                </td>
                <td className={cn(td, "text-right")}>
                  <Link to={modelPath(VAT_PATH, { year, quarter: r.quarter })} className={cn(linkClass, "justify-end")}>
                    <VatAmount amount={r.vat} />
                  </Link>
                </td>
                <td className={cn(td, "text-right")}>
                  <Link to={modelPath(INCOME_TAX_PATH, { year, quarter: r.quarter })} className={cn(linkClass, "justify-end")}>
                    <span className={cn("amount", r.irpf === 0 && "text-muted-foreground")}>{formatEUR(r.irpf)}</span>
                  </Link>
                </td>
                <td className={cn(td, "text-right amount font-semibold")}>{formatEUR(r.total)}</td>
                <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatDate(toIsoDate(r.deadline))}</td>
                <td className={td}>
                  <QuarterStatus year={year} quarter={r.quarter} today={today} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/50 font-semibold">
              <td className={td}>Total del año</td>
              <td className={cn(td, "text-right amount")}>{formatEUR(totals.vat)}</td>
              <td className={cn(td, "text-right amount")}>{formatEUR(totals.irpf)}</td>
              <td className={cn(td, "text-right amount")}>{formatEUR(totals.total)}</td>
              <td className={td} colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0 lg:hidden">
        {rows.map((r) => (
          <li key={r.quarter} className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <span>
                <span className="font-semibold">T{r.quarter}</span>{" "}
                <span className="text-sm text-muted-foreground">{periodRange({ year, quarter: r.quarter })}</span>
              </span>
              <QuarterStatus year={year} quarter={r.quarter} today={today} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to={modelPath(VAT_PATH, { year, quarter: r.quarter })}
                className="flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2 text-foreground no-underline active:scale-[0.98]"
              >
                <span className="text-xs text-muted-foreground">IVA · 303</span>
                <VatAmount amount={r.vat} />
              </Link>
              <Link
                to={modelPath(INCOME_TAX_PATH, { year, quarter: r.quarter })}
                className="flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2 text-foreground no-underline active:scale-[0.98]"
              >
                <span className="text-xs text-muted-foreground">IRPF · 130</span>
                <span className="amount">{formatEUR(r.irpf)}</span>
              </Link>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Plazo hasta el {formatDate(toIsoDate(r.deadline))}</span>
              <span className="amount font-semibold">{formatEUR(r.total)}</span>
            </div>
          </li>
        ))}
        <li className="flex justify-between px-1 pt-1 font-semibold">
          <span>Total del año</span>
          <span className="amount">{formatEUR(totals.total)}</span>
        </li>
      </ul>
    </section>
  );
}

function AnnualForms({ year, today }: { year: number; today: Date }) {
  const { vat, income } = useYearReturns(year);
  const vatPaid = vat.reduce((acc, q) => acc + Math.max(0, q.result), 0);
  const annual = income.annual;
  const prepaid = annual.boxes["0598"]! + annual.boxes["0599"]! + annual.boxes["0604"]!;
  const cards = [
    {
      code: "390",
      title: "Resumen anual de IVA",
      to: modelPath(VAT_PATH, { year, quarter: null }),
      figure: formatEUR(vatPaid),
      caption: "ingresado en los 303 del año",
      when: (
        <span className="flex items-center gap-2">
          Hasta el {formatDate(toIsoDate(filingDeadline(year, null)))}
          <QuarterStatus year={year} quarter={null} today={today} />
        </span>
      ),
    },
    {
      code: "100",
      title: "Renta: actividad económica",
      to: modelPath(INCOME_TAX_PATH, { year, quarter: null }),
      figure: formatEUR(annual.netIncome),
      caption: `de rendimiento neto · ${formatEUR(prepaid)} ya adelantados`,
      when: <span>Campaña de abril a junio de {year + 1}</span>,
    },
  ];

  return (
    <section
      aria-label="Modelos anuales"
      className="grid animate-rise-in gap-3 lg:grid-cols-2"
      style={{ "--i": 2 } as CSSProperties}
    >
      {cards.map((c) => (
        <Link
          key={c.code}
          to={c.to}
          className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-foreground no-underline transition-[background-color,scale] duration-150 hover:bg-accent active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2.5">
              <span className="rounded-sm bg-primary-soft px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                {c.code}
              </span>
              <span className="font-semibold">{c.title}</span>
            </span>
            <ChevronRight
              className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="amount text-xl font-semibold">{c.figure}</span>
            <span className="text-xs text-muted-foreground">{c.caption}</span>
          </div>
          <div className="text-sm text-muted-foreground">{c.when}</div>
        </Link>
      ))}
    </section>
  );
}

function OtherForms({ year }: { year: number }) {
  const forms = useOtherForms(year);
  return (
    <section aria-labelledby="other-forms-title" className="flex animate-rise-in flex-col gap-3" style={{ "--i": 3 } as CSSProperties}>
      <div className="flex items-baseline justify-between">
        <h2 id="other-forms-title" className="m-0 text-md font-semibold">
          Otros modelos
        </h2>
        <span className="text-xs text-muted-foreground">Disponibles próximamente</span>
      </div>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {forms.map((f) => (
          <li key={f.codes} className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-muted-foreground">{f.codes}</span>
              {f.applies && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Badge tone="warning">Te afecta</Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-60">
                    Tienes documentos de {year} que lo requieren. Por ahora, prepáralo en la sede de la AEAT.
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <span className="font-medium">{f.title}</span>
            <span className="text-sm text-muted-foreground">{f.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TaxesSummaryPage() {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const year = period.year;

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8 lg:pt-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">Impuestos</h1>
            <p className="m-0 text-sm text-muted-foreground">
              Calculados con tus facturas y gastos. Revisa cada modelo y copia sus casillas en la sede de la AEAT.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link to="/impuestos/calendario" className={cn(buttonVariants({ variant: "secondary" }), "no-underline")}>
              <Calendar strokeWidth={1.8} aria-hidden="true" />
              Calendario fiscal
            </Link>
            <Select
              value={String(year)}
              onValueChange={(y) =>
                setPeriod(period.quarter === null ? { year: Number(y), quarter: null } : quarterOf(Number(y), today))
              }
            >
              <SelectTrigger aria-label={`Ejercicio ${year}`} className="min-w-32">
                <Calendar className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
                <span className="flex-1 text-center">
                  <SelectValue />
                </span>
                <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    Ejercicio {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        <NextFiling today={today} />
        <QuartersTable year={year} today={today} />
        <AnnualForms year={year} today={today} />
        <OtherForms year={year} />
      </div>
    </TooltipProvider>
  );
}

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { Calendar, CalendarDays, ChevronDown, ChevronRight, Settings } from "lucide-react";
import {
  cents,
  daysUntil,
  filingDeadline,
  filingStatus,
  incomeTaxYear,
  model180,
  model190,
  model347,
  model349,
  toIsoDate,
  upcomingDeadlines,
  sumBy,
  vatReturns,
  type Cents,
  type Deadline,
  type Quarter,
} from "@cuentalibre/core";
import { Badge } from "@cuentalibre/ui/components/badge";
import { buttonVariants } from "@cuentalibre/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cuentalibre/ui/components/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { TAX_SETTINGS_PATH } from "@/features/settings/settings-model";
import { daysLeftLabel, deadlineTitle, formatDate, MONTHS_SHORT, periodRange } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { availableYears } from "@/mocks/data";
import { useFormsInUse } from "./forms-in-use";
import { TAX_OPTIONS, useTaxBooks } from "./tax-books";
import { usePartyBooks } from "./party-operations";
import {
  CALENDAR_PATH,
  FILING_STATUS,
  INCOME_TAX_PATH,
  INTRA_EU_PATH,
  modelPath,
  quarterOf,
  RENTALS_PATH,
  THIRD_PARTIES_PATH,
  VAT_PATH,
  WITHHOLDINGS_PATH,
} from "./taxes-model";
import { SettingsLink } from "@/features/settings/settings-parts";

const QUARTERS = [1, 2, 3, 4] as const;

/** "A compensar" for a negative 303, which is carried forward rather than paid. */
function VatAmount({ amount }: { amount: Cents }) {
  if (amount >= 0)
    return <span className={cn("amount", amount === 0 && "text-muted-foreground")}>{formatEUR(amount)}</span>;
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

/** Short name for a filing in the next-deadline list; the model number goes in its own chip. */
function filingName(d: Deadline): string {
  if (d.kind === "vat-303") return `IVA del ${d.quarter}.º trimestre`;
  if (d.kind === "irpf-130") return `IRPF del ${d.quarter}.º trimestre`;
  if (d.kind === "vat-390") return "Resumen anual de IVA";
  return deadlineTitle(d);
}

const FORM_CODE: Partial<Record<Deadline["kind"], string>> = { "vat-303": "303", "irpf-130": "130", "vat-390": "390" };

function FormCode({ code }: { code: string }) {
  return (
    <span className="inline-flex w-10 shrink-0 justify-center rounded-sm bg-primary-soft py-0.5 text-xs font-semibold text-primary tabular-nums">
      {code}
    </span>
  );
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
      return { d, amount: cents(Math.max(0, result)), to: modelPath(INCOME_TAX_PATH, d) };
    }
    return { d, amount: null, to: modelPath(VAT_PATH, { year: d.year, quarter: null }) };
  });
  const total = sumBy(items, (i) => cents(Math.max(0, i.amount ?? 0)));
  const days = daysUntil(today, first.date);

  return (
    <section
      aria-labelledby="next-filing-title"
      className="animate-rise-in overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-warning-soft py-1.5 text-warning">
            <span className="text-xl font-semibold">{first.date.getDate()}</span>
            <span className="text-2xs">{MONTHS_SHORT[first.date.getMonth()]}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <h2 id="next-filing-title" className="m-0 text-lg font-semibold tracking-tight lg:text-title">
              Próxima presentación
            </h2>
            <span className="text-sm font-semibold text-warning">{daysLeftLabel(days)}</span>
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end">
          <span className="text-sm text-muted-foreground">A ingresar</span>
          <span className="amount text-2xl font-semibold tracking-tight">{formatEUR(total)}</span>
        </div>
      </div>
      <ul className="m-0 list-none border-t border-border p-0">
        {items.map(({ d, amount, to }) => (
          <li key={d.kind} className="border-b border-divider last:border-b-0">
            <Link
              to={to}
              className="group flex items-center gap-3 px-5 py-3 text-foreground no-underline transition-colors duration-150 hover:bg-accent"
            >
              <FormCode code={FORM_CODE[d.kind] ?? ""} />
              <span className="flex-1 font-medium">{filingName(d)}</span>
              {amount === null ? (
                <span className="text-sm text-muted-foreground">Informativo</span>
              ) : (
                <VatAmount amount={amount} />
              )}
              <ChevronRight
                className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
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

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="m-0 text-lg font-semibold tracking-tight lg:text-title">
      {children}
    </h2>
  );
}

function QuartersTable({ year, today, yearSelect }: { year: number; today: Date; yearSelect: ReactNode }) {
  const { vat, income } = useYearReturns(year);
  const rows = QUARTERS.map((quarter) => {
    const v = vat[quarter - 1]!.result;
    const i = cents(Math.max(0, income.quarters[quarter - 1]!.result));
    const status = filingStatus(year, quarter, today);
    return {
      quarter,
      vat: v,
      irpf: i,
      total: cents(Math.max(0, v) + i),
      deadline: filingDeadline(year, quarter),
      current: status === "open" || status === "inProgress",
    };
  });
  const totals = {
    vat: sumBy(rows, (r) => cents(Math.max(0, r.vat))),
    irpf: sumBy(rows, (r) => r.irpf),
    total: sumBy(rows, (r) => r.total),
  };
  const th = cn(table.th, "px-4");
  const td = cn(table.td, "px-4");
  const linkClass = "inline-flex items-center gap-1 text-foreground no-underline hover:text-primary";

  return (
    <section
      aria-labelledby="quarters-title"
      className="flex animate-rise-in flex-col gap-3"
      style={{ "--i": 1 } as CSSProperties}
    >
      <div className="flex flex-wrap items-center gap-3">
        <SectionTitle id="quarters-title">Trimestres</SectionTitle>
        {yearSelect}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-border lg:block">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className={table.headRow}>
              <th scope="col" className={th}>
                Trimestre
              </th>
              <th scope="col" className={cn(th, "text-right")}>
                IVA (303)
              </th>
              <th scope="col" className={cn(th, "text-right")}>
                IRPF (130)
              </th>
              <th scope="col" className={cn(th, "text-right")}>
                A ingresar
              </th>
              <th scope="col" className={th}>
                Plazo
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.quarter}
                className={cn(table.row, "animate-row-in", r.current && "bg-primary-soft/40")}
                style={{ "--i": i } as CSSProperties}
              >
                <td className={td}>
                  <span className="font-semibold">T{r.quarter}</span>{" "}
                  <span className="text-sm text-muted-foreground">{periodRange({ year, quarter: r.quarter })}</span>
                </td>
                <td className={cn(td, "text-right")}>
                  <Link to={modelPath(VAT_PATH, { year, quarter: r.quarter })} className={cn(linkClass, "justify-end")}>
                    <VatAmount amount={r.vat} />
                  </Link>
                </td>
                <td className={cn(td, "text-right")}>
                  <Link
                    to={modelPath(INCOME_TAX_PATH, { year, quarter: r.quarter })}
                    className={cn(linkClass, "justify-end")}
                  >
                    <span className={cn("amount", r.irpf === 0 && "text-muted-foreground")}>{formatEUR(r.irpf)}</span>
                  </Link>
                </td>
                <td className={cn(td, "text-right amount font-semibold")}>{formatEUR(r.total)}</td>
                <td className={td}>
                  <span className="flex items-center justify-between gap-3">
                    <span className="whitespace-nowrap text-muted-foreground">{formatDate(toIsoDate(r.deadline))}</span>
                    <QuarterStatus year={year} quarter={r.quarter} today={today} />
                  </span>
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
              <td className={td} />
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0 lg:hidden">
        {rows.map((r) => (
          <li
            key={r.quarter}
            className={cn(
              "flex flex-col gap-3 rounded-xl border border-border p-4",
              r.current && "border-primary/40 bg-primary-soft/40",
            )}
          >
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
                <span className="text-xs text-muted-foreground">IVA (303)</span>
                <VatAmount amount={r.vat} />
              </Link>
              <Link
                to={modelPath(INCOME_TAX_PATH, { year, quarter: r.quarter })}
                className="flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2 text-foreground no-underline active:scale-[0.98]"
              >
                <span className="text-xs text-muted-foreground">IRPF (130)</span>
                <span className="amount">{formatEUR(r.irpf)}</span>
              </Link>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Hasta el {formatDate(toIsoDate(r.deadline))}</span>
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
  const vatPaid = sumBy(vat, (q) => cents(Math.max(0, q.result)));
  const annual = income.annual;
  const prepaid = cents(annual.boxes["0598"]! + annual.boxes["0599"]! + annual.boxes["0604"]!);
  const cards = [
    {
      code: "390",
      title: "Resumen anual de IVA",
      to: modelPath(VAT_PATH, { year, quarter: null }),
      figure: formatEUR(vatPaid),
      caption: "ingresado en los 303 del año",
      when: (
        <span className="flex items-center justify-between gap-2">
          Hasta el {formatDate(toIsoDate(filingDeadline(year, null)))}
          <QuarterStatus year={year} quarter={null} today={today} />
        </span>
      ),
    },
    {
      code: "100",
      title: "Renta, actividad económica",
      to: modelPath(INCOME_TAX_PATH, { year, quarter: null }),
      figure: formatEUR(annual.netIncome),
      caption: `de rendimiento neto, con ${formatEUR(prepaid)} ya adelantados`,
      when: <span>De abril a junio de {year + 1}</span>,
    },
  ];

  return (
    <section
      aria-labelledby="annual-title"
      className="flex animate-rise-in flex-col gap-3"
      style={{ "--i": 2 } as CSSProperties}
    >
      <SectionTitle id="annual-title">Declaraciones anuales</SectionTitle>
      <div className="grid gap-3 lg:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.code}
            to={c.to}
            className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-foreground no-underline transition-[background-color,scale] duration-150 hover:bg-accent active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <FormCode code={c.code} />
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
            <div className="border-t border-divider pt-3 text-sm text-muted-foreground">{c.when}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Withholding and informative forms. The ones the year's documents require come first with
 * their figure; the rest stay as quiet rows so they can still be opened.
 */
function OtherForms({ year }: { year: number }) {
  const inUse = useFormsInUse()(year);
  const books = usePartyBooks();
  const figures = useMemo(() => {
    const withholdings = model190(books.ops, year);
    const rentals = model180(books.ops, year);
    const third = model347(books.ops, year, books.excludedFrom347);
    const intra = model349(books.ops, { year, months: Array.from({ length: 12 }, (_, m) => m) });
    return { withholdings, rentals, third, intra };
  }, [books, year]);
  const quarter = quarterOf(year, new Date());
  const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

  const forms = [
    {
      codes: ["111", "190"],
      title: "Retenciones de facturas recibidas",
      path: WITHHOLDINGS_PATH,
      figure: formatEUR(figures.withholdings.withholding),
      caption: `retenido a ${count(figures.withholdings.perceptors.length, "perceptor", "perceptores")}`,
      applies: inUse.withholdings,
    },
    {
      codes: ["115", "180"],
      title: "Retenciones de alquileres",
      path: RENTALS_PATH,
      figure: formatEUR(figures.rentals.withholding),
      caption: `retenido a ${count(figures.rentals.landlords.length, "arrendador", "arrendadores")}`,
      applies: inUse.rentals,
    },
    {
      codes: [null, "347"],
      title: "Operaciones con terceras personas",
      path: THIRD_PARTIES_PATH,
      figure: count(figures.third.declared.length, "declarado", "declarados"),
      caption: "con más de 3.005,06 € en el año",
      applies: inUse.thirdParties,
    },
    {
      codes: ["349", null],
      title: "Operaciones intracomunitarias",
      path: INTRA_EU_PATH,
      figure: formatEUR(figures.intra.total),
      caption: `de base con ${count(figures.intra.operators, "operador", "operadores")}`,
      applies: inUse.intraEu,
    },
  ].sort((a, b) => Number(b.applies) - Number(a.applies));

  return (
    <section
      aria-labelledby="other-forms-title"
      className="flex animate-rise-in flex-col gap-3"
      style={{ "--i": 3 } as CSSProperties}
    >
      <SectionTitle id="other-forms-title">Retenciones e informativas</SectionTitle>
      <ul className="m-0 list-none overflow-hidden rounded-xl border border-border bg-card p-0">
        {forms.map((f) => {
          const [quarterly, yearly] = f.codes;
          return (
            <li
              key={f.title}
              className="flex flex-col gap-3 border-b border-divider px-5 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-6"
            >
              <div className="flex flex-1 flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <span className={cn("font-medium", !f.applies && "text-muted-foreground")}>{f.title}</span>
                {!f.applies && (
                  <span className="w-full text-sm text-muted-foreground sm:hidden">No te afecta en {year}</span>
                )}
                {f.applies && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <Badge tone="warning">Te afecta</Badge>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-60">Tienes documentos de {year} que lo requieren.</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className={cn("flex flex-col sm:w-52 sm:items-end", !f.applies && "hidden sm:flex")}>
                {f.applies ? (
                  <>
                    <span className="amount font-semibold">{f.figure}</span>
                    <span className="text-xs text-muted-foreground">{f.caption}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">No te afecta en {year}</span>
                )}
              </div>
              <div className="flex gap-1.5 sm:w-64 sm:justify-end">
                {quarterly && (
                  <Link
                    to={modelPath(f.path, quarter)}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "no-underline")}
                  >
                    Trimestral ({quarterly})
                  </Link>
                )}
                {yearly && (
                  <Link
                    to={modelPath(f.path, { year, quarter: null })}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "no-underline")}
                  >
                    Anual ({yearly})
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function TaxesSummaryPage() {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const year = period.year;

  const yearSelect = (
    <Select
      value={String(year)}
      onValueChange={(y) =>
        setPeriod(period.quarter === null ? { year: Number(y), quarter: null } : quarterOf(Number(y), today))
      }
    >
      <SelectTrigger aria-label={`Ejercicio ${year}`} className="min-w-36">
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
  );

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-6 px-5 pt-6 pb-8 lg:gap-8 lg:px-8 lg:pt-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">Impuestos</h1>
            <p className="m-0 text-sm text-muted-foreground">
              Calculados con tus facturas y gastos. Revisa cada modelo y copia sus casillas en la sede de la AEAT.
            </p>
          </div>
          <nav aria-label="Atajos de impuestos" className="-ml-3 flex flex-wrap gap-1 lg:ml-0">
            <Link
              to={CALENDAR_PATH}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground no-underline")}
            >
              <CalendarDays strokeWidth={1.8} aria-hidden="true" />
              Calendario fiscal
            </Link>
            <SettingsLink
              from="Impuestos"
              to={TAX_SETTINGS_PATH}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground no-underline")}
            >
              <Settings strokeWidth={1.8} aria-hidden="true" />
              Configurar impuestos
            </SettingsLink>
          </nav>
        </header>

        <NextFiling today={today} />
        <QuartersTable year={year} today={today} yearSelect={yearSelect} />
        <AnnualForms year={year} today={today} />
        <OtherForms year={year} />
      </div>
    </TooltipProvider>
  );
}

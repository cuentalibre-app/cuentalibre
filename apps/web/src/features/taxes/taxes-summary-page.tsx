import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
  fiscalCalendar,
  model111,
  model115,
  sumBy,
  vatReturns,
  type Cents,
  type CalendarForm,
  type Quarter,
} from "@cuentalibre/core";
import { Badge } from "@cuentalibre/ui/components/badge";
import { buttonVariants } from "@cuentalibre/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cuentalibre/ui/components/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { Page, PageHeader } from "@/components/page";
import { TAX_SETTINGS_PATH } from "@/features/settings/settings-model";
import { daysLeftLabel, formatDate, MONTHS_SHORT, periodRange } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { availableYears } from "@/mocks/data";
import { useFormsInUse, type FormsInUse } from "./forms-in-use";
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

/** What each form is called in the next-deadline list, and when it applies. */
const NEXT_FORMS: Partial<
  Record<CalendarForm, { name: (q: Quarter | null) => string; path: string; applies: true | keyof FormsInUse }>
> = {
  "303": { name: (q) => `IVA del ${q}.º trimestre`, path: VAT_PATH, applies: true },
  "130": { name: (q) => `IRPF del ${q}.º trimestre`, path: INCOME_TAX_PATH, applies: true },
  "390": { name: () => "Resumen anual de IVA", path: VAT_PATH, applies: true },
  "100": { name: () => "Renta, actividad económica", path: INCOME_TAX_PATH, applies: true },
  "111": { name: (q) => `Retenciones del ${q}.º trimestre`, path: WITHHOLDINGS_PATH, applies: "withholdings" },
  "190": { name: () => "Resumen anual de retenciones", path: WITHHOLDINGS_PATH, applies: "withholdings" },
  "115": { name: (q) => `Alquileres del ${q}.º trimestre`, path: RENTALS_PATH, applies: "rentals" },
  "180": { name: () => "Resumen anual de alquileres", path: RENTALS_PATH, applies: "rentals" },
  "347": { name: () => "Operaciones con terceras personas", path: THIRD_PARTIES_PATH, applies: "thirdParties" },
  "349": { name: (q) => `Intracomunitarias del ${q}.º trimestre`, path: INTRA_EU_PATH, applies: "intraEu" },
};

/** Forms that only inform: they carry nothing to pay. */
const INFORMATIVE: CalendarForm[] = ["390", "190", "180", "347", "349"];

function FormCode({ code }: { code: string }) {
  return (
    <span className="inline-flex w-10 shrink-0 justify-center rounded-sm bg-primary-soft py-0.5 text-xs font-semibold text-primary tabular-nums">
      {code}
    </span>
  );
}

function NextFiling({ today }: { today: Date }) {
  const books = useTaxBooks();
  const party = usePartyBooks();
  const inUse = useFormsInUse();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // The forms that apply to the books, due from today on: the soonest day's ones are next
  const upcoming = [...fiscalCalendar(today.getFullYear()), ...fiscalCalendar(today.getFullYear() + 1)].filter((e) => {
    const form = NEXT_FORMS[e.form];
    return form && e.dueOn >= from && (form.applies === true || inUse(e.year)[form.applies]);
  });
  const first = upcoming[0];
  if (!first) return null;
  const items = upcoming
    .filter((e) => e.dueOn.getTime() === first.dueOn.getTime())
    .map((e) => {
      const { year, quarter } = e;
      const form = NEXT_FORMS[e.form]!;
      const to = modelPath(form.path, { year, quarter });
      let amount: Cents | null = null;
      if (e.form === "303" && quarter) amount = vatReturns(books, year)[quarter - 1]!.result;
      if (e.form === "130" && quarter)
        amount = cents(Math.max(0, incomeTaxYear(books, year, TAX_OPTIONS).quarters[quarter - 1]!.result));
      if (e.form === "111" && quarter) amount = cents(model111(party.ops, year, quarter).boxes["30"]!);
      if (e.form === "115" && quarter) amount = cents(model115(party.ops, year, quarter).boxes["05"]!);
      return {
        key: `${e.form}-${year}-${quarter}`,
        code: e.form,
        name: form.name(quarter),
        amount,
        to,
        informative: INFORMATIVE.includes(e.form),
      };
    })
    // What has to be paid first; the informative returns close the list
    .sort((a, b) => Number(a.informative) - Number(b.informative));
  const total = sumBy(items, (i) => cents(Math.max(0, i.amount ?? 0)));
  const days = daysUntil(today, first.dueOn);

  return (
    <section aria-labelledby="next-filing-title" className="animate-rise-in overflow-hidden surface">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-warning-soft py-1.5 text-warning">
            <span className="text-xl font-semibold">{first.dueOn.getDate()}</span>
            <span className="text-2xs">{MONTHS_SHORT[first.dueOn.getMonth()]}</span>
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
        {items.map(({ key, code, name, amount, to, informative }) => (
          <li key={key} className="border-b border-divider last:border-b-0">
            <Link
              to={to}
              className="group flex items-center gap-3 px-5 py-3 text-foreground no-underline transition-colors duration-150 hover:bg-accent"
            >
              <FormCode code={code} />
              <span className="flex-1 font-medium">{name}</span>
              {amount !== null ? (
                <VatAmount amount={amount} />
              ) : (
                informative && <span className="text-sm text-muted-foreground">Informativo</span>
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
      closed: status === "closed",
    };
  });
  // Quarters past their deadline start folded away, unless the whole year is past and nothing else would show
  const closedCount = rows.filter((r) => r.closed).length;
  const canFold = closedCount > 0 && closedCount < rows.length;
  const [showClosed, setShowClosed] = useState(false);
  const shown = canFold && !showClosed ? rows.filter((r) => !r.closed) : rows;
  const closedRows = rows.filter((r) => r.closed);
  const closedSum = {
    vat: sumBy(closedRows, (r) => cents(Math.max(0, r.vat))),
    irpf: sumBy(closedRows, (r) => r.irpf),
    total: sumBy(closedRows, (r) => r.total),
  };
  const closedLabel = closedCount === 1 ? "1 trimestre cerrado" : `${closedCount} trimestres cerrados`;
  const firstClosed = closedRows[0]?.quarter ?? 1;
  const lastClosed = closedRows.at(-1)?.quarter ?? 1;
  const closedRange = `${periodRange({ year, quarter: firstClosed }).split(" – ")[0]} – ${periodRange({ year, quarter: lastClosed }).split(" – ")[1]}`;
  const closedName = firstClosed === lastClosed ? `T${firstClosed}` : `T${firstClosed} – T${lastClosed}`;
  const toggleClosed = () => setShowClosed((v) => !v);
  const chevron = (
    <ChevronDown
      className={cn(
        "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
        showClosed && "rotate-180",
      )}
      aria-hidden="true"
    />
  );
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

      <div className="hidden overflow-x-auto surface lg:block">
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
            {canFold && (
              <tr
                onClick={toggleClosed}
                className={cn(table.row, "cursor-pointer text-muted-foreground hover:bg-accent")}
              >
                <td className={td}>
                  <button
                    type="button"
                    aria-expanded={showClosed}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleClosed();
                    }}
                    className="cursor-pointer border-0 bg-transparent p-0 text-left text-foreground"
                  >
                    <span>
                      <span className="font-semibold">{closedName}</span>{" "}
                      <span className="text-sm text-muted-foreground">{closedRange}</span>
                    </span>
                  </button>
                </td>
                <td className={cn(td, "text-right amount")}>{formatEUR(closedSum.vat)}</td>
                <td className={cn(td, "text-right amount")}>{formatEUR(closedSum.irpf)}</td>
                <td className={cn(td, "text-right amount font-semibold text-foreground")}>
                  {formatEUR(closedSum.total)}
                </td>
                <td className={td}>
                  <span className="flex items-center justify-between gap-3">
                    {closedLabel}
                    {chevron}
                  </span>
                </td>
              </tr>
            )}
            {shown.map((r, i) => (
              <tr key={r.quarter} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
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
        {canFold && (
          <li>
            <button
              type="button"
              aria-expanded={showClosed}
              onClick={toggleClosed}
              className="flex w-full cursor-pointer flex-col gap-1 surface p-4 text-left text-foreground transition-[background-color,scale] duration-150 active:scale-[0.99] pointer-fine:hover:bg-accent"
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span>
                  <span className="font-semibold">{closedName}</span>{" "}
                  <span className="text-sm text-muted-foreground">{closedRange}</span>
                </span>
                {chevron}
              </span>
              <span className="text-sm text-muted-foreground">{closedLabel}</span>
            </button>
          </li>
        )}
        {shown.map((r) => (
          <li key={r.quarter} className="flex flex-col gap-3 surface p-4">
            <div className="flex items-center justify-between">
              <span>
                <span className="font-semibold">T{r.quarter}</span>{" "}
                <span className="text-sm text-muted-foreground">{periodRange({ year, quarter: r.quarter })}</span>
              </span>
              <QuarterStatus year={year} quarter={r.quarter} today={today} />
            </div>
            <div className="-mx-4 border-y border-divider">
              {[
                {
                  code: "303",
                  name: "IVA",
                  to: modelPath(VAT_PATH, { year, quarter: r.quarter }),
                  amount: <VatAmount amount={r.vat} />,
                },
                {
                  code: "130",
                  name: "IRPF",
                  to: modelPath(INCOME_TAX_PATH, { year, quarter: r.quarter }),
                  amount: (
                    <span className={cn("amount", r.irpf === 0 && "text-muted-foreground")}>{formatEUR(r.irpf)}</span>
                  ),
                },
              ].map((m) => (
                <Link
                  key={m.code}
                  to={m.to}
                  className="flex min-h-12 items-center gap-3 border-divider px-4 py-2 text-foreground no-underline transition-opacity duration-150 not-first:border-t active:opacity-60"
                >
                  <FormCode code={m.code} />
                  <span className="flex-1 font-medium">{m.name}</span>
                  {m.amount}
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              ))}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Hasta el {formatDate(toIsoDate(r.deadline))}</span>
              <span className="amount font-semibold">{formatEUR(r.total)}</span>
            </div>
          </li>
        ))}
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
            className="group flex flex-col gap-3 surface p-4 text-foreground no-underline transition-[background-color,scale] duration-150 hover:bg-accent active:scale-[0.99]"
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
  const unused = forms.filter((f) => !f.applies).length;
  const [showUnused, setShowUnused] = useState(false);
  const shownForms = showUnused ? forms : forms.filter((f) => f.applies);

  return (
    <section
      aria-labelledby="other-forms-title"
      className="flex animate-rise-in flex-col gap-3"
      style={{ "--i": 3 } as CSSProperties}
    >
      <SectionTitle id="other-forms-title">Retenciones e informativas</SectionTitle>
      <ul className="m-0 list-none overflow-hidden surface p-0">
        {shownForms.map((f) => {
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
        {unused > 0 && (
          <li className="border-b border-divider last:border-b-0">
            <button
              type="button"
              aria-expanded={showUnused}
              onClick={() => setShowUnused((v) => !v)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-5 py-3.5 text-left text-muted-foreground transition-colors duration-150 pointer-fine:hover:bg-accent pointer-fine:hover:text-foreground"
            >
              {showUnused
                ? "Ocultar los que no te afectan"
                : unused === 1
                  ? `1 modelo no te afecta en ${year}`
                  : `${unused} modelos no te afectan en ${year}`}
              <ChevronDown
                className={cn("size-4 shrink-0 transition-transform duration-200", showUnused && "rotate-180")}
                aria-hidden="true"
              />
            </button>
          </li>
        )}
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
      <Page>
        <PageHeader
          title="Impuestos"
          descriptionClassName="max-lg:hidden"
          description="Calculados con tus facturas y gastos. Revisa cada modelo y copia sus casillas en la sede de la AEAT."
          actionsClassName="max-lg:w-full"
          actions={
            <nav aria-label="Atajos de impuestos" className="flex flex-1 gap-2.5 *:max-lg:flex-1">
              <Link to={CALENDAR_PATH} className={buttonVariants({ variant: "secondary" })}>
                <CalendarDays strokeWidth={1.8} aria-hidden="true" />
                Calendario fiscal
              </Link>
              <SettingsLink
                from="Impuestos"
                to={TAX_SETTINGS_PATH}
                aria-label="Configurar impuestos"
                className={buttonVariants({ variant: "secondary" })}
              >
                <Settings strokeWidth={1.8} aria-hidden="true" />
                <span>
                  Configurar<span className="max-sm:hidden"> impuestos</span>
                </span>
              </SettingsLink>
            </nav>
          }
        />

        <NextFiling today={today} />
        <QuartersTable year={year} today={today} yearSelect={yearSelect} />
        <AnnualForms year={year} today={today} />
        <OtherForms year={year} />
      </Page>
    </TooltipProvider>
  );
}

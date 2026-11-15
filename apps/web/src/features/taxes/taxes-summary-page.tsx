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
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cuentalibre/ui/components/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { HelpTip, Page, PageHeader } from "@/components/page";
import { TAX_SETTINGS_PATH } from "@/features/settings/settings-model";
import { daysLeftLabel, formatDate, MONTHS_SHORT, periodRange } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { useAvailableYears } from "@/lib/use-available-years";
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
  "303": { name: (q) => `IVA ${q}T`, path: VAT_PATH, applies: true },
  "130": { name: (q) => `IRPF ${q}T`, path: INCOME_TAX_PATH, applies: true },
  "390": { name: () => "Resumen anual de IVA", path: VAT_PATH, applies: true },
  "100": { name: () => "Renta, actividad económica", path: INCOME_TAX_PATH, applies: true },
  "111": { name: (q) => `Retenciones ${q}T`, path: WITHHOLDINGS_PATH, applies: "withholdings" },
  "190": { name: () => "Resumen anual de retenciones", path: WITHHOLDINGS_PATH, applies: "withholdings" },
  "115": { name: (q) => `Alquileres ${q}T`, path: RENTALS_PATH, applies: "rentals" },
  "180": { name: () => "Resumen anual de alquileres", path: RENTALS_PATH, applies: "rentals" },
  "347": { name: () => "Operaciones con terceras personas", path: THIRD_PARTIES_PATH, applies: "thirdParties" },
  "349": { name: (q) => `Intracomunitarias ${q}T`, path: INTRA_EU_PATH, applies: "intraEu" },
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
  /*
   * Withholding and intra-EU returns are only filed for a quarter that had operations: the AEAT asks
   * for no blank 111, 115 or 349. Using them in another quarter of the year isn't enough.
   */
  const emptyQuarter = (form: CalendarForm, year: number, quarter: Quarter | null) => {
    if (!quarter) return false;
    if (form === "111") return model111(party.ops, year, quarter).boxes["30"] === 0;
    if (form === "115") return model115(party.ops, year, quarter).boxes["05"] === 0;
    if (form === "349") {
      const months = [0, 1, 2].map((m) => (quarter - 1) * 3 + m);
      const r = model349(party.ops, { year, months });
      return r.operations.length === 0 && r.rectifications.length === 0;
    }
    return false;
  };
  // The forms that apply to the books, due from today on: the soonest day's ones are next
  const upcoming = [...fiscalCalendar(today.getFullYear()), ...fiscalCalendar(today.getFullYear() + 1)].filter((e) => {
    const form = NEXT_FORMS[e.form];
    return (
      form &&
      e.dueOn >= from &&
      (form.applies === true || inUse(e.year)[form.applies]) &&
      !emptyQuarter(e.form, e.year, e.quarter)
    );
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
            <h2 id="next-filing-title" className="m-0 text-lg font-semibold tracking-tight">
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
    <h2 id={id} className="m-0 text-lg font-semibold tracking-tight">
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
  const closedName = firstClosed === lastClosed ? `${firstClosed}T` : `${firstClosed}T – ${lastClosed}T`;
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
                  <span className="font-semibold">{r.quarter}T</span>{" "}
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
            {/* The closed quarters folded into one quiet row, like the desktop table's */}
            <button
              type="button"
              aria-expanded={showClosed}
              aria-label={`${showClosed ? "Ocultar" : "Mostrar"} ${closedLabel}`}
              onClick={toggleClosed}
              className="flex min-h-12 w-full cursor-pointer items-center gap-3 surface px-4 py-2 text-left text-foreground transition-opacity duration-150 active:opacity-60"
            >
              <span className="flex-1">
                <span className="font-semibold">{closedName}</span>{" "}
                <span className="text-sm text-muted-foreground">{closedRange}</span>
              </span>
              <span className="text-sm text-muted-foreground">{closedCount === 1 ? "Cerrado" : "Cerrados"}</span>
              {chevron}
            </button>
          </li>
        )}
        {shown.map((r) => (
          <li key={r.quarter} className="flex flex-col gap-3 surface p-4">
            <div className="flex items-center justify-between">
              <span>
                <span className="font-semibold">{r.quarter}T</span>{" "}
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
            {/* The total of the rows above: larger, and lined up with their amounts past the chevrons */}
            <div className="flex items-baseline justify-between gap-3 pr-7">
              <span className="text-sm text-muted-foreground">Hasta el {formatDate(toIsoDate(r.deadline))}</span>
              <span className="amount text-lg font-semibold">{formatEUR(r.total)}</span>
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
  const cards = [
    {
      code: "390",
      title: "Resumen anual de IVA",
      to: modelPath(VAT_PATH, { year, quarter: null }),
      figure: formatEUR(vatPaid),
      when: (
        <span className="flex items-center justify-between gap-2">
          Hasta el {formatDate(toIsoDate(filingDeadline(year, null)))}
          <QuarterStatus year={year} quarter={null} today={today} />
        </span>
      ),
    },
    {
      code: "100",
      title: "Rendimiento neto",
      to: modelPath(INCOME_TAX_PATH, { year, quarter: null }),
      figure: formatEUR(annual.netIncome),
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
      {/* Phones: a row per form, like the quarter card */}
      <div className="overflow-hidden surface lg:hidden">
        {cards.map((c) => (
          <Link
            key={c.code}
            to={c.to}
            className="flex min-h-12 items-center gap-3 border-divider px-4 py-2 text-foreground no-underline transition-opacity duration-150 not-first:border-t active:opacity-60"
          >
            <FormCode code={c.code} />
            <span className="flex-1 font-medium">{c.title}</span>
            <span className="amount">{c.figure}</span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        ))}
      </div>
      <div className="hidden gap-3 lg:grid lg:grid-cols-2">
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
            <span className="amount text-xl font-semibold">{c.figure}</span>
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

  const forms = [
    {
      codes: ["111", "190"],
      title: "Retenciones de facturas recibidas",
      path: WITHHOLDINGS_PATH,
      figure: formatEUR(figures.withholdings.withholding),
      applies: inUse.withholdings,
    },
    {
      codes: ["115", "180"],
      title: "Retenciones de alquileres",
      path: RENTALS_PATH,
      figure: formatEUR(figures.rentals.withholding),
      applies: inUse.rentals,
    },
    {
      codes: [null, "347"],
      title: "Operaciones con terceras personas",
      path: THIRD_PARTIES_PATH,
      figure: `${figures.third.declared.length} a declarar`,
      applies: inUse.thirdParties,
    },
    {
      codes: ["349", null],
      title: "Operaciones intracomunitarias",
      path: INTRA_EU_PATH,
      figure: formatEUR(figures.intra.total),
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
      {shownForms.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0 sm:gap-0 sm:overflow-hidden sm:surface">
          {shownForms.map((f) => {
            const [quarterly, yearly] = f.codes;
            return (
              <li
                key={f.title}
                // A card each on phones, like the quarters; rows of one card on wider screens
                className="flex flex-col gap-3 border-divider px-4 py-3.5 max-sm:overflow-hidden sm:px-5 max-sm:surface sm:flex-row sm:items-center sm:gap-6 sm:border-b sm:last:border-b-0"
              >
                {/* Only the forms that apply show by default, so a row needs no badge to say so */}
                <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                  <span className={cn("font-medium", !f.applies && "text-muted-foreground")}>{f.title}</span>
                  {f.applies ? (
                    <span className="amount shrink-0 font-semibold">{f.figure}</span>
                  ) : (
                    <span className="shrink-0 text-sm text-muted-foreground">No te afecta</span>
                  )}
                </div>
                {/* Phones: one tappable row per form, like the quarter cards; wider screens: buttons */}
                <div className="-mx-4 -mb-3.5 border-t border-divider sm:hidden">
                  {[
                    quarterly && { code: quarterly, label: "Trimestral", to: modelPath(f.path, quarter) },
                    yearly && { code: yearly, label: "Anual", to: modelPath(f.path, { year, quarter: null }) },
                  ]
                    .filter((m) => !!m)
                    .map((m) => (
                      <Link
                        key={m.code}
                        to={m.to}
                        className="flex min-h-12 items-center gap-3 border-divider px-4 py-2 text-foreground no-underline transition-opacity duration-150 not-first:border-t active:opacity-60"
                      >
                        <FormCode code={m.code} />
                        <span className={cn("flex-1", !f.applies && "text-muted-foreground")}>{m.label}</span>
                        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    ))}
                </div>
                <div className="hidden gap-1.5 sm:flex sm:w-64 sm:justify-end">
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
      )}
      {unused > 0 && (
        <Button
          variant="secondary"
          className="self-start"
          aria-expanded={showUnused}
          onClick={() => setShowUnused((v) => !v)}
        >
          <ChevronDown
            className={cn("transition-transform duration-150", showUnused && "rotate-180")}
            aria-hidden="true"
          />
          {showUnused ? "Ocultar" : "Mostrar"} modelos que no te afectan ({unused})
        </Button>
      )}
    </section>
  );
}

export function TaxesSummaryPage() {
  const availableYears = useAvailableYears();
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
      <SelectTrigger
        aria-label={`Ejercicio ${year}`}
        // A quiet control at the end of the title on phones; a full field on desktop
        className="min-w-36 max-lg:ml-auto max-lg:min-w-0 max-lg:border-transparent max-lg:bg-transparent max-lg:px-1 max-lg:shadow-none"
      >
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
          inline={
            <HelpTip side="bottom">
              Calculados con tus facturas y gastos. Revisa cada modelo y copia sus casillas en la sede de la AEAT.
            </HelpTip>
          }
          actions={
            // On phones these shortcuts live under Impuestos in the "Más" sheet
            <nav aria-label="Atajos de impuestos" className="flex gap-2.5 max-lg:hidden">
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
                Configurar impuestos
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

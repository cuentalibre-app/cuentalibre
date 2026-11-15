import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { Calendar, CalendarDays, ChevronDown, ChevronRight, Settings } from "lucide-react";
import {
  cents,
  daysUntil,
  filingDeadline,
  filingStatus,
  incomeTaxYear,
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
import { daysLeftLabel, formatDate, MONTHS_SHORT } from "@/lib/format";
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

/** A negative 303 is carried forward rather than paid, so it shows in green. */
function VatAmount({ amount }: { amount: Cents }) {
  return (
    <span className={cn("amount", amount === 0 && "text-muted-foreground", amount < 0 && "text-success")}>
      {formatEUR(amount)}
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
  "130": { name: (q) => `IRPF ${q}T`, path: INCOME_TAX_PATH, applies: "incomeTax" },
  "390": { name: () => "Resumen anual de IVA", path: VAT_PATH, applies: true },
  "100": { name: () => "Renta, actividad económica", path: INCOME_TAX_PATH, applies: "incomeTax" },
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
  const [showInformative, setShowInformative] = useState(false);
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
  const payments = items.filter((i) => !i.informative);
  const informatives = items.filter((i) => i.informative);
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
        {(showInformative ? items : payments).map(({ key, code, name, amount, to, informative }) => (
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
        {informatives.length > 0 && (
          // Forms with nothing to pay fold into one line: they're due the same day, but cost nothing
          <li>
            <button
              type="button"
              aria-expanded={showInformative}
              onClick={() => setShowInformative((v) => !v)}
              className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-5 py-3 text-left text-muted-foreground transition-colors duration-150 hover:bg-accent"
            >
              <span className="flex-1 text-sm">
                {showInformative
                  ? "Ocultar informativas"
                  : `${informatives.length === 1 ? "1 informativa" : `${informatives.length} informativas`} (${informatives.map((i) => i.code).join(", ")})`}
              </span>
              <ChevronDown
                className={cn("size-4 shrink-0 transition-transform duration-200", showInformative && "rotate-180")}
                aria-hidden="true"
              />
            </button>
          </li>
        )}
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

/** What each quarter pays: VAT and, when they apply, the income tax installment and the withholding returns. */
function useQuarterRows(year: number, today: Date) {
  const { vat, income } = useYearReturns(year);
  const party = usePartyBooks();
  const inUse = useFormsInUse()(year);
  return useMemo(() => {
    const rows = QUARTERS.map((quarter) => {
      const v = vat[quarter - 1]!.result;
      const irpf = inUse.incomeTax ? cents(Math.max(0, income.quarters[quarter - 1]!.result)) : null;
      const withholdings = inUse.withholdings ? cents(model111(party.ops, year, quarter).boxes["30"]!) : null;
      const rentals = inUse.rentals ? cents(model115(party.ops, year, quarter).boxes["05"]!) : null;
      return {
        quarter,
        vat: v,
        irpf,
        withholdings,
        rentals,
        total: cents(Math.max(0, v) + (irpf ?? 0) + (withholdings ?? 0) + (rentals ?? 0)),
        deadline: filingDeadline(year, quarter),
        closed: filingStatus(year, quarter, today) === "closed",
      };
    });
    return { rows, incomeTax: inUse.incomeTax, withholdings: inUse.withholdings, rentals: inUse.rentals };
  }, [vat, income, party, inUse, year, today]);
}

type QuarterRow = ReturnType<typeof useQuarterRows>["rows"][number];

/** The forms behind a quarter's total, each linking to its return. */
function quarterForms(year: number, r: QuarterRow) {
  const period = { year, quarter: r.quarter };
  return [
    { code: "303", name: "IVA", to: modelPath(VAT_PATH, period), amount: <VatAmount amount={r.vat} /> },
    r.irpf !== null && {
      code: "130",
      name: "IRPF",
      to: modelPath(INCOME_TAX_PATH, period),
      amount: <PlainAmount amount={r.irpf} />,
    },
    r.withholdings !== null && {
      code: "111",
      name: "Retenciones",
      to: modelPath(WITHHOLDINGS_PATH, period),
      amount: <PlainAmount amount={r.withholdings} />,
    },
    r.rentals !== null && {
      code: "115",
      name: "Alquileres",
      to: modelPath(RENTALS_PATH, period),
      amount: <PlainAmount amount={r.rentals} />,
    },
  ].filter((f) => !!f);
}

function PlainAmount({ amount }: { amount: Cents }) {
  return <span className={cn("amount", amount === 0 && "text-muted-foreground")}>{formatEUR(amount)}</span>;
}

function QuartersSection({ year, today, yearSelect }: { year: number; today: Date; yearSelect: ReactNode }) {
  const { rows, incomeTax, withholdings, rentals } = useQuarterRows(year, today);
  // Phones: every quarter is one row with its total; tapping it opens the forms behind it
  const [open, setOpen] = useState<Quarter | null>(null);
  const sumOf = (list: QuarterRow[], pick: (r: QuarterRow) => Cents | null) =>
    sumBy(list, (r) => cents(Math.max(0, pick(r) ?? 0)));
  const sums = (list: QuarterRow[]) => ({
    vat: sumOf(list, (r) => r.vat),
    irpf: sumOf(list, (r) => r.irpf),
    withheld: sumOf(list, (r) => cents((r.withholdings ?? 0) + (r.rentals ?? 0))),
    total: sumOf(list, (r) => r.total),
  });
  const totals = sums(rows);
  const showWithheld = withholdings || rentals;
  const withheldLabel =
    withholdings && rentals ? "Retenciones (111 y 115)" : withholdings ? "Retenciones (111)" : "Alquileres (115)";
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
              {incomeTax && (
                <th scope="col" className={cn(th, "text-right")}>
                  IRPF (130)
                </th>
              )}
              {showWithheld && (
                <th scope="col" className={cn(th, "text-right")}>
                  {withheldLabel}
                </th>
              )}
              <th scope="col" className={cn(th, "text-right")}>
                A ingresar
              </th>
              <th scope="col" className={th}>
                Plazo
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const period = { year, quarter: r.quarter };
              return (
                <tr key={r.quarter} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
                  <td className={td}>
                    <span className="font-semibold">{r.quarter}T</span>
                  </td>
                  <td className={cn(td, "text-right")}>
                    <Link to={modelPath(VAT_PATH, period)} className={cn(linkClass, "justify-end")}>
                      <VatAmount amount={r.vat} />
                    </Link>
                  </td>
                  {r.irpf !== null && (
                    <td className={cn(td, "text-right")}>
                      <Link to={modelPath(INCOME_TAX_PATH, period)} className={cn(linkClass, "justify-end")}>
                        <PlainAmount amount={r.irpf} />
                      </Link>
                    </td>
                  )}
                  {showWithheld && (
                    <td className={cn(td, "text-right")}>
                      <Link
                        to={modelPath(withholdings ? WITHHOLDINGS_PATH : RENTALS_PATH, period)}
                        className={cn(linkClass, "justify-end")}
                      >
                        <PlainAmount amount={cents((r.withholdings ?? 0) + (r.rentals ?? 0))} />
                      </Link>
                    </td>
                  )}
                  <td className={cn(td, "text-right amount font-semibold")}>{formatEUR(r.total)}</td>
                  <td className={td}>
                    <span className="flex items-center justify-between gap-3">
                      <span className="whitespace-nowrap text-muted-foreground">
                        {formatDate(toIsoDate(r.deadline))}
                      </span>
                      <QuarterStatus year={year} quarter={r.quarter} today={today} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/50 font-semibold">
              <td className={td}>Total del año</td>
              <td className={cn(td, "text-right amount")}>{formatEUR(totals.vat)}</td>
              {incomeTax && <td className={cn(td, "text-right amount")}>{formatEUR(totals.irpf)}</td>}
              {showWithheld && <td className={cn(td, "text-right amount")}>{formatEUR(totals.withheld)}</td>}
              <td className={cn(td, "text-right amount")}>{formatEUR(totals.total)}</td>
              <td className={td} />
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="m-0 list-none overflow-hidden surface p-0 lg:hidden">
        {rows.map((r) => {
          const expanded = open === r.quarter;
          return (
            <li key={r.quarter} className="border-b border-divider last:border-b-0">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : r.quarter)}
                className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left text-foreground transition-opacity duration-150 active:opacity-60"
              >
                <span className="flex flex-1 flex-col">
                  <span className="font-semibold">{r.quarter}T</span>
                  <span className="text-sm text-muted-foreground">
                    {FILING_STATUS[filingStatus(year, r.quarter, today)].label}
                  </span>
                </span>
                <span className={cn("amount font-semibold", r.closed && "text-muted-foreground")}>
                  {formatEUR(r.total)}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                    expanded && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
              {expanded && (
                <div className="animate-rise-in border-t border-divider bg-muted/40">
                  {quarterForms(year, r).map((m) => (
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
                  <div className="border-t border-divider px-4 py-2.5 text-sm text-muted-foreground">
                    Hasta el {formatDate(toIsoDate(r.deadline))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface ModelRow {
  code: string;
  name: string;
  to: string;
  applies: boolean;
  /** What shows at the end of the row: informative forms say so; payment forms keep their amounts in Trimestres. */
  detail?: ReactNode;
}

const INFORMATIVE_DETAIL = <span className="text-sm text-muted-foreground">Informativo</span>;

/** Every form once, by how often it's filed. Payment amounts live in Trimestres; here each form is a way in. */
function ModelsSection({ year, today }: { year: number; today: Date }) {
  const inUse = useFormsInUse()(year);
  const quarter = quarterOf(year, today);
  const annual = { year, quarter: null };

  const quarterly: ModelRow[] = [
    { code: "303", name: "IVA", to: modelPath(VAT_PATH, quarter), applies: true },
    { code: "130", name: "IRPF", to: modelPath(INCOME_TAX_PATH, quarter), applies: inUse.incomeTax },
    {
      code: "111",
      name: "Retenciones de facturas recibidas",
      to: modelPath(WITHHOLDINGS_PATH, quarter),
      applies: inUse.withholdings,
    },
    { code: "115", name: "Retenciones de alquileres", to: modelPath(RENTALS_PATH, quarter), applies: inUse.rentals },
    {
      code: "349",
      name: "Operaciones intracomunitarias",
      to: modelPath(INTRA_EU_PATH, quarter),
      applies: inUse.intraEu,
      detail: INFORMATIVE_DETAIL,
    },
  ];
  const yearly: ModelRow[] = [
    {
      code: "390",
      name: "Resumen anual de IVA",
      to: modelPath(VAT_PATH, annual),
      applies: true,
      detail: INFORMATIVE_DETAIL,
    },
    {
      code: "100",
      name: "Renta",
      to: modelPath(INCOME_TAX_PATH, annual),
      applies: inUse.incomeTax,
    },
    {
      code: "190",
      name: "Resumen anual de retenciones",
      to: modelPath(WITHHOLDINGS_PATH, annual),
      applies: inUse.withholdings,
      detail: INFORMATIVE_DETAIL,
    },
    {
      code: "180",
      name: "Resumen anual de alquileres",
      to: modelPath(RENTALS_PATH, annual),
      applies: inUse.rentals,
      detail: INFORMATIVE_DETAIL,
    },
    {
      code: "347",
      name: "Operaciones con terceras personas",
      to: modelPath(THIRD_PARTIES_PATH, annual),
      applies: inUse.thirdParties,
      detail: INFORMATIVE_DETAIL,
    },
  ];
  const unused = [...quarterly, ...yearly].filter((m) => !m.applies).length;
  const [showUnused, setShowUnused] = useState(false);
  const groups = [
    { id: "quarterly-title", title: "Trimestrales", models: quarterly },
    { id: "yearly-title", title: "Anuales", models: yearly },
  ];

  return (
    <section
      aria-labelledby="models-title"
      className="flex animate-rise-in flex-col gap-3"
      style={{ "--i": 2 } as CSSProperties}
    >
      <SectionTitle id="models-title">Modelos</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {groups.map((g) => (
          <div key={g.id} className="flex flex-col gap-2">
            <h3 id={g.id} className="m-0 text-sm font-medium text-muted-foreground">
              {g.title}
            </h3>
            <ul aria-labelledby={g.id} className="m-0 list-none overflow-hidden surface p-0">
              {g.models
                .filter((m) => m.applies || showUnused)
                .map((m) => (
                  <li key={m.code} className="border-b border-divider last:border-b-0">
                    <Link
                      to={m.to}
                      className="group flex min-h-12 items-center gap-3 px-4 py-2 text-foreground no-underline transition-colors duration-150 hover:bg-accent active:opacity-60"
                    >
                      <FormCode code={m.code} />
                      <span className={cn("flex-1 font-medium", !m.applies && "text-muted-foreground")}>{m.name}</span>
                      {m.applies ? m.detail : <span className="text-sm text-muted-foreground">No te afecta</span>}
                      <ChevronRight
                        className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
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
        <QuartersSection year={year} today={today} yearSelect={yearSelect} />
        <ModelsSection year={year} today={today} />
      </Page>
    </TooltipProvider>
  );
}

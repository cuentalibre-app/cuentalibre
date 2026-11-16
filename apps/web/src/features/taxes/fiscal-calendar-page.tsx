import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react";
import {
  calendarStatus,
  cents,
  fiscalCalendar,
  incomeTaxYear,
  model180,
  model190,
  vatReturns,
  type CalendarEntry,
  type CalendarForm,
  type Cents,
} from "@cuentalibre/core";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button } from "@cuentalibre/ui/components/button";
import { SegmentedControl } from "@cuentalibre/ui/components/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cuentalibre/ui/components/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { HelpTip, Page, PageHeader } from "@/components/page";
import { MONTHS, MONTHS_SHORT } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { useSettings } from "@/features/settings/settings-store";
import { useAvailableYears } from "@/lib/use-available-years";
import { useFormsInUse, type FormsInUse } from "./forms-in-use";
import { usePartyBooks } from "./party-operations";
import { FormCode } from "./form-code";
import { TaxesBackLink } from "./tax-intro";
import { TAX_OPTIONS, useTaxBooks } from "./tax-books";
import {
  CALENDAR_STATUS,
  CHARGE_STATUS,
  INCOME_TAX_PATH,
  INTRA_EU_PATH,
  modelPath,
  RENTALS_PATH,
  THIRD_PARTIES_PATH,
  VAT_PATH,
  WITHHOLDINGS_PATH,
} from "./taxes-model";

interface FormInfo {
  name: string;
  /** Row label in the grid, under its group. */
  row: string;
  /** Model page in cuentalibre; forms without one are prepared in the AEAT for now. */
  path?: string;
  /** When the form applies: always, according to the books, or unknown (the user has to check). */
  applies: true | keyof FormsInUse | null;
  /** Who has to file it, shown when the books don't say. */
  condition?: string;
}

const FORMS: Record<CalendarForm, FormInfo> = {
  "303": { name: "IVA", row: "Trimestral", path: VAT_PATH, applies: true },
  "390": { name: "Resumen anual de IVA", row: "Resumen anual", path: VAT_PATH, applies: true },
  "130": { name: "IRPF", row: "Pago fraccionado", path: INCOME_TAX_PATH, applies: true },
  "100": { name: "Renta", row: "Renta anual", path: INCOME_TAX_PATH, applies: true },
  "115": {
    name: "Retenciones de alquileres",
    row: "Alquileres · trimestral",
    path: RENTALS_PATH,
    applies: "rentals",
    condition: "Si alquilas un local u oficina para tu actividad.",
  },
  "180": {
    name: "Resumen anual de alquileres",
    row: "Alquileres · anual",
    path: RENTALS_PATH,
    applies: "rentals",
    condition: "Si alquilas un local u oficina para tu actividad.",
  },
  "111": {
    name: "Retenciones de profesionales",
    row: "Profesionales · trimestral",
    path: WITHHOLDINGS_PATH,
    applies: "withholdings",
    condition: "Si pagas a profesionales que te aplican retención.",
  },
  "190": {
    name: "Resumen anual de retenciones",
    row: "Profesionales · anual",
    path: WITHHOLDINGS_PATH,
    applies: "withholdings",
    condition: "Si pagas a profesionales que te aplican retención.",
  },
  "347": {
    name: "Operaciones con terceros",
    row: "Operaciones con terceros",
    path: THIRD_PARTIES_PATH,
    applies: "thirdParties",
    condition: "Si con un cliente o proveedor superas 3.005,06 € en el año (IVA incluido).",
  },
  "349": {
    name: "Operaciones intracomunitarias",
    row: "Operaciones intracomunitarias",
    path: INTRA_EU_PATH,
    applies: "intraEu",
    condition: "Si vendes o compras a empresas de otros países de la UE. Mensual si superas 50.000 € al trimestre.",
  },
  reta: { name: "Cuota de autónomos", row: "Cuota de autónomos", applies: true },
};

const GROUPS: { title: string; forms: CalendarForm[] }[] = [
  { title: "IVA", forms: ["303", "390"] },
  { title: "IRPF", forms: ["130", "100"] },
  { title: "Retenciones", forms: ["115", "180", "111", "190"] },
  { title: "Declaraciones informativas", forms: ["347", "349"] },
  { title: "Seguridad Social", forms: ["reta"] },
];

type Scope = "mine" | "all";
type View = "grid" | "list";

const day = (date: Date) => `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]!.toLowerCase()}`;

function entryTitle(entry: CalendarEntry, calendarYear: number): string {
  const { form, year, quarter, month } = entry;
  if (form === "reta") return `${FORMS.reta.name} · ${MONTHS[month!]!.toLowerCase()}`;
  const period = quarter === null ? String(year) : year === calendarYear ? `${quarter}T` : `${quarter}T ${year}`;
  return `Modelo ${form} · ${FORMS[form].name} ${period}`;
}

/** "IVA 3T", "Resumen anual de IVA 2025" or "Cuota de autónomos": the form's chip and the month say the rest. */
function shortTitle(entry: CalendarEntry, calendarYear: number): string {
  const { form, year, quarter } = entry;
  if (form === "reta") return FORMS.reta.name;
  const period = quarter === null ? String(year) : year === calendarYear ? `${quarter}T` : `${quarter}T ${year}`;
  return `${FORMS[form].name} ${period}`;
}

/** "Del 1 al 20 oct", "Del 1 ene al 2 feb", or how the fee and the income tax campaign work. */
function windowLabel(entry: CalendarEntry): string {
  const { form, opensOn, dueOn } = entry;
  if (form === "reta") return `Cargo domiciliado el ${day(dueOn)}`;
  if (form === "100") return `Campaña de la renta: de abril al ${day(dueOn)}`;
  const sameMonth = opensOn.getMonth() === dueOn.getMonth();
  return `Del ${sameMonth ? opensOn.getDate() : day(opensOn)} al ${day(dueOn)}`;
}

function entryKey(entry: CalendarEntry): string {
  return `${entry.form}-${entry.year}-${entry.quarter ?? entry.month ?? "y"}`;
}

/** Amount to pay for the entries cuentalibre can compute. */
function useAmounts(calendarYear: number) {
  const books = useTaxBooks();
  const party = usePartyBooks();
  const fee = useSettings().tax.socialSecurityFee;
  return useMemo(() => {
    const byYear = new Map(
      [calendarYear - 1, calendarYear].map((year) => [
        year,
        {
          vat: vatReturns(books, year).map((r) => r.result),
          irpf: incomeTaxYear(books, year, TAX_OPTIONS).quarters.map((r) => r.result),
          withholdings: model190(party.ops, year).paid,
          rentals: model180(party.ops, year).paid,
        },
      ]),
    );
    return (entry: CalendarEntry): Cents | null => {
      const returns = byYear.get(entry.year);
      if (entry.form === "reta") return fee;
      if (!returns || entry.quarter === null) return null;
      if (entry.form === "303") return returns.vat[entry.quarter - 1]!;
      if (entry.form === "130") return cents(Math.max(0, returns.irpf[entry.quarter - 1]!));
      if (entry.form === "111") return returns.withholdings[entry.quarter - 1]!;
      if (entry.form === "115") return returns.rentals[entry.quarter - 1]!;
      return null;
    };
  }, [books, party, calendarYear, fee]);
}

function useApplies() {
  const inUse = useFormsInUse();
  return (entry: CalendarEntry): boolean | null => {
    const { applies } = FORMS[entry.form];
    return applies === true || applies === null ? applies : inUse(entry.year)[applies];
  };
}

function StatusBadge({ entry, today }: { entry: CalendarEntry; today: Date }) {
  const status = (entry.form === "reta" ? CHARGE_STATUS : CALENDAR_STATUS)[calendarStatus(entry, today)];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>
          <Badge tone={status.tone}>{status.label}</Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">{status.hint}</TooltipContent>
    </Tooltip>
  );
}

function Amount({ amount, form }: { amount: Cents | null; form: CalendarForm }) {
  if (amount === null) return null;
  if (form === "303" && amount < 0) {
    return (
      <span className="flex flex-col items-end">
        <span className="amount text-success">{formatEUR(amount)}</span>
        <span className="text-2xs text-muted-foreground">a compensar</span>
      </span>
    );
  }
  return <span className={cn("amount", amount === 0 && "text-muted-foreground")}>{formatEUR(amount)}</span>;
}

function entryLink(entry: CalendarEntry): string | undefined {
  const path = FORMS[entry.form].path;
  return path && modelPath(path, { year: entry.year, quarter: entry.quarter });
}

/* Grid: one row per form and one column per month, like a wall planner. */

const CELL_TONE = {
  open: "bg-warning-soft text-warning font-semibold",
  inProgress: "bg-card text-foreground",
  upcoming: "bg-card text-foreground",
  waiting: "bg-card text-foreground",
  closed: "bg-card text-muted-foreground",
} as const;

function GridCell({
  entry,
  calendarYear,
  today,
  amount,
  applies,
}: {
  entry: CalendarEntry;
  calendarYear: number;
  today: Date;
  amount: Cents | null;
  applies: boolean | null;
}) {
  const status = calendarStatus(entry, today);
  const statusInfo = (entry.form === "reta" ? CHARGE_STATUS : CALENDAR_STATUS)[status];
  const to = entryLink(entry);
  const tag = entry.form === "reta" ? null : entry.quarter === null ? "Anual" : `${entry.quarter}T`;
  /* The row and the column already say the form and the due date; the tooltip adds what they don't. */
  const period =
    entry.form === "reta"
      ? MONTHS[entry.month!]
      : entry.quarter === null
        ? `Ejercicio ${entry.year}`
        : `${entry.quarter}T ${entry.year}`;
  const className = cn(
    "flex h-10 w-full flex-col items-center justify-center rounded-md border border-border text-sm leading-tight no-underline transition-[background-color,scale] duration-150",
    CELL_TONE[status],
    applies !== true && "border-dashed opacity-60",
    to && "hover:bg-accent active:scale-95",
  );
  const content = (
    <>
      <span className="amount">{entry.dueOn.getDate()}</span>
      {tag && <span className="text-2xs font-normal text-muted-foreground">{tag}</span>}
    </>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {to ? (
          <Link to={to} className={className} aria-label={entryTitle(entry, calendarYear)}>
            {content}
          </Link>
        ) : (
          <span tabIndex={0} className={className} aria-label={entryTitle(entry, calendarYear)}>
            {content}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>
        {period} · {amount === null ? statusInfo.label : formatEUR(amount)}
      </TooltipContent>
    </Tooltip>
  );
}

function RowLabel({ form, applies }: { form: CalendarForm; applies: boolean | null }) {
  const info = FORMS[form];
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {form !== "reta" && (
        <span
          className={cn(
            "shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-semibold tabular-nums",
            applies === true ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {form}
        </span>
      )}
      <span title={info.row} className={cn("truncate font-medium", applies !== true && "text-muted-foreground")}>
        {info.row}
      </span>
    </span>
  );
}

function CalendarGrid({
  entries,
  calendarYear,
  today,
  scope,
}: {
  entries: CalendarEntry[];
  calendarYear: number;
  today: Date;
  scope: Scope;
}) {
  const amountOf = useAmounts(calendarYear);
  const appliesTo = useApplies();
  const currentMonth = today.getFullYear() === calendarYear ? today.getMonth() : -1;

  const groups = GROUPS.map((group) => ({
    ...group,
    rows: group.forms
      .map((form) => {
        const formEntries = entries.filter((e) => e.form === form);
        const verdicts = formEntries.map(appliesTo);
        const applies = verdicts.includes(true) ? true : verdicts.includes(null) ? null : false;
        return { form, applies, entries: formEntries };
      })
      .filter((row) => row.entries.length > 0 && (scope === "all" || row.applies === true)),
  })).filter((group) => group.rows.length > 0);

  const monthCol = (month: number) =>
    cn("border-l border-divider px-1 py-1", month === currentMonth && "bg-primary-soft/40");

  return (
    <div className="hidden animate-rise-in overflow-x-auto surface lg:block" style={{ "--i": 1 } as CSSProperties}>
      <table className="w-full table-fixed border-collapse @5xl:min-w-[920px]">
        <thead>
          <tr className="text-xs text-muted-foreground">
            {/* Narrower beside the docked assistant, so the twelve months still fit without scrolling */}
            <th scope="col" className="sticky left-0 z-10 w-56 bg-muted px-4 py-2 text-left font-medium @5xl:w-96">
              Modelo
            </th>
            {MONTHS_SHORT.map((label, month) => (
              <th
                key={label}
                scope="col"
                className={cn(
                  "border-l border-divider px-1 py-2 text-center font-medium",
                  month === currentMonth && "bg-primary-soft text-primary",
                )}
                aria-current={month === currentMonth ? "date" : undefined}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.title}>
            <tr className="border-t border-border">
              <th
                scope="rowgroup"
                className="sticky left-0 z-10 bg-card px-4 pt-3 pb-1 text-left text-xs font-semibold text-muted-foreground"
              >
                {group.title}
              </th>
              {MONTHS_SHORT.map((label, month) => (
                <td key={label} className={monthCol(month)} aria-hidden="true" />
              ))}
            </tr>
            {group.rows.map((row, i) => (
              <tr key={row.form} className="animate-row-in" style={{ "--i": i } as CSSProperties}>
                <th scope="row" className="sticky left-0 z-10 bg-background px-4 py-1 text-left font-normal">
                  <RowLabel form={row.form} applies={row.applies} />
                </th>
                {MONTHS_SHORT.map((label, month) => {
                  const inMonth = row.entries.filter((e) => e.dueOn.getMonth() === month);
                  return (
                    <td key={label} className={monthCol(month)}>
                      <div className="flex flex-col gap-1">
                        {inMonth.map((entry) => (
                          <GridCell
                            key={entryKey(entry)}
                            entry={entry}
                            calendarYear={calendarYear}
                            today={today}
                            amount={amountOf(entry)}
                            applies={appliesTo(entry)}
                          />
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/* List: the same entries as an agenda grouped by month. */

function AgendaItem({
  entry,
  calendarYear,
  today,
  amount,
  applies,
}: {
  entry: CalendarEntry;
  calendarYear: number;
  today: Date;
  amount: Cents | null;
  applies: boolean | null;
}) {
  const to = entryLink(entry);
  const closed = calendarStatus(entry, today) === "closed";
  const info = FORMS[entry.form];
  const body = (
    <>
      <div className={cn("flex w-9 shrink-0 flex-col items-center", closed && "text-muted-foreground")}>
        <span className="text-lg leading-tight font-semibold tabular-nums">{entry.dueOn.getDate()}</span>
        <span className="text-2xs text-muted-foreground uppercase">{MONTHS_SHORT[entry.dueOn.getMonth()]}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn("font-medium", closed && "text-muted-foreground")}>
          {shortTitle(entry, calendarYear)}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {entry.form !== "reta" && <FormCode code={entry.form} muted={applies !== true || closed} />}
          {/* On phones the date column already says when the fee is charged */}
          {entry.form === "reta" ? (
            <>
              <span className="sm:hidden">Domiciliada</span>
              <span className="max-sm:hidden">{windowLabel(entry)}</span>
            </>
          ) : (
            <span>
              {windowLabel(entry)}
              {!to && <span className="hidden sm:inline"> · Se prepara en la sede de la AEAT</span>}
            </span>
          )}
        </span>
        {applies !== true && info.condition && <span className="text-xs text-muted-foreground">{info.condition}</span>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Amount amount={amount} form={entry.form} />
        <StatusBadge entry={entry} today={today} />
      </div>
      {to ? (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : (
        <span className="size-4 shrink-0" aria-hidden="true" />
      )}
    </>
  );
  const className = "flex min-h-14 items-center gap-3 px-4 py-2.5 text-foreground no-underline";

  return (
    <li className="border-b border-divider last:border-b-0">
      {to ? (
        <Link to={to} className={cn(className, "transition-colors duration-150 hover:bg-accent active:bg-muted")}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}

function CalendarList({
  entries,
  calendarYear,
  today,
  className,
}: {
  entries: CalendarEntry[];
  calendarYear: number;
  today: Date;
  className?: string;
}) {
  const amountOf = useAmounts(calendarYear);
  const appliesTo = useApplies();
  const isCurrentYear = today.getFullYear() === calendarYear;
  const [showPast, setShowPast] = useState(false);
  const currentMonth = isCurrentYear ? today.getMonth() : 0;
  const firstMonth = showPast ? 0 : currentMonth;

  const months = Array.from({ length: 12 }, (_, month) => month)
    .filter((month) => month >= firstMonth)
    .map((month) => ({ month, entries: entries.filter((e) => e.dueOn.getMonth() === month) }))
    .filter((m) => m.entries.length > 0);
  const pastCount = entries.filter((e) => e.dueOn.getMonth() < currentMonth).length;

  return (
    <div className={cn("flex animate-rise-in flex-col gap-4", className)} style={{ "--i": 1 } as CSSProperties}>
      {pastCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 self-start text-muted-foreground hover:text-foreground"
          aria-expanded={showPast}
          onClick={() => setShowPast((shown) => !shown)}
        >
          <ChevronDown
            className={cn("transition-transform duration-150", showPast && "rotate-180")}
            aria-hidden="true"
          />
          {showPast ? "Ocultar" : "Mostrar"} plazos anteriores ({pastCount})
        </Button>
      )}
      {months.map(({ month, entries: monthEntries }) => (
        <section key={month} aria-labelledby={`month-${month}`} className="flex flex-col gap-2">
          <h2 id={`month-${month}`} className="m-0 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {MONTHS[month]} {calendarYear}
            {isCurrentYear && month === today.getMonth() && <Badge tone="primary">Este mes</Badge>}
          </h2>
          <ul className="m-0 list-none overflow-hidden surface p-0">
            {monthEntries.map((entry) => (
              <AgendaItem
                key={entryKey(entry)}
                entry={entry}
                calendarYear={calendarYear}
                today={today}
                amount={amountOf(entry)}
                applies={appliesTo(entry)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function FiscalCalendarPage() {
  const availableYears = useAvailableYears();
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const year = period.year;
  const [scope, setScope] = useState<Scope>("mine");
  const [view, setView] = useState<View>("grid");
  const appliesTo = useApplies();

  const years = useMemo(
    () => [...new Set([today.getFullYear() + 1, ...availableYears, today.getFullYear()])].sort((a, b) => b - a),
    [today],
  );
  // A company never files the 130 or the 100, not even under "Todos los modelos"
  const incomeTax = useSettings().profile.kind === "selfEmployed";
  const calendar = useMemo(
    () => fiscalCalendar(year).filter((e) => incomeTax || (e.form !== "130" && e.form !== "100")),
    [year, incomeTax],
  );
  const entries = scope === "all" ? calendar : calendar.filter((e) => appliesTo(e) === true);

  const yearSelect = (
    <Select value={String(year)} onValueChange={(y) => setPeriod({ year: Number(y), quarter: period.quarter })}>
      <SelectTrigger
        aria-label={`Año ${year}`}
        // A quiet control at the end of the row on phones, so it fits beside the models; a full field on desktop
        className="ml-auto min-w-32 max-lg:min-w-0 max-lg:border-transparent max-lg:bg-transparent max-lg:px-0 max-lg:shadow-none lg:ml-0"
      >
        <Calendar className="size-4 text-muted-foreground max-lg:hidden" strokeWidth={1.8} aria-hidden="true" />
        <span className="flex-1 text-center">
          <SelectValue />
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <PageHeader
          title="Calendario fiscal"
          back={<TaxesBackLink />}
          inline={
            <HelpTip side="bottom">{`Plazos de cada modelo en ${year}. Si un plazo acaba en fin de semana, pasa al lunes; los festivos aún no se tienen en cuenta.`}</HelpTip>
          }
        />

        <div className="flex items-center gap-2 lg:flex-wrap lg:gap-3">
          <SegmentedControl<Scope>
            label="Modelos"
            options={[
              { value: "mine", label: "Mis modelos" },
              { value: "all", label: "Todos los modelos" },
            ]}
            value={scope}
            onChange={setScope}
          />
          <SegmentedControl<View>
            label="Vista"
            className="hidden lg:ml-auto lg:flex"
            options={[
              { value: "grid", label: "Cuadrícula" },
              { value: "list", label: "Lista" },
            ]}
            value={view}
            onChange={setView}
          />
          {yearSelect}
        </div>

        {view === "grid" && <CalendarGrid entries={entries} calendarYear={year} today={today} scope={scope} />}
        <CalendarList
          key={year}
          entries={entries}
          calendarYear={year}
          today={today}
          className={view === "grid" ? "lg:hidden" : undefined}
        />
      </Page>
    </TooltipProvider>
  );
}

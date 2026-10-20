import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Calendar, ChevronDown } from "lucide-react";
import {
  model349,
  obligation,
  splitVatNumber,
  toIsoDate,
  type Key349,
  type Periodicity349,
  type Quarter,
} from "@fiscalia/core";
import { SegmentedControl } from "@fiscalia/ui/components/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@fiscalia/ui/components/select";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { PeriodSelect } from "@/components/period-select";
import { contactPath } from "@/features/contacts/contacts-model";
import { formatDate } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { availableYears } from "@/mocks/data";
import { FormInfo } from "./form-info";
import { usePartyBooks } from "./party-operations";
import { RecordsTable, type RecordColumn, type RecordRow } from "./records-table";
import { Assumptions, Notice, ResultPanel, type ResultSummary } from "./tax-form";
import { ModuleBreadcrumb } from "./tax-intro";

const KEY_LABEL: Record<Key349, string> = {
  E: "E · Entregas de bienes",
  A: "A · Adquisiciones de bienes",
  S: "S · Prestaciones de servicios",
  I: "I · Adquisiciones de servicios",
};

const COLUMNS: RecordColumn[] = [
  { label: "País" },
  { label: "NIF operador" },
  { label: "Nombre o razón social" },
  { label: "Clave" },
  { label: "Base imponible", amount: true },
];

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Due date of a monthly or bimonthly 349: the 20th of the next month; July until September 20th, December until January 30th. */
function monthlyDeadline(year: number, lastMonth: number): Date {
  if (lastMonth === 11) return new Date(year + 1, 0, 30);
  if (lastMonth === 6) return new Date(year, 8, 20);
  return new Date(year, lastMonth + 1, 20);
}

interface Selection {
  year: number;
  months: number[];
  /** Quarter for quarterly filings; null for the year or for monthly ones. */
  quarter: Quarter | null;
  label: string;
}

/** Months a bimonthly or monthly filing can pick, newest first, up to the current month. */
function monthlyOptions(
  periodicity: Periodicity349,
  today: Date,
): { key: string; label: string; year: number; months: number[] }[] {
  return availableYears.flatMap((year) => {
    const last = year === today.getFullYear() ? today.getMonth() : 11;
    if (periodicity === "monthly") {
      return Array.from({ length: last + 1 }, (_, m) => ({
        key: `${year}-${m}`,
        label: `${MONTHS[m]} ${year}`,
        year,
        months: [m],
      })).reverse();
    }
    return ([4, 3, 2, 1] as const)
      .filter((q) => (q - 1) * 3 <= last)
      .map((q) => {
        const first = (q - 1) * 3;
        return {
          key: `${year}-${first}`,
          label: `${MONTHS[first]} y ${MONTHS[first + 1]!.toLowerCase()} ${year}`,
          year,
          months: [first, first + 1],
        };
      });
  });
}

export function IntraEuPage() {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const [periodicity, setPeriodicity] = useState<Periodicity349>("quarterly");
  const options = useMemo(() => monthlyOptions(periodicity, today), [periodicity, today]);
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const books = usePartyBooks();

  const selection: Selection = useMemo(() => {
    if (periodicity === "quarterly") {
      const q = period.quarter;
      return {
        year: period.year,
        quarter: q,
        months: q === null ? Array.from({ length: 12 }, (_, m) => m) : [(q - 1) * 3, (q - 1) * 3 + 1, (q - 1) * 3 + 2],
        label: q === null ? `ejercicio ${period.year}` : `${q}T ${period.year}`,
      };
    }
    const option = options.find((o) => o.key === monthKey) ?? options[0]!;
    return { year: option.year, quarter: null, months: option.months, label: option.label.toLowerCase() };
  }, [periodicity, period, options, monthKey]);

  const r = useMemo(() => model349(books.ops, selection), [books, selection]);

  const rows: RecordRow[] = r.operations.map((o) => {
    const contact = books.contacts.get(o.contactId);
    const vat = splitVatNumber(contact?.taxId ?? "", contact?.country);
    const name = contact?.name ?? "Contacto eliminado";
    return {
      id: `${o.contactId}-${o.key}`,
      title: name,
      values: [
        { text: vat.code, mono: true },
        { text: vat.number, mono: true },
        { text: name },
        { text: KEY_LABEL[o.key], copy: o.key },
        { amount: o.base },
      ],
      documentIds: o.documentIds,
    };
  });

  const noCountry = r.operations.filter((o) => {
    const c = books.contacts.get(o.contactId);
    return !splitVatNumber(c?.taxId ?? "", c?.country).code;
  });
  const notInVies = [
    ...new Map(
      r.operations.map(
        (o) =>
          [
            o.contactId,
            { contact: books.contacts.get(o.contactId), role: o.key === "E" || o.key === "S" ? "client" : "supplier" },
          ] as const,
      ),
    ).values(),
  ].filter((x) => x.contact && !x.contact.vies);

  const lastMonth = selection.months[selection.months.length - 1]!;
  const quarterly = periodicity === "quarterly" && selection.quarter !== null;
  const deadline = quarterly ? obligation("349", selection.year, selection.quarter).dueOn : null;
  const deadlineText =
    periodicity === "quarterly"
      ? `Declaración anual: hasta el ${formatDate(toIsoDate(new Date(selection.year + 1, 0, 30)))}, solo si tus operaciones no superan 35.000 €`
      : `Plazo hasta el ${formatDate(toIsoDate(monthlyDeadline(selection.year, lastMonth)))}`;

  const result: ResultSummary = {
    label: "Base imponible total",
    amount: r.total,
    verdict: "Informativo",
    tone: "neutral",
    detail:
      r.operators === 0
        ? `Sin operaciones intracomunitarias en ${selection.label}.`
        : `${r.operators === 1 ? "1 operador" : `${r.operators} operadores`} en ${selection.label}.`,
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8 lg:pt-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <ModuleBreadcrumb module="intraEu" form="349" />
            <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">Operaciones intracomunitarias</h1>
            <p className="m-0 text-sm text-muted-foreground">
              Modelo 349: compras y ventas con empresas de otros países de la UE inscritas en el VIES.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <SegmentedControl
              label="Periodicidad"
              value={periodicity}
              onChange={(v) => {
                setPeriodicity(v);
                setMonthKey(null);
              }}
              options={[
                { value: "quarterly", label: "Trimestral" },
                { value: "bimonthly", label: "Bimensual" },
                { value: "monthly", label: "Mensual" },
              ]}
            />
            {periodicity === "quarterly" ? (
              <PeriodSelect value={period} onChange={setPeriod} years={availableYears} today={today} />
            ) : (
              <Select value={monthKey ?? options[0]!.key} onValueChange={setMonthKey}>
                <SelectTrigger aria-label={`Periodo: ${selection.label}`} className="min-w-48">
                  <Calendar className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
                  <span className="flex-1 text-center">
                    <SelectValue />
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </header>

        {periodicity === "bimonthly" && (
          <Notice tone="info">
            Bimensual solo aplica el trimestre en que superas por primera vez 50.000 € de entregas y prestaciones
            intracomunitarias en sus dos primeros meses. A partir del tercer mes, la declaración es mensual.
          </Notice>
        )}

        <ResultPanel
          form="349"
          year={selection.year}
          quarter={quarterly ? selection.quarter : null}
          deadline={deadline}
          deadlineText={deadlineText}
          today={today}
          result={result}
        />

        {noCountry.length > 0 && (
          <Notice>
            No se ha podido deducir el código de país de algún operador. Usa el NIF-IVA con el prefijo del país (por
            ejemplo, DE123456789) o indica el país en su ficha.
          </Notice>
        )}
        {notInVies.length > 0 && (
          <Notice>
            <span>
              {notInVies.length === 1 ? "Este operador no consta" : "Estos operadores no constan"} como inscritos en el
              VIES en su ficha:{" "}
              {notInVies.map(({ contact, role }, i) => (
                <span key={contact!.id}>
                  {i > 0 && ", "}
                  <Link to={contactPath(role, contact!.id)} className="font-medium text-warning underline">
                    {contact!.name}
                  </Link>
                </span>
              ))}
              . Sin VIES la operación no es intracomunitaria.
            </span>
          </Notice>
        )}

        <section aria-label="Lista de operaciones" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-md font-semibold">Lista de operaciones</h2>
            <span className="text-xs text-muted-foreground">Un registro por operador y clave</span>
          </div>
          <RecordsTable
            label="Operaciones intracomunitarias"
            columns={COLUMNS}
            rows={rows}
            books={books}
            empty="No hay facturas con el tipo de operación Intracomunitaria en este periodo."
          />
        </section>

        <FormInfo form="349" />
        <Assumptions
          items={[
            "Recoge solo las facturas con el tipo de operación Intracomunitaria, sea cual sea el país del cliente o proveedor.",
            "El código de país sale del prefijo del NIF-IVA y, si no lo tiene, del país de la ficha del contacto.",
            "Las ventas de la cuenta 700 y las compras de las cuentas 600 y 602 son bienes (claves E y A); el resto, servicios (S e I).",
            "Las rectificaciones de periodos anteriores no se separan: se suman en el periodo de la factura rectificativa.",
            "Se calcula como una única declaración, sin sustitutivas.",
          ]}
        />
      </div>
    </TooltipProvider>
  );
}

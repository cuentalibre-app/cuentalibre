import { useMemo, type CSSProperties } from "react";
import { Link } from "react-router";
import { Calendar, ChevronDown, Info } from "lucide-react";
import { model347, obligation, sumBy, THRESHOLD_347, type Declared347 } from "@fiscalia/core";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@fiscalia/ui/components/select";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { TAX_SETTINGS_PATH } from "@/features/settings/settings-model";
import { usePeriod } from "@/lib/use-period";
import { availableYears } from "@/mocks/data";
import { FormInfo } from "./form-info";
import { usePartyBooks, type PartyBooks } from "./party-operations";
import { RecordsTable, type RecordColumn, type RecordRow } from "./records-table";
import { Assumptions, ResultPanel, type ResultSummary } from "./tax-form";

const COLUMNS: RecordColumn[] = [
  { label: "NIF" },
  { label: "Declarado" },
  { label: "Provincia", secondary: true },
  { label: "Clave" },
  { label: "1T", amount: true, secondary: true },
  { label: "2T", amount: true, secondary: true },
  { label: "3T", amount: true, secondary: true },
  { label: "4T", amount: true, secondary: true },
  { label: "Importe anual", amount: true },
  { label: "En metálico", amount: true, secondary: true },
];

const KEY_LABEL = { A: "A · Compras", B: "B · Ventas" };

function rows(books: PartyBooks, parties: Declared347[]): RecordRow[] {
  return parties.map((d) => {
    const contact = books.contacts.get(d.contactId);
    const name = contact?.name ?? "Contacto eliminado";
    return {
      id: `${d.contactId}-${d.key}`,
      title: name,
      values: [
        { text: contact?.taxId ?? "", mono: true },
        { text: name },
        { text: contact?.province ?? "" },
        { text: KEY_LABEL[d.key], copy: d.key },
        ...d.quarters.map((amount) => ({ amount })),
        { amount: d.total },
        { amount: d.cash },
      ],
      documentIds: d.documentIds,
    };
  });
}

/** Parties under the threshold, with how far each one has got. */
function BelowThreshold({ books, parties }: { books: PartyBooks; parties: Declared347[] }) {
  if (parties.length === 0) return null;
  return (
    <details className="group rounded-xl border border-border px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium [&::-webkit-details-marker]:hidden">
        <span>Por debajo del umbral · {parties.length}</span>
        <span className="text-xs font-normal text-muted-foreground">No se declaran</span>
      </summary>
      <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
        {parties.map((d, i) => {
          const share = Math.min(1, Math.abs(d.total) / THRESHOLD_347);
          return (
            <li
              key={`${d.contactId}-${d.key}`}
              className="flex animate-row-in flex-col gap-1"
              style={{ "--i": i } as CSSProperties}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate">
                  {books.contacts.get(d.contactId)?.name ?? "Contacto eliminado"}{" "}
                  <span className="text-xs text-muted-foreground">{d.key === "A" ? "compras" : "ventas"}</span>
                </span>
                <span className="shrink-0 amount text-muted-foreground">{formatEUR(d.total)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary/60" style={{ width: `${share * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function Excluded({ books, excluded }: { books: PartyBooks; excluded: ReturnType<typeof model347>["excluded"] }) {
  const byReason = useMemo(() => {
    const groups = new Map<string, typeof excluded>();
    for (const e of excluded) groups.set(e.reason, [...(groups.get(e.reason) ?? []), e]);
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [excluded]);
  if (excluded.length === 0) return null;
  return (
    <details className="group rounded-xl border border-border px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium [&::-webkit-details-marker]:hidden">
        <span>Operaciones que no cuentan · {excluded.length}</span>
        <span className="text-xs font-normal text-muted-foreground">Se declaran en otros modelos</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {byReason.map(([reason, items]) => (
          <div key={reason} className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {reason} · {items.length}
            </span>
            <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
              {items.slice(0, 40).map(({ op }) => {
                const doc = books.documents.get(op.id);
                if (!doc) return null;
                return (
                  <li key={op.id}>
                    <Link to={doc.to} className="font-mono text-xs text-foreground no-underline hover:text-primary">
                      {doc.number || doc.payee || doc.date}
                    </Link>
                  </li>
                );
              })}
              {items.length > 40 && <li className="text-xs text-muted-foreground">y {items.length - 40} más</li>}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

export function ThirdPartiesPage() {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const year = period.year;
  const books = usePartyBooks();
  const r = useMemo(() => model347(books.ops, year, books.excludedFrom347), [books, year]);
  const sales = r.declared.filter((d) => d.key === "B").length;
  const purchases = r.declared.length - sales;

  const result: ResultSummary = {
    label: "Importe total declarado",
    amount: sumBy(r.declared, (d) => d.total),
    verdict: r.declared.length === 0 ? "No tienes que presentarlo" : "Informativo",
    tone: "neutral",
    detail:
      r.declared.length === 0
        ? "Según tus datos no hay ninguna operación a declarar."
        : `${r.declared.length === 1 ? "1 declarado" : `${r.declared.length} declarados`}: ${purchases} de compras y ${sales} de ventas.`,
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8 lg:pt-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">Operaciones con terceras personas</h1>
            <p className="m-0 text-sm text-muted-foreground">
              Modelo 347: clientes y proveedores con los que has superado {formatEUR(THRESHOLD_347)} en el año, IVA
              incluido. No existe modelo trimestral.
            </p>
          </div>
          <Select value={String(year)} onValueChange={(y) => setPeriod({ year: Number(y), quarter: null })}>
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
        </header>

        <ResultPanel
          form="347"
          year={year}
          quarter={null}
          deadline={obligation("347", year, null).dueOn}
          today={today}
          result={result}
        />

        <section aria-label="Declarados" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-md font-semibold">Declarados</h2>
            <span className="text-xs text-muted-foreground">
              Compras y ventas con la misma persona se declaran por separado
            </span>
          </div>
          <RecordsTable
            label="Declarados del modelo 347"
            columns={COLUMNS}
            rows={rows(books, r.declared)}
            books={books}
            empty={
              <>
                Según los datos introducidos no existe ninguna operación a declarar.
                <br />
                No es necesario que presentes el modelo 347.
              </>
            }
          />
        </section>

        <BelowThreshold books={books} parties={r.belowThreshold} />
        <Excluded books={books} excluded={r.excluded} />

        <p className={cn("m-0 flex items-start gap-2 text-sm text-muted-foreground")}>
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span>
            Si agrupas las ventas a clientes sin identificar en un cliente ficticio, elígelo en{" "}
            <Link to={TAX_SETTINGS_PATH} className="text-primary">
              Configuración › Impuestos
            </Link>{" "}
            para que no aparezca aquí.
          </span>
        </p>

        <FormInfo form="347" />
        <Assumptions
          items={[
            "Toda operación registrada se toma como entrega o adquisición de bienes y servicios. No contempla operaciones de seguros, transmisiones de inmuebles sujetas a IVA ni arrendamientos de locales de negocio.",
            "Las facturas con retención, emitidas o recibidas, no cuentan: se declaran en el modelo de la retención.",
            "Las operaciones intracomunitarias (349), las importaciones y exportaciones, y las de clientes o proveedores de fuera de España no se recogen.",
            "Los gastos sin factura cuentan si están asociados a un proveedor.",
            "El importe en metálico solo se informa cuando lo cobrado en efectivo a una persona supera 6.000 €.",
            "Se calcula como una única declaración, sin sustitutivas.",
          ]}
        />
      </div>
    </TooltipProvider>
  );
}

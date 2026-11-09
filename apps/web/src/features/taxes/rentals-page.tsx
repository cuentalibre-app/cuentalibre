import { useMemo, useState } from "react";
import { Link } from "react-router";
import { cents, file115, model115, model180, obligation, sumCents, type Quarter } from "@cuentalibre/core";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { PeriodSelect } from "@/components/period-select";
import { formatDate } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { availableYears } from "@/mocks/data";
import { FormInfo } from "./form-info";
import { usePartyBooks } from "./party-operations";
import { RecordsTable, type RecordColumn, type RecordRow } from "./records-table";
import {
  Assumptions,
  DocumentsPanel,
  EmptyBoxesToggle,
  FormSections,
  FormSwitch,
  Notice,
  QuarterCards,
  ResultPanel,
  useAeatFile,
  type DocumentGroup,
  type ResultSummary,
} from "./tax-form";
import { COUNT_BOXES_115, LAYOUT_115, modelPath, ONLY_RECORDED, quarterOf, RENTALS_PATH } from "./taxes-model";
import { MissingProvinces } from "./withholdings-page";
import { ModuleBreadcrumb } from "./tax-intro";

const SITUATION_LABEL: Record<string, string> = {
  "1": "1 · España con ref. catastral",
  "2": "2 · País Vasco o Navarra",
  "3": "3 · Sin referencia catastral",
  "4": "4 · En el extranjero",
};

const LANDLORD_COLUMNS: RecordColumn[] = [
  { label: "NIF" },
  { label: "Arrendador" },
  { label: "Provincia", secondary: true },
  { label: "Situación", secondary: true },
  { label: "Referencia catastral", secondary: true },
  { label: "Base", amount: true },
  { label: "Retenciones", amount: true },
];

/** Rentals with an unusual withholding rate, as the reference app warns: not an error, but rare. */
function UnusualRates({ ids }: { ids: string[] }) {
  const books = usePartyBooks();
  if (ids.length === 0) return null;
  const ops = new Map(books.ops.map((o) => [o.id, o]));
  return (
    <Notice>
      <span>
        Hay alquileres con un tipo de retención poco habitual (lo normal es el 19 %, o el 7,6 % en Ceuta y Melilla). No
        es necesariamente un error, pero comprueba que la retención es la correcta:
      </span>
      <ul className="m-0 flex flex-wrap gap-x-4 gap-y-1 pl-0">
        {ids.map((id) => {
          const doc = books.documents.get(id);
          const op = ops.get(id);
          if (!doc || !op) return null;
          return (
            <li key={id} className="list-none">
              <Link to={doc.to} className="font-medium text-warning tabular-nums underline">
                {doc.number || formatDate(doc.date)}
              </Link>{" "}
              ({(op.withholdingRate * 100).toLocaleString("es-ES")} %)
            </li>
          );
        })}
      </ul>
    </Notice>
  );
}

function useRentalDocuments(ids: string[]): DocumentGroup[] {
  const books = usePartyBooks();
  return useMemo(() => {
    const ops = new Map(books.ops.map((o) => [o.id, o]));
    const rows = ids
      .map((id) => ({ doc: books.documents.get(id)!, op: ops.get(id)! }))
      .filter((r) => r.doc && r.op)
      .sort((a, b) => a.doc.date.localeCompare(b.doc.date))
      .map(({ doc, op }) => ({
        id: doc.id,
        to: doc.to,
        date: doc.date,
        number: doc.number,
        contact: books.contacts.get(op.contactId)?.name ?? doc.payee ?? "Sin contacto",
        tag: op.cadastralRef || undefined,
        amounts: [op.base, op.withholding],
      }));
    return [
      {
        key: "rentals",
        label: "Alquileres",
        columns: ["Base", "Retención"],
        rows,
        empty: "No hay facturas de alquiler con retención en este trimestre.",
      },
    ];
  }, [books, ids]);
}

function Form115({ year, quarter, today }: { year: number; quarter: Quarter; today: Date }) {
  const books = usePartyBooks();
  const [showEmpty, setShowEmpty] = useState(false);
  const r = useMemo(() => model115(books.ops, year, quarter), [books, year, quarter]);
  const documents = useRentalDocuments(r.documentIds);
  const unusual = useMemo(
    () =>
      model180(books.ops, year)
        .unusual.filter((o) => Math.ceil(Number(o.date.slice(5, 7)) / 3) === quarter)
        .map((o) => o.id),
    [books, year, quarter],
  );
  const amount = cents(r.boxes["05"]!);

  const file = useAeatFile("115", year, quarter, (filer) => file115({ year, quarter, boxes: r.boxes }, filer));

  const result: ResultSummary = {
    label: "Resultado a ingresar [05]",
    amount,
    verdict: amount > 0 ? "A ingresar" : "Resultado cero",
    tone: amount > 0 ? "danger" : "neutral",
    detail:
      amount > 0
        ? `Retención del alquiler de ${r.boxes["01"] === 1 ? "1 arrendador" : `${r.boxes["01"]} arrendadores`}.`
        : "Tu declaración tiene resultado cero; si estás obligado a presentar el 115, preséntalo igualmente.",
  };

  return (
    <>
      <ResultPanel
        form="115"
        year={year}
        quarter={quarter}
        deadline={obligation("115", year, quarter).dueOn}
        today={today}
        result={result}
        file={file}
      />
      <UnusualRates ids={unusual} />
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold tracking-tight lg:text-title">Casillas del modelo 115</h2>
        <EmptyBoxesToggle checked={showEmpty} onChange={setShowEmpty} />
      </div>
      <FormSections sections={LAYOUT_115} boxes={r.boxes} countBoxes={COUNT_BOXES_115} showEmpty={showEmpty} />
      <DocumentsPanel title="Facturas de alquiler del trimestre" groups={documents} />
      <FormInfo form="115" />
      <Assumptions
        items={[
          "Tiene en cuenta las facturas recibidas marcadas como alquiler de inmueble que llevan retención.",
          "Cuenta la fecha de contabilización de cada factura.",
          ONLY_RECORDED,
          "Se calcula como una única declaración, sin complementarias.",
        ]}
      />
    </>
  );
}

function Form180({ year, today }: { year: number; today: Date }) {
  const books = usePartyBooks();
  const r = useMemo(() => model180(books.ops, year), [books, year]);
  const rows: RecordRow[] = r.landlords.map((l) => {
    const contact = books.contacts.get(l.contactId);
    const name = contact?.name ?? "Proveedor eliminado";
    return {
      id: `${l.contactId}-${l.cadastralRef}`,
      title: name,
      values: [
        { text: contact?.taxId ?? "", mono: true },
        { text: name },
        { text: contact?.province ?? "" },
        { text: SITUATION_LABEL[l.situation] ?? l.situation, copy: l.situation },
        { text: l.cadastralRef, mono: true },
        { amount: l.base },
        { amount: l.withholding },
      ],
      documentIds: l.documentIds,
    };
  });
  const paid = sumCents(r.paid);

  const result: ResultSummary = {
    label: "Total de retenciones por alquileres",
    amount: r.withholding,
    verdict: "Informativo",
    tone: "neutral",
    detail:
      r.landlords.length === 0
        ? "Tu declaración tiene resultado cero."
        : `${r.landlords.length === 1 ? "1 registro" : `${r.landlords.length} registros`} · base ${formatEUR(r.base)}`,
  };

  return (
    <>
      <ResultPanel
        form="180"
        year={year}
        quarter={null}
        deadline={obligation("180", year, null).dueOn}
        today={today}
        result={result}
      />
      <QuarterCards
        form="115"
        year={year}
        today={today}
        values={r.paid}
        to={(q) => modelPath(RENTALS_PATH, { year, quarter: q })}
      />
      {paid !== r.withholding && (
        <Notice>
          Los 115 del año suman {formatEUR(paid)} y las retenciones de los arrendadores {formatEUR(r.withholding)}.
        </Notice>
      )}
      <UnusualRates ids={r.unusual.map((o) => o.id)} />
      <MissingProvinces books={books} perceptors={r.landlords} />
      <section aria-label="Arrendadores" className="flex flex-col gap-3">
        <h2 className="m-0 text-lg font-semibold tracking-tight lg:text-title">Arrendadores e inmuebles</h2>
        <RecordsTable
          label="Arrendadores e inmuebles"
          columns={LANDLORD_COLUMNS}
          rows={rows}
          books={books}
          empty="No se dispone de información sobre ningún perceptor este año."
        />
      </section>
      <FormInfo form="180" />
      <Assumptions
        items={[
          "Tiene en cuenta las facturas recibidas marcadas como alquiler de inmueble que llevan retención.",
          "Un registro por arrendador e inmueble: si el mismo arrendador te alquila varios, se separan por su referencia catastral.",
          "Supone que el alquiler se paga en dinero, no en especie.",
          "La situación del inmueble y la referencia catastral salen de cada factura; revísalas si están vacías.",
          "La provincia de cada arrendador es obligatoria: si falta en la ficha del proveedor, complétala antes de presentar.",
          ONLY_RECORDED,
        ]}
      />
    </>
  );
}

export function RentalsPage() {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const annual = period.quarter === null;

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8 lg:pt-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <ModuleBreadcrumb module="rentals" form={annual ? "180" : "115"} />
            <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">Retenciones de alquileres</h1>
            <p className="m-0 text-sm text-muted-foreground">
              {annual
                ? "Modelo 180: resumen anual de las retenciones de alquileres, por arrendador e inmueble."
                : "Modelo 115: la retención del alquiler de tu local u oficina, a ingresar en Hacienda."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <FormSwitch
              value={annual ? "180" : "115"}
              onChange={(v) =>
                setPeriod(v === "180" ? { year: period.year, quarter: null } : quarterOf(period.year, today))
              }
              options={[
                { value: "115", label: "115 · Trimestral" },
                { value: "180", label: "180 · Anual" },
              ]}
            />
            <PeriodSelect value={period} onChange={setPeriod} years={availableYears} today={today} />
          </div>
        </header>
        {period.quarter === null ? (
          <Form180 key={period.year} year={period.year} today={today} />
        ) : (
          <Form115 key={`${period.year}-${period.quarter}`} year={period.year} quarter={period.quarter} today={today} />
        )}
      </div>
    </TooltipProvider>
  );
}

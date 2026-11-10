import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  cents,
  file111,
  model111,
  model190,
  obligation,
  sumCents,
  type Perceptor,
  type Quarter,
} from "@cuentalibre/core";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { Page, PageHeader } from "@/components/page";
import { PeriodSelect } from "@/components/period-select";
import { editContactPath } from "@/features/contacts/contacts-model";
import { usePeriod } from "@/lib/use-period";
import { availableYears } from "@/mocks/data";
import { FormInfo } from "./form-info";
import { usePartyBooks, type PartyBooks } from "./party-operations";
import { RecordsTable, type RecordColumn, type RecordRow } from "./records-table";
import {
  Assumptions,
  EmptyBoxesToggle,
  FormSections,
  FormSwitch,
  Notice,
  QuarterCards,
  ResultPanel,
  useAeatFile,
  type ResultSummary,
} from "./tax-form";
import { COUNT_BOXES_111, LAYOUT_111, modelPath, ONLY_RECORDED, quarterOf, WITHHOLDINGS_PATH } from "./taxes-model";
import { ModuleBreadcrumb, TaxesBackLink } from "./tax-intro";

const KEY_LABEL = { F: "Rendimientos del trabajo (cursos, conferencias)", G: "Actividades profesionales" };

const percent = (rate: number | null) =>
  rate === null ? "Varios" : `${(rate * 100).toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;

export const PERCEPTOR_COLUMNS: RecordColumn[] = [
  { label: "NIF" },
  { label: "Perceptor" },
  { label: "Provincia", secondary: true },
  { label: "Clave", secondary: true },
  { label: "Tipo", secondary: true },
  { label: "Percepciones íntegras", amount: true },
  { label: "Retenciones", amount: true },
];

export function perceptorRows(books: PartyBooks, perceptors: Perceptor[]): RecordRow[] {
  return perceptors.map((p) => {
    const contact = books.contacts.get(p.contactId);
    const name = contact?.name ?? "Proveedor eliminado";
    return {
      id: `${p.contactId}-${p.key}`,
      title: name,
      values: [
        { text: contact?.taxId ?? "", mono: true },
        { text: name },
        { text: contact?.province ?? "", muted: !contact?.province },
        { text: `${p.key}${p.subkey}`, copy: p.key, mono: true },
        { text: percent(p.rate), muted: true },
        { amount: p.base },
        { amount: p.withholding },
      ],
      documentIds: p.documentIds,
    };
  });
}

/** Perceptors without a province: the AEAT requires it. */
export function MissingProvinces({ books, perceptors }: { books: PartyBooks; perceptors: { contactId: string }[] }) {
  const missing = [...new Set(perceptors.map((p) => p.contactId))]
    .map((id) => books.contacts.get(id))
    .filter((c) => c && !c.province);
  if (missing.length === 0) return null;
  return (
    <Notice>
      <span>
        La provincia del perceptor es obligatoria y falta en{" "}
        {missing.length === 1 ? "este proveedor" : "estos proveedores"}:{" "}
        {missing.map((c, i) => (
          <span key={c!.id}>
            {i > 0 && ", "}
            <Link to={editContactPath("supplier", c!.id)} className="font-medium text-warning underline">
              {c!.name}
            </Link>
          </span>
        ))}
        .
      </span>
    </Notice>
  );
}

function Form111({ year, quarter, today }: { year: number; quarter: Quarter; today: Date }) {
  const books = usePartyBooks();
  const [showEmpty, setShowEmpty] = useState(false);
  const r = useMemo(() => model111(books.ops, year, quarter), [books, year, quarter]);
  const amount = cents(r.boxes["30"]!);

  const file = useAeatFile("111", year, quarter, (filer) => file111({ year, quarter, boxes: r.boxes }, filer));

  const result: ResultSummary = {
    label: "Resultado a ingresar [30]",
    amount,
    verdict: amount > 0 ? "A ingresar" : "Resultado cero",
    tone: amount > 0 ? "danger" : "neutral",
    detail:
      amount > 0
        ? `${r.perceptors.length === 1 ? "1 perceptor" : `${r.perceptors.length} perceptores`} con retención en el trimestre.`
        : "Sin retenciones: si estás dado de alta en el 111, preséntalo igualmente como «Sin actividad / resultado cero».",
  };

  return (
    <>
      <ResultPanel
        form="111"
        year={year}
        quarter={quarter}
        deadline={obligation("111", year, quarter).dueOn}
        today={today}
        result={result}
        file={file}
      />
      <MissingProvinces books={books} perceptors={r.perceptors} />
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold tracking-tight lg:text-title">Casillas del modelo 111</h2>
        <EmptyBoxesToggle checked={showEmpty} onChange={setShowEmpty} />
      </div>
      <FormSections sections={LAYOUT_111} boxes={r.boxes} countBoxes={COUNT_BOXES_111} showEmpty={showEmpty} />
      <section aria-label="Perceptores del trimestre" className="flex flex-col gap-3">
        <h2 className="m-0 text-lg font-semibold tracking-tight lg:text-title">Perceptores del trimestre</h2>
        <RecordsTable
          label="Perceptores del trimestre"
          columns={PERCEPTOR_COLUMNS}
          rows={perceptorRows(books, r.perceptors)}
          books={books}
          empty="No hay facturas recibidas con retención en este trimestre."
        />
      </section>
      <FormInfo form="111" />
      <Assumptions
        items={[
          "Solo declara las retenciones de las facturas recibidas que no son alquileres (esas van al 115). Si tienes trabajadores o pagas premios, añade sus retenciones a mano en la sede de la AEAT.",
          "Las facturas con la cuenta 6231 (servicios esporádicos: cursos, conferencias, seminarios) se declaran como rendimientos del trabajo; el resto, como actividades económicas.",
          "Cuenta la fecha de contabilización de cada factura recibida.",
          "La provincia del perceptor es obligatoria: si falta en la ficha del proveedor, complétala antes de presentar.",
          ONLY_RECORDED,
          "Se calcula como una única declaración, sin complementarias.",
        ]}
      />
    </>
  );
}

function Form190({ year, today }: { year: number; today: Date }) {
  const books = usePartyBooks();
  const r = useMemo(() => model190(books.ops, year), [books, year]);
  const paid = sumCents(r.paid);
  const mismatch = paid !== r.withholding;

  const result: ResultSummary = {
    label: "Total de retenciones del año",
    amount: r.withholding,
    verdict: "Informativo",
    tone: "neutral",
    detail:
      r.perceptors.length === 0
        ? "No tienes perceptores con retención este año."
        : `${r.perceptors.length === 1 ? "1 registro" : `${r.perceptors.length} registros`} · base ${formatEUR(r.base)}`,
  };

  return (
    <>
      <ResultPanel
        form="190"
        year={year}
        quarter={null}
        deadline={obligation("190", year, null).dueOn}
        today={today}
        result={result}
      />
      <QuarterCards
        form="111"
        year={year}
        today={today}
        values={r.paid}
        to={(q) => modelPath(WITHHOLDINGS_PATH, { year, quarter: q })}
      />
      {mismatch && (
        <Notice>
          Los 111 del año suman {formatEUR(paid)} y las retenciones de los perceptores {formatEUR(r.withholding)}. Si
          corregiste un 111 ya presentado, el 190 debe recoger lo realmente ingresado.
        </Notice>
      )}
      <MissingProvinces books={books} perceptors={r.perceptors} />
      <section aria-label="Perceptores del año" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 text-lg font-semibold tracking-tight lg:text-title">Perceptores</h2>
          <span className="text-xs text-muted-foreground">
            Clave{" "}
            {Object.entries(KEY_LABEL)
              .map(([k, v]) => `${k}: ${v.toLowerCase()}`)
              .join(" · ")}
          </span>
        </div>
        <RecordsTable
          label="Perceptores del año"
          columns={PERCEPTOR_COLUMNS}
          rows={perceptorRows(books, r.perceptors)}
          books={books}
          empty="No hay perceptores con retención este año."
        />
      </section>
      <FormInfo form="190" />
      <Assumptions
        items={[
          "Para actividades económicas en estimación directa (normal o simplificada) con criterio de devengo, distintas de las agrícolas, ganaderas, forestales y pesqueras.",
          "Solo recoge las retenciones de facturas recibidas. Las de trabajadores u otros perceptores se añaden a mano en la sede de la AEAT.",
          "Las facturas con la cuenta 6231 se declaran con la clave F (cursos y conferencias); el resto, con la clave G (actividades profesionales). La subclave sale del tipo de retención: G01 general, G02 profesionales en sus primeros años, G04 Ceuta y Melilla.",
          "Se calcula como una única declaración, sin complementarias ni sustitutivas.",
          "La provincia de cada perceptor es obligatoria: si falta en la ficha del proveedor, complétala antes de presentar.",
          ONLY_RECORDED,
        ]}
      />
    </>
  );
}

export function WithholdingsPage() {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const annual = period.quarter === null;

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <PageHeader
          eyebrow={<ModuleBreadcrumb module="withholdings" form={annual ? "190" : "111"} />}
          back={<TaxesBackLink />}
          title="Retenciones"
          descriptionClassName="max-lg:hidden"
          description={
            annual
              ? "Modelo 190: resumen anual de las retenciones practicadas, perceptor por perceptor."
              : "Modelo 111: lo que has retenido a los profesionales que te facturan, a ingresar en Hacienda."
          }
          actions={
            <>
              <FormSwitch
                value={annual ? "190" : "111"}
                onChange={(v) =>
                  setPeriod(v === "190" ? { year: period.year, quarter: null } : quarterOf(period.year, today))
                }
                options={[
                  { value: "111", label: "111 · Trimestral" },
                  { value: "190", label: "190 · Anual" },
                ]}
              />
              <PeriodSelect value={period} onChange={setPeriod} years={availableYears} today={today} />
            </>
          }
        />
        {period.quarter === null ? (
          <Form190 key={period.year} year={period.year} today={today} />
        ) : (
          <Form111 key={`${period.year}-${period.quarter}`} year={period.year} quarter={period.quarter} today={today} />
        )}
      </Page>
    </TooltipProvider>
  );
}

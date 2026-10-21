import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  cents,
  filingDeadline,
  isInPeriod,
  model303,
  model390,
  vatReturns,
  type Period,
  type Quarter,
} from "@cuentalibre/core";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { PeriodSelect } from "@/components/period-select";
import { deductible, PURCHASE_OPERATION_TYPES, purchaseTotals, supplierOf } from "@/features/purchases/purchases-model";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { PURCHASES_PATH } from "@/features/purchases/purchases-model";
import { clientOf, documentTotals, KINDS, OPERATION_TYPES } from "@/features/sales/sales-model";
import { useSalesDocuments } from "@/features/sales/sales-store";
import { useSettings } from "@/features/settings/settings-store";
import { usePeriod } from "@/lib/use-period";
import { availableYears } from "@/mocks/data";
import { useTaxBooks } from "./tax-books";
import {
  Assumptions,
  DocumentsPanel,
  EmptyBoxesToggle,
  FormAnswers,
  FormSections,
  FormSwitch,
  ResultPanel,
  useEditable,
  type DocumentGroup,
  type ResultSummary,
} from "./tax-form";
import {
  ACTIVITY_SCOPE,
  activities390,
  answers303,
  answers390,
  LAYOUT_303,
  LAYOUT_390,
  modelPath,
  ONLY_RECORDED,
  PERCENT_BOXES_303,
  quarterOf,
  VAT_PATH,
} from "./taxes-model";
import { FormInfo } from "./form-info";
import { ModuleBreadcrumb } from "./tax-intro";

const SALES_OPERATION = new Map(OPERATION_TYPES.map((o) => [o.value, o.label]));
const PURCHASE_OPERATION = new Map(PURCHASE_OPERATION_TYPES.map((o) => [o.value, o.label]));

function useVatDocuments(period: Period): DocumentGroup[] {
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  return useMemo(() => {
    const issued = documents
      .filter((d) => d.kind === "invoice" && isInPeriod(d.issuedOn, period))
      .sort((a, b) => a.issuedOn.localeCompare(b.issuedOn))
      .map((d) => {
        const totals = documentTotals(d);
        return {
          id: d.id,
          to: `${KINDS.invoice.path}/${d.id}`,
          date: d.issuedOn,
          number: d.number ?? "",
          contact: clientOf(d).name,
          tag: d.series === "rectifying" ? "Rectificativa" : SALES_OPERATION.get(d.operationType),
          amounts: [totals.base, totals.vat],
        };
      });
    const received = purchases
      .filter((p) => isInPeriod(p.bookedOn, period))
      .sort((a, b) => a.bookedOn.localeCompare(b.bookedOn))
      .map((p) => ({
        id: p.id,
        to: `${PURCHASES_PATH}/${p.id}`,
        date: p.bookedOn,
        number: p.number,
        contact: supplierOf(p).name,
        tag: p.rectifiesId ? "Abono" : PURCHASE_OPERATION.get(p.operationType),
        amounts: [purchaseTotals(p).base, deductible(p).vat],
      }));
    return [
      {
        key: "issued",
        label: "Emitidas",
        columns: ["Base", "IVA"],
        rows: issued,
        empty: "No hay facturas emitidas en este periodo.",
      },
      {
        key: "received",
        label: "Recibidas",
        columns: ["Base", "IVA deducible"],
        rows: received,
        empty: "No hay facturas recibidas en este periodo.",
      },
    ];
  }, [documents, purchases, period]);
}

function Vat303({ year, quarter, today }: { year: number; quarter: Quarter; today: Date }) {
  const books = useTaxBooks();
  const { tax } = useSettings();
  const [showEmpty, setShowEmpty] = useState(false);
  const [refund, setRefund] = useState(false);

  const computed = useMemo(() => vatReturns(books, year)[quarter - 1]!, [books, year, quarter]);
  // Box 110 can be corrected; the page remounts per period, so the correction doesn't carry over
  const [carry, carryBox] = useEditable(cents(computed.boxes["110"]!));
  const r = useMemo(() => model303(books, year, quarter, carry), [books, year, quarter, carry]);
  const documents = useVatDocuments({ year, quarter });

  const negative = r.result < 0;
  const result: ResultSummary = {
    label: "Resultado de la liquidación [71]",
    amount: cents(Math.abs(r.result)),
    verdict: !negative
      ? r.result > 0
        ? "A ingresar"
        : r.hasActivity
          ? "Resultado cero"
          : "Sin actividad"
      : quarter === 4 && refund
        ? "A devolver"
        : "A compensar",
    tone: r.result > 0 ? "danger" : negative ? "success" : "neutral",
    detail: negative
      ? quarter === 4
        ? refund
          ? "Hacienda te devolverá el importe."
          : "Lo descontarás en el 303 del próximo año."
        : "Lo descontarás en los siguientes trimestres."
      : r.boxes["78"]! > 0
        ? `Ya descuenta ${formatEUR(cents(r.boxes["78"]!))} de trimestres anteriores.`
        : undefined,
  };

  return (
    <>
      <ResultPanel
        form="303"
        year={year}
        quarter={quarter}
        deadline={filingDeadline(year, quarter)}
        today={today}
        result={result}
        extra={
          negative &&
          quarter === 4 && (
            <div className="mt-2">
              <FormSwitch
                value={refund ? "refund" : "offset"}
                onChange={(v) => setRefund(v === "refund")}
                options={[
                  { value: "offset", label: "A compensar" },
                  { value: "refund", label: "Solicitar devolución" },
                ]}
              />
            </div>
          )
        }
      />
      {r.unmappedBase !== 0 && (
        <p className="m-0 rounded-lg bg-warning-soft px-4 py-2.5 text-sm text-warning">
          Hay {formatEUR(r.unmappedBase)} de base con tipos de IVA que el modelo ya no tiene (2 %, 5 %, 7,5 % o
          históricos). No se incluyen: revisa esas facturas.
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-md font-semibold">Casillas del modelo 303</h2>
        <EmptyBoxesToggle checked={showEmpty} onChange={setShowEmpty} />
      </div>
      <FormAnswers title="Identificación" rows={answers303(tax)} />
      <FormSections
        sections={LAYOUT_303}
        boxes={r.boxes}
        percentBoxes={PERCENT_BOXES_303}
        showEmpty={showEmpty}
        editable={{ "110": carryBox }}
      />
      <DocumentsPanel title="Documentos del trimestre" groups={documents} />
      <FormInfo form="303" />
      <Assumptions
        items={[
          "Régimen general del IVA con criterio de devengo: cuenta la fecha de expedición de las facturas emitidas y la de contabilización de las recibidas.",
          "Sin prorrata, sin recargo de equivalencia desglosado y sin ventanilla única (OSS).",
          ACTIVITY_SCOPE,
          ONLY_RECORDED,
          "Si llevas los libros registro del IVA por el SII, o solo alquilas inmuebles urbanos y tributas en la península o Baleares (no en Navarra ni el País Vasco), no presentas el 390, pero en el 303 del 4T tienes que rellenar en la sede un apartado extra con el resumen del año.",
          "En las compras intracomunitarias y con inversión del sujeto pasivo se autorrepercute el IVA al 21 % y se deduce en la misma proporción que el resto del IVA de la factura.",
          "Solo se deduce el porcentaje de IVA imputado a la actividad en cada factura recibida. Los gastos sin factura no llevan IVA deducible.",
          "Se calcula como una única declaración, sin complementarias. Un 4T negativo se propone a compensar, como hace el formulario de la AEAT.",
        ]}
      />
    </>
  );
}

function Vat390({ year, today }: { year: number; today: Date }) {
  const books = useTaxBooks();
  const { tax } = useSettings();
  const [showEmpty, setShowEmpty] = useState(false);
  const r = useMemo(() => model390(books, year), [books, year]);
  const documents = useVatDocuments({ year, quarter: null });

  const result: ResultSummary = {
    label: "Resultado de la liquidación anual [86]",
    amount: r.result,
    verdict: "Informativo",
    tone: "neutral",
    detail: `Ingresado en los 303 del año: ${formatEUR(cents(r.boxes["95"]!))}`,
  };

  return (
    <>
      <ResultPanel
        form="390"
        year={year}
        quarter={null}
        deadline={filingDeadline(year, null)}
        today={today}
        result={result}
      />
      <section
        aria-label="Resultados de los 303 del año"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4"
      >
        {r.quarters.map((q, i) => (
          <Link
            key={i}
            to={modelPath(VAT_PATH, { year, quarter: (i + 1) as Quarter })}
            className="flex flex-col gap-1 bg-card px-4 py-3 text-foreground no-underline transition-colors duration-150 hover:bg-accent"
          >
            <span className="text-sm text-muted-foreground">303 · T{i + 1}</span>
            <span className="amount text-lg font-semibold">{formatEUR(q)}</span>
            <span className="text-xs text-muted-foreground">
              {q > 0 ? "A ingresar" : q < 0 ? "A compensar" : "Sin resultado"}
            </span>
          </Link>
        ))}
      </section>
      {r.unmappedBase !== 0 && (
        <p className="m-0 rounded-lg bg-warning-soft px-4 py-2.5 text-sm text-warning">
          Hay {formatEUR(r.unmappedBase)} de base con tipos de IVA que el modelo no recoge. Revisa esas facturas.
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-md font-semibold">Casillas del modelo 390</h2>
        <EmptyBoxesToggle checked={showEmpty} onChange={setShowEmpty} />
      </div>
      <FormAnswers title="Sujeto pasivo y devengo" rows={answers390(tax)} />
      <FormAnswers
        title="Datos estadísticos · Actividades económicas"
        rows={activities390(tax)}
        note="Ordenadas de mayor a menor volumen de operaciones, como en Configuración › Impuestos. Marca la casilla [D] solo si tienes que presentar el modelo 347. Los datos del representante se completan en la sede de la AEAT."
      />
      <FormSections sections={LAYOUT_390} boxes={r.boxes} showEmpty={showEmpty} />
      <DocumentsPanel title="Documentos del año" groups={documents} />
      <FormInfo form="390" />
      <Assumptions
        items={[
          "Resume todo el año: si empezaste a facturar antes de usar cuentalibre, registra también esas facturas.",
          "Las adquisiciones intracomunitarias de mercaderías (cuentas 600 y 602) se declaran como bienes; el resto, como servicios.",
          "Los datos estadísticos (actividad y epígrafe) y los del representante se completan en la sede de la AEAT.",
          "Si llevas el SII o solo alquilas inmuebles urbanos, no presentas el 390: en su lugar rellenas el apartado de información adicional del 303 del 4T.",
          "Revisa antes el 303 del 4T: sus resultados pasan a este resumen.",
          "Las actividades se listan de mayor a menor volumen de operaciones, en el orden de Configuración › Impuestos. Si no sabes en cuáles estás de alta, míralo en el modelo 036 o 037 que presentaste.",
          "El apartado de tributación conjunta con Navarra o el País Vasco solo se rellena si, además de tu domicilio en territorio común, tienes un establecimiento allí.",
          ACTIVITY_SCOPE,
          ONLY_RECORDED,
        ]}
      />
    </>
  );
}

export function VatPage() {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const annual = period.quarter === null;

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8 lg:pt-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <ModuleBreadcrumb module="vat" form={annual ? "390" : "303"} />
            <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">IVA</h1>
            <p className="m-0 text-sm text-muted-foreground">
              {annual
                ? "Modelo 390: resumen anual del IVA repercutido y soportado. Es informativo."
                : "Modelo 303: el IVA que has cobrado menos el que puedes deducir en el trimestre."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <FormSwitch
              value={annual ? "390" : "303"}
              onChange={(v) =>
                setPeriod(v === "390" ? { year: period.year, quarter: null } : quarterOf(period.year, today))
              }
              options={[
                { value: "303", label: "303 · Trimestral" },
                { value: "390", label: "390 · Anual" },
              ]}
            />
            <PeriodSelect value={period} onChange={setPeriod} years={availableYears} today={today} />
          </div>
        </header>
        {period.quarter === null ? (
          <Vat390 key={period.year} year={period.year} today={today} />
        ) : (
          <Vat303 key={`${period.year}-${period.quarter}`} year={period.year} quarter={period.quarter} today={today} />
        )}
      </div>
    </TooltipProvider>
  );
}

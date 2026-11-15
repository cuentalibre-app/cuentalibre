import { useMemo, useState } from "react";
import {
  aeatFiler,
  cents,
  earlierInstallments,
  file130,
  filingDeadline,
  incomeTaxYear,
  model130,
  recordBooksFileName,
  sumCents,
  type Quarter,
} from "@cuentalibre/core";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { HelpTip, Page, PageHeader } from "@/components/page";
import { PeriodSelect } from "@/components/period-select";
import { deductibleOf, EXPENSES_PATH, payeeOf } from "@/features/purchases/expenses-model";
import { useExpenses } from "@/features/purchases/expenses-store";
import { deductible, expenseTypeShortLabel, PURCHASES_PATH, supplierOf } from "@/features/purchases/purchases-model";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { clientOf, documentTotals, KINDS } from "@/features/sales/sales-model";
import { useSalesDocuments } from "@/features/sales/sales-store";
import { useSettings } from "@/features/settings/settings-store";
import { usePeriod } from "@/lib/use-period";
import { useAvailableYears } from "@/lib/use-available-years";
import { TAX_OPTIONS, useTaxBooks } from "./tax-books";
import {
  Assumptions,
  DocumentsPanel,
  EmptyBoxesToggle,
  FormAnswers,
  FormSections,
  FormSwitch,
  ResultPanel,
  useAeatFile,
  useEditable,
  type AeatFile,
  type DocumentGroup,
  type ResultSummary,
} from "./tax-form";
import { recordBooksFile } from "./record-books";
import { ACTIVITY_SCOPE, answers100, LAYOUT_130, layout100, ONLY_RECORDED, quarterOf } from "./taxes-model";
import { FormInfo } from "./form-info";
import { ModuleBreadcrumb, TaxesBackLink } from "./tax-intro";

/** Documents from January to the end of `lastMonth` (0-based) of a year. */
function useIncomeDocuments(year: number, lastMonth: number): DocumentGroup[] {
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  return useMemo(() => {
    const within = (date: string) => Number(date.slice(0, 4)) === year && Number(date.slice(5, 7)) - 1 <= lastMonth;
    const byDate = <T,>(rows: (T & { date: string })[]) => rows.sort((a, b) => a.date.localeCompare(b.date));
    return [
      {
        key: "income",
        label: "Ingresos",
        columns: ["Base", "Retención"],
        empty: "No hay facturas emitidas en este periodo.",
        rows: byDate(
          documents
            .filter((d) => d.kind === "invoice" && within(d.issuedOn))
            .map((d) => {
              const totals = documentTotals(d);
              return {
                id: d.id,
                to: `${KINDS.invoice.path}/${d.id}`,
                date: d.issuedOn,
                number: d.number ?? "",
                contact: clientOf(d).name,
                tag: d.series === "rectifying" ? "Rectificativa" : undefined,
                amounts: [totals.base, totals.withholding],
              };
            }),
        ),
      },
      {
        key: "purchases",
        label: "Facturas recibidas",
        columns: ["Gasto deducible"],
        empty: "No hay facturas recibidas en este periodo.",
        rows: byDate(
          purchases
            .filter((p) => within(p.bookedOn))
            .map((p) => ({
              id: p.id,
              to: `${PURCHASES_PATH}/${p.id}`,
              date: p.bookedOn,
              number: p.number,
              contact: supplierOf(p).name,
              tag: expenseTypeShortLabel(p.expenseType),
              amounts: [deductible(p).base],
            })),
        ),
      },
      {
        key: "expenses",
        label: "Gastos",
        columns: ["Gasto deducible"],
        empty: "No hay gastos en este periodo.",
        rows: byDate(
          expenses
            .filter((e) => within(e.date))
            .map((e) => ({
              id: e.id,
              to: `${EXPENSES_PATH}/${e.id}`,
              date: e.date,
              number: e.number,
              contact: payeeOf(e)?.name ?? e.concept,
              tag: expenseTypeShortLabel(e.expenseType),
              amounts: [deductibleOf(e)],
            })),
        ),
      },
    ];
  }, [documents, purchases, expenses, year, lastMonth]);
}

function IncomeTax130({ year, quarter, today }: { year: number; quarter: Quarter; today: Date }) {
  const books = useTaxBooks();
  const [showEmpty, setShowEmpty] = useState(false);
  const annual = useMemo(() => incomeTaxYear(books, year, TAX_OPTIONS), [books, year]);
  // Box 05 subtracts the positive installments of the earlier quarters, as filed or computed
  const previous = useMemo(
    () => earlierInstallments(books, annual.quarters, year, quarter),
    [books, annual, year, quarter],
  );
  const [paid, paidBox] = useEditable(sumCents(previous.filter((p) => p > 0)));
  const [reduction, reductionBox] = useEditable(cents(0));
  const [negativeCarry, negativeBox] = useEditable(cents(0));
  const [mortgage, mortgageBox] = useEditable(cents(0));

  const r = useMemo(
    () => model130(books, year, quarter, TAX_OPTIONS, previous, { paid, reduction, negativeCarry, mortgage }),
    [books, year, quarter, previous, paid, reduction, negativeCarry, mortgage],
  );
  const documents = useIncomeDocuments(year, quarter * 3 - 1);

  const result: ResultSummary = {
    label: "Resultado de la declaración [19]",
    amount: cents(Math.max(0, r.result)),
    verdict: r.result > 0 ? "A ingresar" : "Negativa",
    tone: r.result > 0 ? "danger" : "neutral",
    detail:
      r.result > 0
        ? "20 % del rendimiento acumulado, menos retenciones y pagos anteriores."
        : r.result < 0
          ? `Sale ${formatEUR(r.result)}: se presenta como negativa y no pagas nada.`
          : "Se presenta igualmente, aunque no haya que pagar.",
  };

  const file = useAeatFile("130", year, quarter, (filer) => file130(r, filer));

  return (
    <>
      <ResultPanel
        form="130"
        year={year}
        quarter={quarter}
        deadline={filingDeadline(year, quarter)}
        today={today}
        result={result}
        file={file}
      />
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold tracking-tight">Casillas del modelo 130</h2>
        <EmptyBoxesToggle checked={showEmpty} onChange={setShowEmpty} />
      </div>
      <FormSections
        sections={LAYOUT_130.map((s, i) =>
          i === 0 && r.hardToJustify > 0
            ? {
                ...s,
                rows: s.rows.map((row) =>
                  row.cells[0] === "02"
                    ? {
                        ...row,
                        hint: `Incluye ${formatEUR(r.hardToJustify)} de gastos de difícil justificación (5 %, máximo 2.000 € al año).`,
                      }
                    : row,
                ),
              }
            : s,
        )}
        boxes={r.boxes}
        showEmpty={showEmpty}
        editable={{ "05": paidBox, "13": reductionBox, "15": negativeBox, "16": mortgageBox }}
      />
      <DocumentsPanel title="Documentos desde el 1 de enero" groups={documents} />
      <FormInfo form="130" />
      <Assumptions
        items={[
          "Estimación directa con criterio de devengo: las cifras se acumulan desde el 1 de enero hasta el final del trimestre.",
          TAX_OPTIONS.simplified
            ? "Estimación directa simplificada: los gastos incluyen un 5 % de gastos de difícil justificación, con un máximo de 2.000 € al año."
            : "Estimación directa normal: no se añaden gastos de difícil justificación.",
          annual.previousNet === null
            ? "La minoración de la casilla 13 queda a cero: indícala a mano si te corresponde."
            : annual.suggestedReduction > 0
              ? `La minoración de la casilla 13 queda a cero: indícala a mano si quieres aplicarla. Con tu rendimiento neto de ${year - 1} (${formatEUR(annual.previousNet)}) te corresponderían ${formatEUR(annual.suggestedReduction)} por trimestre.`
              : `La minoración de la casilla 13 queda a cero: con tu rendimiento neto de ${year - 1} (${formatEUR(annual.previousNet)}) no te corresponde.`,
          "Las facturas recibidas y los gastos cuentan por su parte deducible. La cuota de autónomos cuenta como gasto.",
          "Si más del 70 % de tus ingresos llevan retención puedes pedir no presentar el 130 (modelo 036 o 037).",
          ACTIVITY_SCOPE,
          ONLY_RECORDED,
          "Se calcula como una única declaración, sin complementarias.",
        ]}
      />
    </>
  );
}

/** The record books Renta WEB imports, for the year and the main activity. */
function useRecordBooks(year: number): AeatFile {
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  const { profile, tax } = useSettings();
  const activity = tax.activities[0];
  const blob = useMemo(
    () => (activity ? recordBooksFile(documents, purchases, expenses, year, activity) : null),
    [documents, purchases, expenses, year, activity],
  );
  const filer = aeatFiler(profile);
  return {
    name: filer ? recordBooksFileName(year, filer) : "",
    label: "Libros para Renta WEB",
    build: () => blob!,
    missing: !filer
      ? "Para generar los libros, completa tu NIF, nombre y apellidos en Configuración › Datos personales."
      : !activity
        ? "Para generar los libros, añade tu actividad económica en Configuración › Impuestos."
        : undefined,
  };
}

function IncomeTax100({ year, today }: { year: number; today: Date }) {
  const books = useTaxBooks();
  const { tax } = useSettings();
  const file = useRecordBooks(year);
  const [showEmpty, setShowEmpty] = useState(false);
  const { annual } = useMemo(() => incomeTaxYear(books, year, TAX_OPTIONS), [books, year]);
  const documents = useIncomeDocuments(year, 11);
  const paid = cents(annual.boxes["0598"]! + annual.boxes["0599"]! + annual.boxes["0604"]!);

  const result: ResultSummary = {
    label: "Rendimiento neto de la actividad [0224]",
    amount: annual.netIncome,
    verdict: "Para la renta",
    tone: "neutral",
    detail: `Retenciones y pagos a cuenta: ${formatEUR(paid)}`,
  };

  return (
    <>
      <ResultPanel
        form="100"
        year={year}
        quarter={null}
        deadline={null}
        deadlineText={`Campaña de la renta ${year}: de abril a finales de junio de ${year + 1}`}
        today={today}
        result={result}
        file={file}
      />
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold tracking-tight">Apartado D1 y pagos a cuenta</h2>
        <EmptyBoxesToggle checked={showEmpty} onChange={setShowEmpty} />
      </div>
      <FormAnswers title="Actividades realizadas" rows={answers100(tax)} />
      <FormSections sections={layout100(TAX_OPTIONS.simplified)} boxes={annual.boxes} showEmpty={showEmpty} />
      <DocumentsPanel title="Documentos del año" groups={documents} />
      <FormInfo form="100" />
      <Assumptions
        items={[
          "Solo el apartado de la actividad económica (D1) y sus retenciones: el resto de la renta (trabajo, ahorro, deducciones…) se completa en Renta WEB.",
          "Una sola actividad. Cada gasto va a la casilla que le corresponde por su tipo de gasto.",
          "La reducción por inicio de actividad y las de discapacidad no se aplican: márcalas en Renta WEB si te corresponden (la de discapacidad, en las casillas 0231 a 0235).",
          "La casilla 0165 (quién realiza la actividad) la rellena Renta WEB al elegir la modalidad, después de indicar el código de actividad en la 0166.",
          ACTIVITY_SCOPE,
          ONLY_RECORDED,
        ]}
      />
    </>
  );
}

export function IncomeTaxPage() {
  const availableYears = useAvailableYears();
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const annual = period.quarter === null;

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <PageHeader
          eyebrow={<ModuleBreadcrumb module="incomeTax" form={annual ? "100" : "130"} />}
          back={<TaxesBackLink />}
          title="IRPF"
          inline={
            <HelpTip side="bottom">
              {annual
                ? "Modelo 100: lo que tu actividad aporta a la declaración de la renta."
                : "Modelo 130: pago a cuenta del 20 % de lo que llevas ganado en el año."}
            </HelpTip>
          }
          actions={
            <>
              <FormSwitch
                value={annual ? "100" : "130"}
                onChange={(v) =>
                  setPeriod(v === "100" ? { year: period.year, quarter: null } : quarterOf(period.year, today))
                }
                options={[
                  { value: "130", label: "130 · Trimestral" },
                  { value: "100", label: "100 · Anual" },
                ]}
              />
              <PeriodSelect value={period} onChange={setPeriod} years={availableYears} today={today} />
            </>
          }
        />
        {period.quarter === null ? (
          <IncomeTax100 key={period.year} year={period.year} today={today} />
        ) : (
          <IncomeTax130
            key={`${period.year}-${period.quarter}`}
            year={period.year}
            quarter={period.quarter}
            today={today}
          />
        )}
      </Page>
    </TooltipProvider>
  );
}

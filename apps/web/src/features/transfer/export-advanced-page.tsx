import { useMemo, useState } from "react";
import { periodMonths, type Period } from "@cuentalibre/core";
import { Input } from "@cuentalibre/ui/components/input";
import { PeriodSelect } from "@/components/period-select";
import { useContacts } from "@/features/contacts/contacts-store";
import { useExpenses } from "@/features/purchases/expenses-store";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { CheckField } from "@/features/sales/form-fields";
import { useSalesDocuments } from "@/features/sales/sales-store";
import { periodCode, periodLabel } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { downloadSheets, type SpreadsheetFormat } from "@/lib/xlsx";
import { availableYears } from "@/mocks/data";
import { advancedSheets, type AdvancedOptions, type DateRange } from "./export-data";
import { ExportButton, FormatField, PageShell, Panel } from "./transfer-parts";
import { EXPORT_PATH } from "./transfer-model";

const pad = (n: number) => String(n).padStart(2, "0");

/** First and last day of a quarter or year. */
function periodRange(period: Period): DateRange {
  const months = periodMonths(period);
  const first = months[0]!;
  const last = months.at(-1)!;
  const lastDay = new Date(Date.UTC(period.year, last + 1, 0)).getUTCDate();
  return { from: `${period.year}-${pad(first + 1)}-01`, to: `${period.year}-${pad(last + 1)}-${pad(lastDay)}` };
}

type Toggle = Exclude<keyof AdvancedOptions, "quotes" | "deliveryNotes"> | "quotesOn" | "deliveryNotesOn";

export function ExportAdvancedPage() {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  const clients = useContacts("client");
  const suppliers = useContacts("supplier");
  const [format, setFormat] = useState<SpreadsheetFormat>("xlsx");
  const [checks, setChecks] = useState<Record<Toggle, boolean>>({
    invoices: true,
    invoiceDetail: false,
    payments: false,
    amortizations: false,
    expenses: false,
    quotesOn: false,
    quoteDetail: false,
    deliveryNotesOn: false,
    deliveryNoteDetail: false,
    contacts: false,
  });
  const yearRange = { from: `${period.year}-01-01`, to: `${period.year}-12-31` };
  const [quotes, setQuotes] = useState<DateRange>(yearRange);
  const [deliveryNotes, setDeliveryNotes] = useState<DateRange>(yearRange);

  const set = (key: Toggle) => (value: boolean) => setChecks((c) => ({ ...c, [key]: value }));
  const nothing = !Object.entries(checks).some(
    ([k, v]) => v && !["invoiceDetail", "payments", "quoteDetail", "deliveryNoteDetail"].includes(k),
  );
  const badRange = (r: DateRange) => !r.from || !r.to || r.from > r.to;
  const invalid =
    nothing || (checks.quotesOn && badRange(quotes)) || (checks.deliveryNotesOn && badRange(deliveryNotes));

  const run = () => {
    const options: AdvancedOptions = {
      ...checks,
      quotes: checks.quotesOn ? quotes : null,
      deliveryNotes: checks.deliveryNotesOn ? deliveryNotes : null,
    };
    const sheets = advancedSheets(
      { documents, purchases, expenses, clients, suppliers },
      options,
      periodRange(period),
      today,
    );
    downloadSheets(sheets, format, `exportacion-${periodCode(period)}`.toLowerCase());
  };

  return (
    <PageShell
      title="Exportación avanzada"
      back={{ to: EXPORT_PATH, label: "exportaciones" }}
      actions={<PeriodSelect value={period} onChange={setPeriod} years={availableYears} today={today} />}
    >
      <Panel
        title="Selecciona la información a exportar"
        description={
          <>
            Facturas, amortizaciones y gastos del periodo elegido arriba:{" "}
            <strong className="font-semibold text-foreground">{periodLabel(period)}</strong>.
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <CheckField
            label="Listado de facturas (emitidas, recibidas y bienes de inversión)"
            checked={checks.invoices}
            onChange={set("invoices")}
          />
          <Indented>
            <CheckField
              label="Incluir el detalle de las facturas"
              hint="Una hoja con cada concepto de cada factura."
              checked={checks.invoiceDetail}
              disabled={!checks.invoices}
              onChange={set("invoiceDetail")}
            />
            <CheckField
              label="Incluir el detalle de los pagos y cobros"
              checked={checks.payments}
              disabled={!checks.invoices}
              onChange={set("payments")}
            />
          </Indented>
          <CheckField
            label="Listado de amortizaciones de bienes de inversión"
            checked={checks.amortizations}
            onChange={set("amortizations")}
          />
          <CheckField label="Listado de gastos" checked={checks.expenses} onChange={set("expenses")} />
          <CheckField label="Presupuestos entre las fechas" checked={checks.quotesOn} onChange={set("quotesOn")} />
          <Indented>
            <RangeFields value={quotes} onChange={setQuotes} disabled={!checks.quotesOn} label="presupuestos" />
            <CheckField
              label="Incluir el detalle de los presupuestos"
              checked={checks.quoteDetail}
              disabled={!checks.quotesOn}
              onChange={set("quoteDetail")}
            />
          </Indented>
          <CheckField
            label="Albaranes entre las fechas"
            checked={checks.deliveryNotesOn}
            onChange={set("deliveryNotesOn")}
          />
          <Indented>
            <RangeFields
              value={deliveryNotes}
              onChange={setDeliveryNotes}
              disabled={!checks.deliveryNotesOn}
              label="albaranes"
            />
            <CheckField
              label="Incluir el detalle de los albaranes"
              checked={checks.deliveryNoteDetail}
              disabled={!checks.deliveryNotesOn}
              onChange={set("deliveryNoteDetail")}
            />
          </Indented>
          <CheckField label="Listado de clientes y proveedores" checked={checks.contacts} onChange={set("contacts")} />
        </div>

        <FormatField value={format} onChange={setFormat} />
        {nothing && <p className="m-0 text-sm text-muted-foreground">Marca al menos un listado.</p>}
        <ExportButton onClick={run} disabled={invalid} />
      </Panel>
    </PageShell>
  );
}

function Indented({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 pl-7.5">{children}</div>;
}

function RangeFields({
  value,
  onChange,
  disabled,
  label,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  disabled: boolean;
  label: string;
}) {
  const invalid = !disabled && value.from && value.to && value.from > value.to;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Desde</span>
        <Input
          type="date"
          aria-label={`Fecha inicial de los ${label}`}
          value={value.from}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="w-auto"
        />
        <span>Hasta</span>
        <Input
          type="date"
          aria-label={`Fecha final de los ${label}`}
          value={value.to}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="w-auto"
        />
      </div>
      {invalid && <p className="m-0 text-xs text-destructive">La fecha inicial es posterior a la final.</p>}
    </div>
  );
}

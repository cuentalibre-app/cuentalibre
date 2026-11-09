import { useState } from "react";
import { Calendar } from "lucide-react";
import { useExpenses } from "@/features/purchases/expenses-store";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { GroupedSelect } from "@/features/sales/form-fields";
import { useSalesDocuments } from "@/features/sales/sales-store";
import { downloadSheets, type SpreadsheetFormat } from "@/lib/xlsx";
import { availableYears } from "@/mocks/data";
import { incomeTaxBooks, unifiedBooks, vatBooks } from "./export-data";
import { ExportButton, FormatField, PageShell, Panel, RadioOption } from "./transfer-parts";
import { EXPORT_PATH } from "./transfer-model";

type OldBook = "vat" | "incomeTax";

export function ExportBooksPage() {
  const documents = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  const [year, setYear] = useState(() => availableYears[0] ?? new Date().getFullYear());
  const [format, setFormat] = useState<SpreadsheetFormat>("xlsx");
  const [oldFormat, setOldFormat] = useState<SpreadsheetFormat>("xlsx");
  const [oldBook, setOldBook] = useState<OldBook>("incomeTax");

  return (
    <PageShell
      title="Exportación de libros de registro"
      back={{ to: EXPORT_PATH, label: "exportaciones" }}
      actions={
        <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Calendar className="size-4" strokeWidth={1.8} aria-hidden="true" />
          Ejercicio
          <GroupedSelect
            id="books-year"
            value={String(year)}
            onChange={(v) => setYear(Number(v))}
            groups={[{ options: availableYears.map((y) => ({ value: String(y), label: String(y) })) }]}
            className="w-28 text-foreground"
          />
        </label>
      }
    >
      <Panel
        title="Libros de registro de IVA e IRPF"
        description={
          <>
            Los libros registro oficiales que tendrías que presentar si Hacienda te inspecciona el IVA o el IRPF:
            ingresos, gastos (facturas recibidas y gastos sin factura) y bienes de inversión con su amortización, del
            ejercicio <strong className="font-semibold text-foreground">{year}</strong>.
          </>
        }
      >
        <FormatField value={format} onChange={setFormat} />
        <ExportButton
          onClick={() =>
            downloadSheets(unifiedBooks(documents, purchases, expenses, year), format, `libros-registro-${year}`)
          }
        />
      </Panel>

      <Panel
        index={1}
        title="Libros de registro en formato antiguo"
        description={`Los libros por separado, como se llevaban antes del formato único. Ejercicio ${year}.`}
      >
        <div role="radiogroup" aria-label="Libro" className="flex flex-col gap-3">
          <RadioOption
            name="old-book"
            checked={oldBook === "vat"}
            onChange={() => setOldBook("vat")}
            label="Libro de facturas emitidas, facturas recibidas y bienes de inversión (para el IVA)"
          />
          <RadioOption
            name="old-book"
            checked={oldBook === "incomeTax"}
            onChange={() => setOldBook("incomeTax")}
            label="Libro de ingresos y gastos (para el IRPF)"
          />
        </div>
        <FormatField value={oldFormat} onChange={setOldFormat} />
        <ExportButton
          onClick={() =>
            oldBook === "vat"
              ? downloadSheets(vatBooks(documents, purchases, year), oldFormat, `libros-iva-${year}`)
              : downloadSheets(
                  incomeTaxBooks(documents, purchases, expenses, year),
                  oldFormat,
                  `libro-ingresos-gastos-${year}`,
                )
          }
        />
      </Panel>

      <p className="m-0 text-sm text-muted-foreground">
        El Excel se abre en Excel, LibreOffice Calc, Numbers o Google Sheets. Con CSV, cada libro va en su propio
        archivo dentro de un .zip, separado por punto y coma y con coma decimal.
      </p>
    </PageShell>
  );
}

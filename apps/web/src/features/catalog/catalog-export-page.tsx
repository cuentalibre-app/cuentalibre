import { useState } from "react";
import { toIsoDate } from "@cuentalibre/core";
import { ExportButton, FormatField, PageShell, Panel } from "@/features/transfer/transfer-parts";
import { downloadSheets, type SpreadsheetFormat } from "@/lib/xlsx";
import { PRODUCTS_PATH } from "./catalog-model";
import { useCatalog } from "./catalog-store";
import { catalogSheet } from "./catalog-transfer";

export function CatalogExportPage() {
  const state = useCatalog();
  const [format, setFormat] = useState<SpreadsheetFormat>("xlsx");
  const count = state.products.length;

  return (
    <PageShell title="Exportar catálogo" back={{ to: PRODUCTS_PATH, label: "productos" }}>
      <Panel
        title="Exportación de catálogo"
        description={
          count === 0
            ? "Tu catálogo está vacío."
            : `${count === 1 ? "1 producto" : `${count} productos`} con sus familias, precios, costes, campos personalizados y stock. El archivo tiene las mismas columnas que la importación, así que puedes editarlo y volver a importarlo.`
        }
      >
        <FormatField value={format} onChange={setFormat} />
        <ExportButton
          disabled={count === 0}
          onClick={() => downloadSheets([catalogSheet(state)], format, `catalogo-${toIsoDate(new Date())}`)}
        />
      </Panel>
    </PageShell>
  );
}

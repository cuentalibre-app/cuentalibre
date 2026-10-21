import { useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router";
import { CircleAlert, CircleCheck, FileSpreadsheet, Info, List, TriangleAlert } from "lucide-react";
import { eurosToCents } from "@cuentalibre/core";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { DropZone } from "@/features/transfer/import-page";
import { PageShell } from "@/features/transfer/transfer-parts";
import { SpreadsheetError, downloadSheets, readSpreadsheet } from "@/lib/xlsx";
import { PRODUCTS_PATH, formatQuantity } from "./catalog-model";
import {
  IMPORT_KIND_OPTIONS,
  commitCatalogImport,
  previewCatalogImport,
  sampleSheets,
  type CatalogImportKind,
  type CatalogImportPreview,
} from "./catalog-transfer";

export function CatalogImportPage() {
  const [params, setParams] = useSearchParams();
  const kind: CatalogImportKind = params.get("tipo") === "stock" ? "productsStock" : "products";
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CatalogImportPreview | null>(null);
  const [reading, setReading] = useState(false);
  const [done, setDone] = useState<{ created: number; updated: number } | null>(null);

  const setKind = (next: CatalogImportKind) => {
    setParams(next === "productsStock" ? { tipo: "stock" } : {}, { replace: true });
    setPreview(null);
    setError(null);
  };

  const pick = (picked: File | null) => {
    setFile(picked);
    setPreview(null);
    setError(null);
    setDone(null);
  };

  const read = async () => {
    if (!file) {
      setError("Elige primero el archivo que quieres importar.");
      return;
    }
    setReading(true);
    try {
      setPreview(previewCatalogImport(kind, await readSpreadsheet(file)));
      setError(null);
    } catch (e) {
      setPreview(null);
      setError(e instanceof SpreadsheetError ? e.message : "No se ha podido leer el archivo.");
    } finally {
      setReading(false);
    }
  };

  const confirm = () => {
    if (!preview) return;
    setDone(commitCatalogImport(preview));
    setPreview(null);
    setFile(null);
  };

  const label = IMPORT_KIND_OPTIONS.find((o) => o.value === kind)!.label;

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <PageShell
        title="Importar productos o servicios"
        back={{ to: PRODUCTS_PATH, label: "productos" }}
        actions={
          <Link to={PRODUCTS_PATH} className={cn(buttonVariants({ variant: "secondary" }), "no-underline")}>
            <List strokeWidth={1.8} aria-hidden="true" />
            Listar elementos del catálogo
          </Link>
        }
      >
        <div
          className="flex animate-rise-in gap-3 rounded-xl bg-primary-soft px-4 py-3.5 text-sm text-primary"
          role="note"
        >
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <p className="m-0">
            Importa un Excel (.xlsx) o un CSV con las mismas columnas que Contasimple. Elige el tipo de datos, arrastra
            el archivo al recuadro y pulsa <strong>Continuar</strong>: verás lo que se va a importar antes de
            confirmarlo. Si el código de producto de una fila ya existe en tu catálogo, se actualiza ese producto.
          </p>
        </div>

        {done && (
          <div
            role="status"
            className="flex animate-rise-in flex-wrap items-center gap-3 rounded-xl bg-success-soft px-4 py-3.5 text-sm text-success"
          >
            <CircleCheck className="size-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <span className="flex-1">
              {[
                done.created && (done.created === 1 ? "1 producto nuevo" : `${done.created} productos nuevos`),
                done.updated && (done.updated === 1 ? "1 actualizado" : `${done.updated} actualizados`),
              ]
                .filter(Boolean)
                .join(" y ")}
              .
            </span>
            <Link to={PRODUCTS_PATH} className="font-medium text-success underline underline-offset-2">
              Ver el catálogo
            </Link>
          </div>
        )}

        <section
          className="flex animate-rise-in flex-col gap-5 rounded-xl border border-border bg-card p-5 text-card-foreground"
          style={{ "--i": 1 } as CSSProperties}
        >
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <Field label="Elige el tipo de datos a importar" className="w-full max-w-md">
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={kind}
                  onChange={(v) => setKind(v as CatalogImportKind)}
                  groups={[{ options: IMPORT_KIND_OPTIONS }]}
                />
              )}
            </Field>
            <button
              type="button"
              onClick={() =>
                downloadSheets(
                  sampleSheets(kind),
                  "xlsx",
                  kind === "productsStock" ? "plantilla-catalogo-con-stock" : "plantilla-catalogo",
                )
              }
              className="flex h-10 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-sm font-medium text-primary hover:text-primary-hover"
            >
              <FileSpreadsheet className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              Descargar Excel de ejemplo para {label.toLowerCase()}
            </button>
          </div>

          <DropZone file={file} onPick={pick} />

          {error && (
            <p role="alert" className="m-0 flex items-center gap-2 text-sm text-destructive">
              <CircleAlert className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              {error}
            </p>
          )}

          <Button className="self-center" onClick={read} disabled={reading}>
            <CircleCheck strokeWidth={1.8} aria-hidden="true" />
            {reading ? "Leyendo…" : "Continuar"}
          </Button>
        </section>

        {preview && <Preview preview={preview} onConfirm={confirm} onCancel={() => setPreview(null)} />}
      </PageShell>
    </TooltipProvider>
  );
}

function Preview({
  preview,
  onConfirm,
  onCancel,
}: {
  preview: CatalogImportPreview;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const valid = preview.rows.filter((r) => r.errors.length === 0);
  const invalid = preview.rows.length - valid.length;
  const updates = valid.filter((r) => r.updates).length;
  const withStock = preview.kind === "productsStock";

  if (preview.fileErrors.length)
    return (
      <section className="flex animate-rise-in flex-col gap-2 rounded-xl border border-destructive bg-destructive-soft/40 p-5">
        <h2 className="m-0 flex items-center gap-2 text-md font-semibold text-destructive">
          <CircleAlert className="size-5" strokeWidth={1.8} aria-hidden="true" />
          No se puede importar el archivo
        </h2>
        {preview.fileErrors.map((e) => (
          <p key={e} className="m-0 text-sm">
            {e}
          </p>
        ))}
      </section>
    );

  return (
    <section
      aria-label="Vista previa de la importación"
      className="flex animate-rise-in flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5">
        <h2 className="m-0 text-md font-semibold">Vista previa</h2>
        <span className="text-sm">
          <span className="font-semibold">{valid.length}</span>{" "}
          {valid.length === 1 ? "producto listo" : "productos listos"} para importar
          {updates > 0 && ` (${updates} ${updates === 1 ? "actualiza uno existente" : "actualizan existentes"})`}
        </span>
        {invalid > 0 && (
          <span className="text-sm text-destructive">
            {invalid} con errores {invalid === 1 ? "no se importará" : "no se importarán"}
          </span>
        )}
        {preview.newFamilies > 0 && (
          <span className="text-sm text-muted-foreground">
            Se {preview.newFamilies === 1 ? "creará 1 familia nueva" : `crearán ${preview.newFamilies} familias nuevas`}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className={table.headRow}>
              <th scope="col" className={table.th}>
                Fila
              </th>
              <th scope="col" className={table.th}>
                Nombre
              </th>
              <th scope="col" className={table.th}>
                Código
              </th>
              <th scope="col" className={cn(table.th, "text-right")}>
                Precio
              </th>
              {withStock && (
                <th scope="col" className={cn(table.th, "text-right")}>
                  Stock
                </th>
              )}
              <th scope="col" className={table.th}>
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((r) => {
              const ok = r.errors.length === 0;
              return (
                <tr key={r.row} className={cn(table.row, !ok && "bg-destructive-soft/40")}>
                  <td className={cn(table.td, "font-mono text-sm text-muted-foreground")}>{r.row}</td>
                  <td className={table.td}>{r.name || "—"}</td>
                  <td className={cn(table.td, "font-mono text-sm")}>{r.sku || "—"}</td>
                  <td className={cn(table.td, "text-right amount")}>
                    {r.price === null ? "—" : formatEUR(eurosToCents(r.price))}
                  </td>
                  {withStock && (
                    <td className={cn(table.td, "text-right amount")}>
                      {r.stockChange ? `${r.stockChange > 0 ? "+" : ""}${formatQuantity(r.stockChange)}` : "—"}
                    </td>
                  )}
                  <td className={table.td}>
                    {ok ? (
                      <span className="flex items-center gap-2">
                        <Badge tone={r.updates ? "primary" : "success"}>{r.updates ? "Actualiza" : "Nuevo"}</Badge>
                        {r.warnings.length > 0 && <Warnings warnings={r.warnings} />}
                      </span>
                    ) : (
                      <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-sm text-destructive">
                        {r.errors.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border px-4 py-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={onConfirm} disabled={valid.length === 0}>
          Importar {valid.length} {valid.length === 1 ? "producto" : "productos"}
        </Button>
      </div>
    </section>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="flex cursor-default items-center gap-1 text-xs font-medium text-warning">
          <TriangleAlert className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          {warnings.length} {warnings.length === 1 ? "aviso" : "avisos"}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-80">
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

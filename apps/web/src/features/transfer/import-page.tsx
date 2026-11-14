import { useRef, useState, type CSSProperties, type DragEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { CircleAlert, CircleCheck, FileSpreadsheet, Info, TriangleAlert, Upload, X } from "lucide-react";
import { sumBy } from "@cuentalibre/core";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { useLockedQuarter } from "@/features/closing/closing-store";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { formatDate } from "@/lib/format";
import { SpreadsheetError, downloadBlob, readSpreadsheet, xlsxBlob } from "@/lib/xlsx";
import { IMPORT_KINDS, commitImport, previewImport, type ImportKind, type ImportPreview } from "./import-model";
import { PageShell } from "./transfer-parts";

const KIND_ORDER: ImportKind[] = ["sales", "purchases", "expenses"];
const ACCEPT = ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

function kindFromParam(param: string | null): ImportKind {
  return KIND_ORDER.find((k) => IMPORT_KINDS[k].param === param) ?? "sales";
}

export function ImportPage() {
  const [params, setParams] = useSearchParams();
  const kind = kindFromParam(params.get("tipo"));
  const config = IMPORT_KINDS[kind];
  const isLocked = useLockedQuarter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [reading, setReading] = useState(false);
  const [imported, setImported] = useState<{ kind: ImportKind; count: number; contacts: number } | null>(null);

  const setKind = (next: ImportKind) => {
    setParams({ tipo: IMPORT_KINDS[next].param }, { replace: true, preventScrollReset: true });
    setPreview(null);
    setError(null);
  };

  const pick = (picked: File | null) => {
    setFile(picked);
    setPreview(null);
    setError(null);
    setImported(null);
  };

  const read = async () => {
    if (!file) {
      setError("Elige primero el archivo que quieres importar.");
      return;
    }
    setReading(true);
    try {
      const rows = await readSpreadsheet(file);
      setPreview(previewImport(kind, rows, { isLocked }));
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
    const valid = preview.items.filter((i) => i.errors.length === 0);
    const names = new Set(valid.map((i) => i.contactName));
    const contacts = preview.newContacts.filter((c) => names.has(c.name)).length;
    const count = commitImport(preview);
    setImported({ kind, count, contacts });
    setPreview(null);
    setFile(null);
  };

  const downloadSample = () =>
    downloadBlob(
      xlsxBlob([{ name: config.label, header: config.columns, rows: config.sample }]),
      `${config.sampleName}.xlsx`,
    );

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <PageShell title="Importación de facturas y gastos">
        <div className="flex animate-rise-in gap-2 rounded-xl bg-primary-soft px-3.5 py-3 text-sm" role="note">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.8} aria-hidden="true" />
          <p className="m-0">
            Importa un Excel (.xlsx) o un CSV con las columnas de la plantilla. Elige el tipo de datos, descarga la
            plantilla si no la tienes, sube el archivo y pulsa <strong>Continuar</strong>: verás lo que se va a importar
            antes de confirmarlo. Las facturas con varios conceptos ocupan una fila por concepto con el mismo número.
          </p>
        </div>

        {imported && (
          <div
            role="status"
            className="flex animate-rise-in flex-wrap gap-2 rounded-xl bg-success-soft px-3.5 py-3 text-sm"
          >
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={1.8} aria-hidden="true" />
            <span className="flex-1">
              {imported.count === 1
                ? `Se ha importado 1 ${IMPORT_KINDS[imported.kind].noun[0]}`
                : `Se han importado ${imported.count} ${IMPORT_KINDS[imported.kind].noun[1]}`}
              {imported.contacts > 0 &&
                ` y ${imported.contacts === 1 ? "1 contacto nuevo" : `${imported.contacts} contactos nuevos`}`}
              .
            </span>
            <Link to={IMPORT_KINDS[imported.kind].listPath} className={buttonVariants({ variant: "link" })}>
              Ver {IMPORT_KINDS[imported.kind].listLabel}
            </Link>
          </div>
        )}

        <section
          className="flex animate-rise-in flex-col gap-5 surface p-5 text-card-foreground"
          style={{ "--i": 1 } as CSSProperties}
        >
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <Field label="Elige el tipo de datos a importar" className="w-full max-w-sm">
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={kind}
                  onChange={(v) => setKind(v as ImportKind)}
                  groups={[{ options: KIND_ORDER.map((k) => ({ value: k, label: IMPORT_KINDS[k].label })) }]}
                />
              )}
            </Field>
            <Button variant="secondary" onClick={downloadSample}>
              <FileSpreadsheet strokeWidth={1.8} aria-hidden="true" />
              Descargar Excel de ejemplo
            </Button>
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

export function DropZone({ file, onPick }: { file: File | null; onPick: (file: File | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const picked = e.dataTransfer.files[0];
    if (picked) onPick(picked);
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cn(
        "flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors duration-150",
        over ? "border-primary bg-primary-soft" : "border-border",
      )}
    >
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {file ? (
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet className="size-5 text-primary" strokeWidth={1.8} aria-hidden="true" />
          <span className="font-medium">{file.name}</span>
          <span className="text-sm text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</span>
          <Button variant="ghost" size="icon-sm" aria-label="Quitar archivo" onClick={() => onPick(null)}>
            <X strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <>
          <Upload className="size-6 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
          {/* Phones have nothing to drag from: just the button to pick the file */}
          <p className="m-0">
            <span className="max-lg:hidden">Arrastra aquí el archivo a importar o </span>
            <Button variant="link" onClick={() => input.current?.click()}>
              <span className="max-lg:hidden">haz clic para buscarlo</span>
              <span className="lg:hidden">Elige el archivo a importar</span>
            </Button>
            <span className="max-lg:hidden">.</span>
          </p>
          <p className="m-0 text-xs text-muted-foreground">
            Excel (.xlsx) o CSV. Los .xls antiguos hay que guardarlos antes como .xlsx.
          </p>
        </>
      )}
    </div>
  );
}

function Preview({
  preview,
  onConfirm,
  onCancel,
}: {
  preview: ImportPreview;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const config = IMPORT_KINDS[preview.kind];
  const valid = preview.items.filter((i) => i.errors.length === 0);
  const invalid = preview.items.length - valid.length;
  const total = sumBy(valid, (i) => i.total);
  const names = new Set(valid.map((i) => i.contactName));
  const newContacts = preview.newContacts.filter((c) => names.has(c.name));
  const [singular, plural] = config.noun;

  if (preview.fileErrors.length)
    return (
      <section className="flex animate-rise-in flex-col gap-2 rounded-xl bg-destructive-soft p-5">
        <h2 className="m-0 flex items-center gap-2 text-lg font-semibold tracking-tight text-destructive">
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
      className="flex animate-rise-in flex-col overflow-hidden surface"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5">
        <h2 className="m-0 text-lg font-semibold tracking-tight">Vista previa</h2>
        <span className="text-sm">
          <span className="font-semibold">{valid.length}</span>{" "}
          {valid.length === 1 ? `${singular} lista` : `${plural} listas`} para importar ·{" "}
          <span className="amount font-semibold">{formatEUR(total)}</span>
        </span>
        {invalid > 0 && (
          <span className="text-sm text-destructive">
            {invalid} con errores {invalid === 1 ? "no se importará" : "no se importarán"}
          </span>
        )}
        {newContacts.length > 0 && (
          <span className="text-sm text-muted-foreground">
            Se {newContacts.length === 1 ? "creará 1" : `crearán ${newContacts.length}`}{" "}
            {preview.kind === "sales" ? "cliente" : "proveedor"}
            {newContacts.length === 1 ? "" : preview.kind === "sales" ? "s" : "es"} nuevo
            {newContacts.length === 1 ? "" : "s"}
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
                Número
              </th>
              <th scope="col" className={table.th}>
                Fecha
              </th>
              <th scope="col" className={table.th}>
                {preview.kind === "sales" ? "Cliente" : "Proveedor"}
              </th>
              <th scope="col" className={cn(table.th, "text-right")}>
                Total
              </th>
              <th scope="col" className={table.th}>
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {preview.items.map((item, i) => {
              const ok = item.errors.length === 0;
              return (
                <tr key={`${item.rows[0]}-${i}`} className={cn(table.row, !ok && "bg-destructive-soft/40")}>
                  <td className={cn(table.td, "whitespace-nowrap text-muted-foreground tabular-nums")}>
                    {item.rows.length > 1 ? `${item.rows[0]}–${item.rows.at(-1)}` : item.rows[0]}
                  </td>
                  <td className={cn(table.td, "tabular-nums")}>{item.number || "—"}</td>
                  <td className={cn(table.td, "whitespace-nowrap text-muted-foreground")}>
                    {item.date ? formatDate(item.date) : "—"}
                  </td>
                  <td className={table.td}>{item.contactName || "—"}</td>
                  <td className={cn(table.td, "text-right amount")}>{ok ? formatEUR(item.total) : "—"}</td>
                  <td className={table.td}>
                    {ok ? (
                      <span className="flex items-center gap-2">
                        <Badge tone="success">Correcta</Badge>
                        {item.warnings.length > 0 && <Warnings warnings={item.warnings} />}
                      </span>
                    ) : (
                      <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-sm text-destructive">
                        {item.errors.map((e) => (
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
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={onConfirm} disabled={valid.length === 0}>
          Importar {valid.length} {valid.length === 1 ? singular : plural}
        </Button>
      </div>
      {valid.length === 0 && (
        <p className="m-0 px-4 pb-3 text-right text-sm text-muted-foreground">
          Corrige los errores en el archivo y vuelve a subirlo.
        </p>
      )}
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

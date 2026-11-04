import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { FileImage, FileText, Paperclip, Trash2 } from "lucide-react";
import type { FileListing, FileUsage } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button } from "@cuentalibre/ui/components/button";
import { SegmentedControl } from "@cuentalibre/ui/components/segmented-control";
import { currentBackend } from "@/data/backend";
import { GroupedSelect } from "@/features/sales/form-fields";
import { salesStore } from "@/features/sales/sales-store";
import { formatDate, formatFileSize } from "@/lib/format";
import { useBilling } from "./billing-store";
import {
  fileUserLabel,
  fileUserPath,
  unusedBytes,
  visibleFiles,
  type FilesFilter,
  type FilesSort,
} from "./files-model";
import { ConfirmDialog, SettingsHeader } from "./settings-parts";

const SORTS = [
  { value: "recent", label: "Más recientes" },
  { value: "size", label: "Más grandes" },
];

const kindOf = (documentId: string) => salesStore.get(documentId)?.kind;

/** The files the company keeps: how much of its space they take, where each is used, and deleting those nothing uses. */
export function FilesPage() {
  const api = currentBackend().files;
  const billing = useBilling();
  const canDelete = !billing || billing.plan.canWrite;
  const [listing, setListing] = useState<FileListing | null>(null);
  const [filter, setFilter] = useState<FilesFilter>("all");
  const [sort, setSort] = useState<FilesSort>("recent");
  const [deleting, setDeleting] = useState<FileUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      ?.list()
      .then(setListing)
      .catch(() => setError("No se han podido cargar tus archivos."));
  }, [api]);
  useEffect(load, [load]);

  const remove = async (file: FileUsage) => {
    if (!api) return;
    setError(null);
    try {
      await api.delete(file.id);
    } catch {
      setError(
        `No se ha podido eliminar «${file.name}». Si se ha adjuntado a algo entretanto, quítalo de ahí primero.`,
      );
    }
    load();
  };

  const files = listing ? visibleFiles(listing.files, filter, sort) : [];
  const unusedCount = listing?.files.filter((file) => file.usedBy.length === 0).length ?? 0;

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-6 lg:px-8">
      <SettingsHeader title="Archivos" description="Los documentos que adjuntas y el espacio que ocupan." />

      {!api ? (
        <p className="m-0 max-w-3xl rounded-lg bg-muted px-4 py-3 text-sm">
          Los archivos se guardan cuando usas cuentalibre con tu cuenta. En esta sesión solo viven en el navegador.
        </p>
      ) : listing === null ? (
        error ? (
          <p role="alert" className="m-0 rounded-lg bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
            {error}
          </p>
        ) : (
          <p className="m-0 text-sm text-muted-foreground">Cargando…</p>
        )
      ) : (
        <>
          <Usage listing={listing} />

          <section aria-label="Tus archivos" className="flex max-w-4xl flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SegmentedControl
                label="Qué archivos mostrar"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: `Todos (${listing.files.length})` },
                  { value: "unused", label: `Sin usar (${unusedCount})` },
                ]}
              />
              <div className="w-44">
                <GroupedSelect
                  id="files-sort"
                  aria-label="Ordenar"
                  value={sort}
                  onChange={(value) => setSort(value as FilesSort)}
                  groups={[{ options: SORTS }]}
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="m-0 rounded-lg bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
                {error}
              </p>
            )}

            {files.length === 0 ? (
              <p className="m-0 rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
                {filter === "unused"
                  ? "Todos tus archivos están adjuntos a algo."
                  : "Aún no has adjuntado archivos. Los justificantes de tus gastos y facturas aparecerán aquí."}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col divide-y divide-border rounded-xl border border-border bg-card p-0">
                {files.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    onDelete={canDelete && file.usedBy.length === 0 ? () => setDeleting(file) : undefined}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Eliminar archivo"
        confirmLabel="Eliminar"
        danger
        onConfirm={() => deleting && void remove(deleting)}
      >
        <p className="m-0">Se eliminará «{deleting?.name}» y dejará de ocupar espacio. No se puede deshacer.</p>
      </ConfirmDialog>
    </div>
  );
}

/** Space used against the quota, split into what records use and what could be freed. */
function Usage({ listing }: { listing: FileListing }) {
  const { usedBytes, quotaBytes } = listing;
  const free = unusedBytes(listing.files);
  const share = (bytes: number) => (quotaBytes ? `${Math.min(100, (bytes / quotaBytes) * 100)}%` : "0%");
  const full = quotaBytes !== null && usedBytes / quotaBytes >= 0.9;
  return (
    <section
      aria-label="Espacio"
      className="flex max-w-4xl animate-rise-in flex-col gap-3 rounded-xl border border-border bg-card p-5"
      style={{ "--i": 0 } as CSSProperties}
    >
      <p className="m-0 flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatFileSize(usedBytes)}</span>
        <span className="text-muted-foreground">
          {quotaBytes ? `de ${formatFileSize(quotaBytes)}` : "sin límite de espacio"}
        </span>
      </p>
      {quotaBytes !== null && (
        <div
          role="meter"
          aria-label="Espacio ocupado"
          aria-valuemin={0}
          aria-valuemax={quotaBytes}
          aria-valuenow={usedBytes}
          aria-valuetext={`${formatFileSize(usedBytes)} de ${formatFileSize(quotaBytes)}`}
          className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        >
          <span className={full ? "bg-destructive" : "bg-primary"} style={{ width: share(usedBytes - free) }} />
          <span className="bg-warning" style={{ width: share(free) }} />
        </div>
      )}
      {free > 0 && (
        <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
          {formatFileSize(free)} en archivos sin usar, que puedes eliminar.
        </p>
      )}
    </section>
  );
}

function FileRow({ file, onDelete }: { file: FileUsage; onDelete?: () => void }) {
  const url = currentBackend().fileUrl?.(file.id);
  const Icon = file.contentType.startsWith("image/")
    ? FileImage
    : file.contentType === "application/pdf"
      ? FileText
      : Paperclip;
  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <Icon className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <a
            href={url}
            target="_blank"
            rel="noopener"
            className="truncate font-medium text-foreground no-underline hover:text-primary"
          >
            {file.name}
          </a>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(file.size)}, subido el {formatDate(file.uploadedAt.slice(0, 10))}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:justify-end">
          {file.usedBy.length === 0 ? (
            <Badge tone="warning">Sin usar</Badge>
          ) : (
            file.usedBy.map((user) => {
              const path = fileUserPath(user, kindOf);
              const label = fileUserLabel(user);
              return path ? (
                <Link
                  key={`${user.kind}-${user.id}`}
                  to={path}
                  title={label}
                  className="max-w-full truncate rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-foreground no-underline hover:bg-accent sm:max-w-80"
                >
                  {label}
                </Link>
              ) : (
                <span
                  key={`${user.kind}-${user.id}`}
                  title={label}
                  className="max-w-full truncate rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:max-w-80"
                >
                  {label}
                  {user.deleted && " (eliminado)"}
                </span>
              );
            })
          )}
        </div>
      </div>
      {onDelete && (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Eliminar ${file.name}`}
          onClick={onDelete}
          className="size-8 px-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 strokeWidth={1.8} aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

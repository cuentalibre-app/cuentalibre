import { useState } from "react";
import { MoreHorizontal, Pencil, Plus, Power, Star, Trash2 } from "lucide-react";
import { isBuiltInSeries, type InvoiceSeriesDefinition } from "@fiscalia/contracts";
import { Badge } from "@fiscalia/ui/components/badge";
import { Button } from "@fiscalia/ui/components/button";
import { DropdownMenuTrigger } from "@fiscalia/ui/components/dropdown-menu";
import { cn } from "@fiscalia/ui/lib/cn";
import { ConfirmDialog } from "@/features/settings/settings-parts";
import { DefaultMark } from "./document-look";
import { invoiceSettingsStore, useInvoiceSettings } from "./invoice-settings";
import { ActionsMenu, IconAction, type Action } from "./list-parts";
import { invoiceSeriesList, seriesUsage } from "./sales-model";
import { useSalesDocuments } from "./sales-store";
import { SERIES_TYPES, SeriesDialog } from "./series-dialog";

const HEADERS = ["Estado", "Tipo", "Nombre", "Por defecto en normales", "Por defecto en rectificativas", "Máscara"];

/**
 * The invoice series with their actions. Changes are saved at once. A series
 * that numbers invoices or drafts can't be removed, only deactivated; the
 * default series of each type stays active, and the built-in ones can't be
 * removed.
 */
export function SeriesTable() {
  const { series: stored, defaultSeries } = useInvoiceSettings();
  const docs = useSalesDocuments();
  const all = invoiceSeriesList(stored);
  const [editing, setEditing] = useState<InvoiceSeriesDefinition | "new" | null>(null);
  const [deactivating, setDeactivating] = useState<InvoiceSeriesDefinition | null>(null);
  const [removing, setRemoving] = useState<InvoiceSeriesDefinition | null>(null);
  const [blocked, setBlocked] = useState<{ series: InvoiceSeriesDefinition; uses: number } | null>(null);

  const isDefault = (s: InvoiceSeriesDefinition) => (defaultSeries?.[s.type] ?? s.type) === s.id;
  const setActive = (s: InvoiceSeriesDefinition, active: boolean) =>
    void invoiceSettingsStore.saveSeries({ ...s, active: active ? undefined : false });

  const askRemove = (s: InvoiceSeriesDefinition) => {
    const uses = seriesUsage(s, docs);
    if (uses > 0) setBlocked({ series: s, uses });
    else setRemoving(s);
  };

  const actions = (s: InvoiceSeriesDefinition): Action[][] => {
    const active = s.active !== false;
    return [
      [
        {
          label: "Establecer por defecto",
          icon: Star,
          run: isDefault(s) || !active ? undefined : () => void invoiceSettingsStore.setDefaultSeries(s),
        },
        { label: "Editar serie", icon: Pencil, run: () => setEditing(s) },
        {
          label: active ? "Desactivar serie" : "Activar serie",
          icon: Power,
          // New invoices take the default series, so it stays active
          run: isDefault(s) ? undefined : active ? () => setDeactivating(s) : () => setActive(s, true),
        },
      ],
      [
        {
          label: "Eliminar serie",
          icon: Trash2,
          danger: true,
          run: isBuiltInSeries(s.id) || isDefault(s) ? undefined : () => askRemove(s),
        },
      ],
    ];
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              {HEADERS.map((h) => (
                <th key={h} scope="col" className="px-3 py-2.5 font-medium">
                  {h}
                </th>
              ))}
              <th scope="col" className="px-3 py-2.5 font-medium">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {all.map((s) => {
              const active = s.active !== false;
              return (
                <tr key={s.id} className="border-t border-divider">
                  <td className="px-3 py-2.5">
                    <Badge tone={active ? "success" : "neutral"}>{active ? "Activa" : "Inactiva"}</Badge>
                  </td>
                  <td className="px-3 py-2.5">{SERIES_TYPES.find((t) => t.value === s.type)!.label}</td>
                  <td className={cn("px-3 py-2.5 font-medium", !active && "text-muted-foreground")}>{s.name}</td>
                  <td className="px-3 py-2.5">{s.type === "normal" && isDefault(s) && <DefaultMark />}</td>
                  <td className="px-3 py-2.5">{s.type === "rectifying" && isDefault(s) && <DefaultMark />}</td>
                  <td className="px-3 py-2.5 font-mono">{s.mask}</td>
                  <td className="px-3 py-1.5">
                    <span className="flex justify-end gap-0.5">
                      <IconAction
                        action={{ label: `Editar serie ${s.name}`, icon: Pencil, run: () => setEditing(s) }}
                      />
                      <ActionsMenu
                        groups={actions(s)}
                        trigger={
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Más acciones de la serie ${s.name}`}
                              className="size-8 px-0"
                            >
                              <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                        }
                      />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button variant="secondary" size="md" className="self-start" onClick={() => setEditing("new")}>
        <Plus aria-hidden="true" />
        Nueva serie
      </Button>

      {editing && (
        <SeriesDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          series={editing === "new" ? null : editing}
        />
      )}
      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title="Desactivar serie"
        confirmLabel="Desactivar"
        onConfirm={() => deactivating && setActive(deactivating, false)}
      >
        <p className="m-0">
          La serie «{deactivating?.name}» se desactivará y ya no se podrán crear facturas en ella. Las que ya tiene la
          conservan, y puedes volver a activarla cuando quieras.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Eliminar serie"
        confirmLabel="Eliminar"
        danger
        onConfirm={() => removing && void invoiceSettingsStore.removeSeries(removing.id)}
      >
        <p className="m-0">Se eliminará la serie «{removing?.name}». No numera ninguna factura ni borrador.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={blocked !== null}
        onOpenChange={(open) => !open && setBlocked(null)}
        title="Esta serie está en uso"
        confirmLabel="Desactivar"
        onConfirm={() => blocked && setActive(blocked.series, false)}
      >
        <p className="m-0">
          «{blocked?.series.name}» numera {blocked?.uses}{" "}
          {blocked?.uses === 1 ? "factura o borrador" : "facturas o borradores"}, así que no se puede eliminar.
        </p>
        <p className="m-0">
          Puedes desactivarla: no se podrán crear facturas nuevas en ella, pero las que tiene la conservan.
        </p>
      </ConfirmDialog>
    </>
  );
}

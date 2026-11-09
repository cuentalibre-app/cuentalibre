import { useState } from "react";
import {
  formatSeriesNumber,
  newId,
  sameSeriesFormat,
  seriesMaskProblem,
  type SeriesMaskProblem,
} from "@cuentalibre/core";
import type { InvoiceSeries, InvoiceSeriesDefinition } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { Field, GroupedSelect } from "./form-fields";
import { invoiceSettingsStore } from "./invoice-settings";
import { invoiceSeriesList, seriesUsage } from "./sales-model";
import { salesStore } from "./sales-store";

export const SERIES_TYPES: { value: InvoiceSeries; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "rectifying", label: "Rectificativa" },
];

const MASK_PROBLEMS: Record<SeriesMaskProblem, string> = {
  year: "Incluye el año una sola vez, como AAAA o AA.",
  counter: "Incluye un único contador, como ####.",
  characters: "Usa solo letras y los separadores - / . _ (sin cifras ni espacios), hasta 30 caracteres.",
};

/**
 * Creates an invoice series, or edits one: its type is fixed once created, and
 * its mask once it numbers an invoice or a draft. A form opening it selects the
 * new series.
 */
export function SeriesDialog({
  open,
  onOpenChange,
  series = null,
  type: presetType = "normal",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series?: InvoiceSeriesDefinition | null;
  type?: InvoiceSeries;
  onCreated?: (series: InvoiceSeriesDefinition) => void;
}) {
  const [type, setType] = useState<InvoiceSeries>(series?.type ?? presetType);
  const [name, setName] = useState(series?.name ?? "");
  const [mask, setMask] = useState(series?.mask ?? "AAAA-B-####");
  const [submitted, setSubmitted] = useState(false);
  const uses = series ? seriesUsage(series, salesStore.all()) : 0;

  const trimmedMask = mask.trim();
  const problem = seriesMaskProblem(trimmedMask);
  const taken = invoiceSeriesList().find((s) => s.id !== series?.id && sameSeriesFormat(s.mask, trimmedMask));
  const nameError = name.trim() ? undefined : "Ponle un nombre a la serie.";
  const maskError = problem
    ? MASK_PROBLEMS[problem]
    : taken
      ? `«${taken.name}» ya numera con este formato.`
      : undefined;

  const save = () => {
    setSubmitted(true);
    if (nameError || maskError) return;
    const saved: InvoiceSeriesDefinition = {
      ...series,
      id: series?.id ?? newId(),
      type,
      name: name.trim(),
      mask: trimmedMask,
    };
    void invoiceSettingsStore.saveSeries(saved);
    if (!series) onCreated?.(saved);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>{series ? "Editar serie de facturas" : "Nueva serie de facturas"}</DialogTitle>
        <DialogDescription>
          Cada serie numera sus facturas por separado, de forma correlativa y empezando cada año en 1. Una vez numere
          facturas o borradores, su máscara ya no se puede cambiar.
        </DialogDescription>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            // The dialog is portalled, but React still bubbles submit to a form around it
            e.preventDefault();
            e.stopPropagation();
            save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo" required hint={series ? "El tipo no cambia una vez creada la serie." : undefined}>
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={type}
                  onChange={(v) => setType(v as InvoiceSeries)}
                  groups={[{ options: SERIES_TYPES }]}
                  disabled={series !== null}
                />
              )}
            </Field>
            <Field label="Nombre" required error={submitted ? nameError : undefined}>
              {(p) => (
                <Input
                  {...p}
                  autoFocus
                  value={name}
                  placeholder="Facturas serie B"
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </Field>
          </div>
          <Field
            label="Máscara"
            required
            error={maskError}
            hint={
              uses > 0
                ? `Numera ${uses} ${uses === 1 ? "factura o borrador" : "facturas o borradores"}: la máscara ya no cambia.`
                : `Ejemplo: ${formatSeriesNumber(trimmedMask, new Date().getFullYear(), 1)}`
            }
            help="AAAA es el año con cuatro cifras y AA con dos; #### es el contador, con tantas cifras como almohadillas. El resto se mantiene tal cual: F-AA-### numera F-26-001, F-26-002…"
          >
            {(p) => (
              <Input
                {...p}
                value={mask}
                spellCheck={false}
                readOnly={uses > 0}
                onChange={(e) => setMask(e.target.value)}
                className="tabular-nums"
              />
            )}
          </Field>
          <div className="flex justify-end gap-2.5 pt-1">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit">{series ? "Guardar" : "Crear serie"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

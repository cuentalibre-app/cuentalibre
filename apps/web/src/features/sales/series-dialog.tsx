import { useState } from "react";
import { formatSeriesNumber, newId, sameSeriesFormat, seriesMaskProblem, type SeriesMaskProblem } from "@fiscalia/core";
import type { InvoiceSeries, InvoiceSeriesDefinition } from "@fiscalia/contracts";
import { Button } from "@fiscalia/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@fiscalia/ui/components/dialog";
import { Input } from "@fiscalia/ui/components/input";
import { Field, GroupedSelect } from "./form-fields";
import { invoiceSettingsStore } from "./invoice-settings";
import { invoiceSeriesList } from "./sales-model";

const TYPES: { value: InvoiceSeries; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "rectifying", label: "Rectificativa" },
];

const MASK_PROBLEMS: Record<SeriesMaskProblem, string> = {
  year: "Incluye el año una sola vez, como AAAA.",
  counter: "Incluye un único contador, como ####.",
  characters: "Usa solo letras y los separadores - / . _ (sin cifras ni espacios), hasta 30 caracteres.",
};

/** Creates an invoice series; a form opening it selects the new series. */
export function SeriesDialog({
  open,
  onOpenChange,
  type: presetType = "normal",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type?: InvoiceSeries;
  onCreated?: (series: InvoiceSeriesDefinition) => void;
}) {
  const [type, setType] = useState<InvoiceSeries>(presetType);
  const [name, setName] = useState("");
  const [mask, setMask] = useState("AAAA-B-####");
  const [submitted, setSubmitted] = useState(false);

  const trimmedMask = mask.trim();
  const problem = seriesMaskProblem(trimmedMask);
  const taken = invoiceSeriesList().find((s) => sameSeriesFormat(s.mask, trimmedMask));
  const nameError = name.trim() ? undefined : "Ponle un nombre a la serie.";
  const maskError = problem
    ? MASK_PROBLEMS[problem]
    : taken
      ? `«${taken.name}» ya numera con este formato.`
      : undefined;

  const save = () => {
    setSubmitted(true);
    if (nameError || maskError) return;
    const series: InvoiceSeriesDefinition = { id: newId(), type, name: name.trim(), mask: trimmedMask };
    void invoiceSettingsStore.addSeries(series);
    onCreated?.(series);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Nueva serie de facturas</DialogTitle>
        <DialogDescription>
          Cada serie numera sus facturas por separado, de forma correlativa y empezando cada año en 1. Una vez emitas
          facturas en ella, su tipo y su máscara ya no se pueden cambiar.
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
            <Field label="Tipo" required>
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={type}
                  onChange={(v) => setType(v as InvoiceSeries)}
                  groups={[{ options: TYPES }]}
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
            hint={`Primera factura: ${formatSeriesNumber(trimmedMask, new Date().getFullYear(), 1)}`}
            help="AAAA es el año y #### el contador, con tantas cifras como almohadillas."
          >
            {(p) => (
              <Input
                {...p}
                value={mask}
                spellCheck={false}
                onChange={(e) => setMask(e.target.value)}
                className="font-mono"
              />
            )}
          </Field>
          <div className="flex justify-end gap-2.5 pt-1">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit">Crear serie</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

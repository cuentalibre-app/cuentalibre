import { useState } from "react";
import { toIsoDate } from "@fiscalia/core";
import { Button } from "@fiscalia/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@fiscalia/ui/components/dialog";
import { Input } from "@fiscalia/ui/components/input";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { defaultPaymentMethodId, paymentMethodOptions } from "@/features/settings/settings-model";
import { formatDate } from "@/lib/format";
import type { SalesDocument } from "@/mocks/sales";
import { TagsField } from "./document-editor";
import { Field, GroupedSelect } from "./form-fields";
import { documentTotals } from "./sales-model";
import { salesStore } from "./sales-store";

/* Dialogs opened from a document's actions menu in the lists. */

interface DialogProps {
  doc: SalesDocument;
  onOpenChange: (open: boolean) => void;
}

/** Collection of an invoice: date and method, or undo it. */
export function PaymentDialog({ doc, onOpenChange }: DialogProps) {
  const paid = doc.status === "paid";
  const [date, setDate] = useState(doc.paidOn ?? toIsoDate(new Date()));
  const [methodId, setMethodId] = useState(doc.paymentMethodId ?? defaultPaymentMethodId());
  const { total } = documentTotals(doc);

  const save = () => {
    if (!date || !methodId) return;
    salesStore.update(doc.id, { status: "paid", paidOn: date, paymentMethodId: methodId });
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Cobro de la factura {doc.number}</DialogTitle>
        <DialogDescription>
          {paid && doc.paidOn
            ? `Cobrada el ${formatDate(doc.paidOn)}. Puedes corregir la fecha o el método, o volver a dejarla pendiente.`
            : `Pendiente de cobro${doc.dueOn ? `, vence el ${formatDate(doc.dueOn)}` : ""}.`}
        </DialogDescription>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <p className="m-0 flex items-baseline justify-between rounded-lg bg-muted px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Importe a cobrar</span>
            <span className="amount text-base font-semibold">{formatEUR(total)}</span>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha de cobro" required>
              {(p) => <Input {...p} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}
            </Field>
            <Field label="Método de cobro" required>
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={methodId}
                  onChange={setMethodId}
                  groups={[{ options: paymentMethodOptions(methodId) }]}
                />
              )}
            </Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2.5 pt-1">
            {paid && (
              <Button
                variant="ghost"
                className="mr-auto"
                onClick={() => {
                  salesStore.update(doc.id, { status: "pending", paidOn: undefined, paymentMethodId: undefined });
                  onOpenChange(false);
                }}
              >
                Marcar como pendiente
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={!date || !methodId}>
              {paid ? "Guardar" : "Registrar cobro"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TagsDialog({ doc, title, onOpenChange }: DialogProps & { title: string }) {
  const [tags, setTags] = useState(doc.tags ?? []);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Etiquetas de {title}</DialogTitle>
        <DialogDescription>
          Escribe una etiqueta y pulsa Intro. Las de Configuración › Etiquetas aparecen como sugerencias.
        </DialogDescription>
        <TagsField tags={tags} onChange={setTags} />
        <div className="flex justify-end gap-2.5 pt-1">
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            onClick={() => {
              salesStore.update(doc.id, { tags: tags.length ? tags : undefined });
              onOpenChange(false);
            }}
          >
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

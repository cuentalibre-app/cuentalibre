import { useState } from "react";
import { toIsoDate, type Cents } from "@cuentalibre/core";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Input, Textarea } from "@cuentalibre/ui/components/input";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { defaultPaymentMethodId, paymentMethodOptions } from "@/features/settings/settings-model";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { parseEuros } from "@/lib/format";
import { treasuryStore } from "./treasury-store";

/* Building blocks shared by the treasury pages. */

/** Green for money in, plain for money out, with an explicit sign. */
export function SignedAmount({ value, className }: { value: Cents; className?: string }) {
  return (
    <span className={cn("amount whitespace-nowrap", value > 0 && "text-success", className)}>
      {value > 0 ? "+" : ""}
      {formatEUR(value)}
    </span>
  );
}

/* ─────────────────────────────── Manual payment ─────────────────────────────── */

export function ManualPaymentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [methodId, setMethodId] = useState(defaultPaymentMethodId());
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const value = parseEuros(amount);
  const errors = {
    amount: value === null || value === 0 ? "Introduce un importe distinto de cero." : undefined,
    date: date ? undefined : "Indica la fecha.",
    method: methodId ? undefined : "Elige el método de cobro o pago.",
    description: description.trim() ? undefined : "Describe el cobro o pago.",
  };
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    void treasuryStore.addManualPayment({
      amount: value!,
      date,
      paymentMethodId: methodId,
      description: description.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Nuevo cobro / pago manual</DialogTitle>
        <DialogDescription>
          Para dinero que entra o sale sin factura ni gasto detrás: un préstamo, un traspaso entre cuentas, un ajuste…
          Positivo para cobros y negativo para pagos.
        </DialogDescription>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cantidad cobrada o pagada" required error={show("amount")}>
              {(p) => (
                <Input
                  {...p}
                  inputMode="decimal"
                  placeholder="-1.500,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-right amount"
                />
              )}
            </Field>
            <Field label="Fecha" required error={show("date")}>
              {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
            </Field>
          </div>
          <Field label="Método de cobro / pago" required error={show("method")}>
            {(p) => (
              <GroupedSelect
                {...p}
                value={methodId}
                onChange={setMethodId}
                groups={[{ options: paymentMethodOptions(methodId) }]}
              />
            )}
          </Field>
          <Field label="Descripción" required error={show("description")}>
            {(p) => <Textarea {...p} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <div className="flex justify-end gap-2.5 pt-1">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

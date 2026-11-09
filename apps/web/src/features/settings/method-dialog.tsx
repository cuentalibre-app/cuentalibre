import { useState } from "react";
import { formatIban, isValidEmail, isValidIban, newId } from "@cuentalibre/core";
import type { PaymentMethod, PaymentMethodType } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { cn } from "@cuentalibre/ui/lib/cn";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { METHOD_TYPES, isBankMethod, numberLabel } from "./settings-model";
import { settingsStore } from "./settings-store";

/** A full IBAN, or just its last digits for those who'd rather not store it. */
function numberError(type: PaymentMethodType, number: string): string | undefined {
  const value = number.trim();
  if (!value || type === "cash") return undefined;
  if (type === "paypal") return isValidEmail(value) ? undefined : "Introduce el email de la cuenta de PayPal.";
  if (type === "card")
    return /^[\d\s•*]{4,23}$/.test(value) ? undefined : "Solo dígitos: el número completo o los cuatro últimos.";
  if (/^[\d\s]{4,8}$/.test(value) || isValidIban(value)) return undefined;
  return "El IBAN no es válido. Revisa los dígitos de control.";
}

export function MethodDialog({
  open,
  onOpenChange,
  method,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: PaymentMethod | null;
  /** Called with the id of a newly created method, so a form can select it. */
  onCreated?: (id: string) => void;
}) {
  const [type, setType] = useState<PaymentMethodType>(method?.type ?? "transfer");
  const [name, setName] = useState(method?.name ?? "");
  const [number, setNumber] = useState(method?.number ?? "");
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    name: name.trim() ? undefined : "Ponle un nombre a la forma de pago.",
    number: numberError(type, number),
  };
  const label = numberLabel(type);

  const save = () => {
    setSubmitted(true);
    if (errors.name || errors.number) return;
    const value = type === "cash" ? "" : isBankMethod(type) && isValidIban(number) ? formatIban(number) : number.trim();
    const values = { type, name: name.trim(), number: value };
    if (method) settingsStore.updatePaymentMethod(method.id, values);
    else {
      const id = newId();
      settingsStore.addPaymentMethod({ id, ...values, active: true });
      onCreated?.(id);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>{method ? `Editar · ${method.name}` : "Nueva forma de cobro y pago"}</DialogTitle>
        <DialogDescription>
          Cómo te pagan tus clientes o pagas a tus proveedores, y por qué cuenta pasa.
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
                  onChange={(v) => setType(v as PaymentMethodType)}
                  groups={[{ options: METHOD_TYPES }]}
                />
              )}
            </Field>
            <Field label="Nombre" required error={submitted ? errors.name : undefined}>
              {(p) => (
                <Input
                  {...p}
                  autoFocus
                  value={name}
                  placeholder="Cuenta del negocio"
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </Field>
          </div>
          {label && (
            <Field label={label} error={submitted ? errors.number : undefined}>
              {(p) => (
                <Input
                  {...p}
                  value={number}
                  spellCheck={false}
                  inputMode={type === "card" ? "numeric" : type === "paypal" ? "email" : undefined}
                  onChange={(e) => setNumber(e.target.value)}
                  className={cn(type !== "paypal" && "uppercase tabular-nums")}
                />
              )}
            </Field>
          )}
          <div className="flex justify-end gap-2.5 pt-1">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit">{method ? "Guardar" : "Crear"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

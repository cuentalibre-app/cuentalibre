import { useState } from "react";
import { newId } from "@cuentalibre/core";
import type { PaymentMethod, PaymentMethodType } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { METHOD_TYPES_FOR_ACCOUNT, takesMethod } from "./account-methods";
import { METHOD_TYPES } from "./settings-model";
import { settingsStore, useSettings } from "./settings-store";

const NO_ACCOUNT = "none";

/**
 * A new method opens on the account it's added to, with that account's usual type and number.
 * The account decides the types on offer: only a bank account takes more than one.
 */
export function MethodDialog({
  open,
  onOpenChange,
  method,
  accountId: presetAccountId = null,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: PaymentMethod | null;
  accountId?: string | null;
  /** Called with the id of a newly created method, so a form can select it. */
  onCreated?: (id: string) => void;
}) {
  const { accounts, paymentMethods } = useSettings();
  const preset = accounts.find((a) => a.id === presetAccountId);
  const [chosenType, setType] = useState<PaymentMethodType>(
    method?.type ?? (preset ? METHOD_TYPES_FOR_ACCOUNT[preset.kind][0]! : "transfer"),
  );
  const [name, setName] = useState(method?.name ?? "");
  const [number, setNumber] = useState(method?.number ?? preset?.number ?? "");
  const [accountId, setAccountId] = useState((method ? method.accountId : presetAccountId) ?? NO_ACCOUNT);
  const [submitted, setSubmitted] = useState(false);
  const nameError = name.trim() ? undefined : "Ponle un nombre al método.";
  const account = accounts.find((a) => a.id === accountId);
  const types = account
    ? METHOD_TYPES.filter((t) => METHOD_TYPES_FOR_ACCOUNT[account.kind].includes(t.value))
    : METHOD_TYPES;
  const type = types.some((t) => t.value === chosenType) ? chosenType : types[0]!.value;
  // A method can stay where it is, or move to an account with room for it
  const targets = accounts.filter((a) => a.id === method?.accountId || takesMethod(a, paymentMethods, method?.id));

  const save = () => {
    setSubmitted(true);
    if (nameError) return;
    const values = { type, name: name.trim(), number: number.trim(), accountId: account?.id ?? null };
    if (method) settingsStore.updatePaymentMethod(method.id, values);
    // A method added to an inactive account waits for it
    else {
      const id = newId();
      settingsStore.addPaymentMethod({ id, ...values, active: account?.active ?? true });
      onCreated?.(id);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>{method ? "Modificar método de pago/cobro" : "Nuevo método de pago/cobro"}</DialogTitle>
        <DialogDescription>
          Indica el medio y la cuenta o tarjeta de cada cobro y pago para poder seguirlos. Si lo prefieres, guarda solo
          los cuatro últimos dígitos.
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
            <Field
              label="Tipo"
              required
              hint={types.length === 1 && account ? `«${account.name}» solo admite este tipo.` : undefined}
            >
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={type}
                  onChange={(v) => setType(v as PaymentMethodType)}
                  groups={[{ options: types }]}
                  disabled={types.length === 1}
                />
              )}
            </Field>
            <Field label="Nombre del método" required error={submitted ? nameError : undefined}>
              {(p) => (
                <Input
                  {...p}
                  autoFocus
                  value={name}
                  placeholder={preset?.name ?? "Cuenta empresa"}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </Field>
          </div>
          {type !== "cash" && (
            <Field
              label={type === "paypal" ? "Email de PayPal" : "Número de tarjeta / cuenta corriente"}
              hint={type === "paypal" ? undefined : "Por ejemplo, 8090: los cuatro últimos dígitos."}
            >
              {(p) => (
                <Input
                  {...p}
                  value={number}
                  spellCheck={false}
                  onChange={(e) => setNumber(e.target.value)}
                  className="font-mono uppercase"
                />
              )}
            </Field>
          )}
          <Field
            label="Cuenta vinculada"
            hint="La cuenta de tesorería donde se anotan los cobros y pagos con este método."
          >
            {(p) => (
              <GroupedSelect
                {...p}
                value={accountId}
                onChange={setAccountId}
                groups={[
                  { options: [{ value: NO_ACCOUNT, label: "Sin cuenta vinculada" }] },
                  {
                    label: "Cuentas",
                    options: targets.map((a) => ({ value: a.id, label: a.active ? a.name : `${a.name} (inactiva)` })),
                  },
                ]}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2.5 pt-1">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit">{method ? "Guardar" : "Crear método"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

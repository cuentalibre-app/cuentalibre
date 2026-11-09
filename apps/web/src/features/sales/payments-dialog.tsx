import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { amountOutstanding, newId, toIsoDate, type Cents } from "@cuentalibre/core";
import type { Payment } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { Notice } from "@/components/page";
import { defaultPaymentMethodId, paymentMethodName, paymentMethodOptions } from "@/features/settings/settings-model";
import { MethodDialog } from "@/features/settings/method-dialog";
import { formatDate, formatEurosInput, parseEuros } from "@/lib/format";
import { focusPanel } from "./detail-parts";
import { Field, GroupedSelect } from "./form-fields";

/** Collections of an issued invoice, or payments of a received one: only the wording changes. */
export type PaymentSide = "collection" | "payment";

const WORDS: Record<
  PaymentSide,
  { title: string; amount: string; method: string; list: string; none: string; noun: string; done: string }
> = {
  collection: {
    title: "Gestión de cobros",
    amount: "Cantidad cobrada",
    method: "Método de cobro",
    list: "Cobros realizados hasta la fecha",
    none: "Todavía no hay cobros.",
    noun: "cobro",
    done: "La factura está cobrada por completo. Si un cobro está mal, quítalo y vuelve a registrarlo.",
  },
  payment: {
    title: "Gestión de pagos",
    amount: "Cantidad pagada",
    method: "Método de pago",
    list: "Pagos realizados hasta la fecha",
    none: "Todavía no hay pagos.",
    noun: "pago",
    done: "La factura está pagada por completo. Si un pago está mal, quítalo y vuelve a registrarlo.",
  },
};

/**
 * The payments of an invoice: register what
 * was paid (all of it, or part), see the payments so far and remove a wrong one. Each change
 * is applied at once through `onChange`.
 */
export function PaymentsDialog({
  side,
  description,
  total,
  payments,
  status,
  onChange,
  onOpenChange,
}: {
  side: PaymentSide;
  description: ReactNode;
  total: Cents;
  payments: Payment[];
  /** The invoice's status badge, kept next to the form. */
  status: ReactNode;
  onChange: (payments: Payment[]) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const words = WORDS[side];
  const pending = amountOutstanding(
    total,
    payments.map((p) => p.amount),
  );
  const [amount, setAmount] = useState(formatEurosInput(pending));
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [methodId, setMethodId] = useState(payments.at(-1)?.paymentMethodId ?? defaultPaymentMethodId());
  const [submitted, setSubmitted] = useState(false);
  const [creatingMethod, setCreatingMethod] = useState(false);

  const parsed = parseEuros(amount);
  const error =
    parsed === null || parsed === 0
      ? `Indica la ${words.amount.toLowerCase()}.`
      : Math.sign(parsed) !== Math.sign(total) || Math.abs(parsed) > Math.abs(pending)
        ? `No puede superar lo pendiente de ${words.noun} (${formatEUR(pending)}).`
        : undefined;

  const save = (next: Payment[]) => {
    onChange(next);
    setAmount(
      formatEurosInput(
        amountOutstanding(
          total,
          next.map((p) => p.amount),
        ),
      ),
    );
    setSubmitted(false);
  };
  const register = () => {
    setSubmitted(true);
    if (error || parsed === null || !date || !methodId) return;
    save([...payments, { id: newId(), date, amount: parsed, paymentMethodId: methodId }]);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      {/* Paid in full, the first focusable would be a remove button: focus the panel instead */}
      <DialogContent className="max-w-2xl" onOpenAutoFocus={pending === 0 ? focusPanel : undefined}>
        <DialogTitle>{words.title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {pending === 0 ? (
          <Notice tone="success">{words.done}</Notice>
        ) : (
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              register();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={words.amount} required error={submitted ? error : undefined}>
                {(p) => (
                  <span className="relative flex items-center">
                    <Input
                      {...p}
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pr-7 text-right amount"
                    />
                    <span
                      className="pointer-events-none absolute right-3 text-sm text-muted-foreground"
                      aria-hidden="true"
                    >
                      €
                    </span>
                  </span>
                )}
              </Field>
              <Field label="Fecha" required>
                {(p) => <Input {...p} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}
              </Field>
              <Field label={words.method} required>
                {(p) => (
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1 [&>*]:w-full">
                      <GroupedSelect
                        {...p}
                        value={methodId}
                        onChange={setMethodId}
                        groups={[{ options: paymentMethodOptions(methodId) }]}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="shrink-0 px-2.5"
                      onClick={() => setCreatingMethod(true)}
                    >
                      <Plus aria-hidden="true" />
                      Nuevo método
                    </Button>
                  </div>
                )}
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Estado de la factura</span>
                <span className="flex min-h-10 flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {status}
                  {pending !== 0 && pending !== total && <span>Quedan {formatEUR(pending)}</span>}
                </span>
              </div>
            </div>
            <div className="flex justify-center">
              <Button type="submit">Registrar</Button>
            </div>
          </form>
        )}

        <section aria-labelledby="pagos-realizados" className="overflow-hidden rounded-lg border border-border">
          <h3 id="pagos-realizados" className="m-0 border-b border-border px-3 py-2.5 text-sm font-semibold">
            {words.list}
          </h3>
          {payments.length === 0 ? (
            <p className="m-0 px-3 py-4 text-center text-sm text-muted-foreground">{words.none}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted text-xs text-foreground">
                <tr>
                  <th className="border-l border-border px-3 py-2 text-left font-semibold first:border-l-0">Fecha</th>
                  <th className="border-l border-border px-3 py-2 text-right font-semibold first:border-l-0">
                    Cantidad
                  </th>
                  <th className="border-l border-border px-3 py-2 text-left font-semibold first:border-l-0">
                    {words.method}
                  </th>
                  <th className="w-12 border-l border-border px-3 py-2 first:border-l-0">
                    <span className="sr-only">Operaciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="border-l border-border px-3 py-1.5 first:border-l-0">{formatDate(p.date)}</td>
                    <td className="border-l border-border px-3 py-1.5 text-right amount first:border-l-0">
                      {formatEUR(p.amount)}
                    </td>
                    <td className="border-l border-border px-3 py-1.5 first:border-l-0">
                      {paymentMethodName(p.paymentMethodId) ?? "Sin método"}
                    </td>
                    <td className="px-1.5 py-1 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Quitar el ${words.noun} del ${formatDate(p.date)}`}
                        onClick={() => save(payments.filter((x) => x.id !== p.id))}
                        className="hover:text-destructive"
                      >
                        <Trash2 strokeWidth={1.8} aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
        {creatingMethod && <MethodDialog open onOpenChange={setCreatingMethod} method={null} onCreated={setMethodId} />}
      </DialogContent>
    </Dialog>
  );
}

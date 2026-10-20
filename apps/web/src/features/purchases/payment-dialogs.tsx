import { useState } from "react";
import { Plus, Undo2 } from "lucide-react";
import { toIsoDate } from "@fiscalia/core";
import type { Expense, PurchaseInvoice } from "@fiscalia/contracts";
import { Badge } from "@fiscalia/ui/components/badge";
import { Button } from "@fiscalia/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@fiscalia/ui/components/dialog";
import { Input } from "@fiscalia/ui/components/input";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { focusPanel } from "@/features/sales/detail-parts";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { PaymentsDialog } from "@/features/sales/payments-dialog";
import { MethodDialog } from "@/features/settings/method-dialog";
import { defaultPaymentMethodId, paymentMethodName, paymentMethodOptions } from "@/features/settings/settings-model";
import { formatDate } from "@/lib/format";
import { EXPENSE_STATUS, expenseStatus } from "./expenses-model";
import { expensesStore, useExpenses } from "./expenses-store";
import { PURCHASE_STATUS, purchaseStatus, purchaseTotals } from "./purchases-model";
import { purchasesStore, usePurchaseInvoices } from "./purchases-store";

/** Payments of a received invoice, as the reference app's "Gestión de pagos". Changes apply at once. */
export function PurchasePaymentsDialog({
  doc,
  onOpenChange,
}: {
  doc: PurchaseInvoice;
  onOpenChange: (open: boolean) => void;
}) {
  const current = usePurchaseInvoices().find((d) => d.id === doc.id) ?? doc;
  const { total } = purchaseTotals(current);
  const status = PURCHASE_STATUS[purchaseStatus(current, new Date())];
  return (
    <PaymentsDialog
      side="payment"
      description={`Pagos de la factura ${current.number}, por un total de ${formatEUR(total)}. Registra lo pagado, todo o una parte.`}
      total={total}
      payments={current.payments}
      status={<Badge tone={status.tone}>{status.label}</Badge>}
      onChange={(payments) => purchasesStore.update(current.id, { payments })}
      onOpenChange={onOpenChange}
    />
  );
}

/** The payment of an expense: it is paid in one go, so only its date and method are asked. */
export function ExpensePaymentDialog({ doc, onOpenChange }: { doc: Expense; onOpenChange: (open: boolean) => void }) {
  const current = useExpenses().find((e) => e.id === doc.id) ?? doc;
  const status = EXPENSE_STATUS[expenseStatus(current)];
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [methodId, setMethodId] = useState(defaultPaymentMethodId());
  const [creatingMethod, setCreatingMethod] = useState(false);
  const { payment } = current;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" onOpenAutoFocus={payment ? focusPanel : undefined}>
        <DialogTitle>Gestión del pago</DialogTitle>
        <DialogDescription>
          Pago del gasto «{current.concept}», de {formatEUR(current.amount)}.
        </DialogDescription>
        {payment ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success">
            <span>
              Pagado el {formatDate(payment.date)} · {paymentMethodName(payment.paymentMethodId) ?? "Método eliminado"}.
            </span>
            <Button variant="secondary" size="sm" onClick={() => expensesStore.update(current.id, { payment: null })}>
              <Undo2 strokeWidth={1.8} aria-hidden="true" />
              Quitar el pago
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (date && methodId) expensesStore.update(current.id, { payment: { date, paymentMethodId: methodId } });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha" required>
                {(p) => <Input {...p} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Estado del gasto</span>
                <span className="flex min-h-10 items-center">
                  <Badge tone={status.tone}>{status.label}</Badge>
                </span>
              </div>
              <div className="sm:col-span-2">
                <Field label="Método de pago" required>
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
                        variant="ghost"
                        size="md"
                        className="shrink-0 px-2.5 text-primary"
                        onClick={() => setCreatingMethod(true)}
                      >
                        <Plus aria-hidden="true" />
                        Nuevo método
                      </Button>
                    </div>
                  )}
                </Field>
              </div>
            </div>
            <div className="flex justify-center">
              <Button type="submit" disabled={!date || !methodId}>
                Registrar el pago
              </Button>
            </div>
          </form>
        )}
        <div className="flex justify-end">
          <DialogClose asChild>
            <Button variant="secondary">Cerrar</Button>
          </DialogClose>
        </div>
        {creatingMethod && <MethodDialog open onOpenChange={setCreatingMethod} method={null} onCreated={setMethodId} />}
      </DialogContent>
    </Dialog>
  );
}

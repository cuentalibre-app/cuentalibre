import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Pencil } from "lucide-react";
import { quarterOfDate } from "@cuentalibre/core";
import type { Contact, Expense } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { useLockedQuarter } from "@/features/closing/closing-store";
import { contactsStore } from "@/features/contacts/contacts-store";
import {
  AttachmentsSection,
  ContactDetails,
  DetailFooter,
  DetailLink,
  DetailList,
  DetailSection,
  focusPanel,
} from "@/features/sales/detail-parts";
import { paymentMethodName } from "@/features/settings/settings-model";
import { formatDate, periodCode } from "@/lib/format";
import { EXPENSE_STATUS, deductibleOf, expensePath, expenseStatus, payeeOf } from "./expenses-model";
import { useExpenses } from "./expenses-store";
import { expenseTypeLabel } from "./purchases-model";

/** The concept of an expense in a list, opening its detail on click. */
export function ExpenseLink({
  doc,
  className,
  title,
  children,
}: {
  doc: Expense;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DetailLink to={expensePath(doc)} onOpen={() => setOpen(true)} className={className} title={title}>
        {children}
      </DetailLink>
      {open && <ExpenseDialog doc={doc} onOpenChange={setOpen} />}
    </>
  );
}

/** Basic information of an expense, as Contasimple shows it for received invoices. */
export function ExpenseDialog({ doc, onOpenChange }: { doc: Expense; onOpenChange: (open: boolean) => void }) {
  // Follows the store, so marking it as paid from the list shows up while it is open
  const current = useExpenses().find((e) => e.id === doc.id) ?? doc;
  const locked = useLockedQuarter()(current.date) !== null;
  const status = EXPENSE_STATUS[expenseStatus(current)];
  const payee = payeeOf(current);
  // A saved supplier shows its address; a one-off payee only has a name and NIF
  const supplier: Contact | undefined = current.supplierId
    ? contactsStore.get("supplier", current.supplierId)
    : undefined;
  const { payment } = current;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-5" onOpenAutoFocus={focusPanel}>
        <div className="flex flex-col gap-1">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {current.concept}
            <Badge tone={status.tone}>{status.label}</Badge>
          </DialogTitle>
          <DialogDescription>{[payee?.name, formatDate(current.date)].filter(Boolean).join(" · ")}</DialogDescription>
        </div>

        <DetailSection title="Información del gasto">
          <DetailList
            items={[
              ["Periodo", periodCode(quarterOfDate(current.date))],
              ["Número de recibo", current.number && <span className="font-mono">{current.number}</span>],
              ["Fecha", formatDate(current.date)],
              ["Concepto", current.concept],
              ["Tipo de gasto", expenseTypeLabel(current.expenseType)],
              ["Importe", <span className="amount font-semibold">{formatEUR(current.amount)}</span>],
              [
                "Imputación",
                <>
                  {current.imputation} % (<span className="amount">{formatEUR(deductibleOf(current))}</span>)
                </>,
              ],
              [
                "Pago",
                payment
                  ? `${formatDate(payment.date)} · ${paymentMethodName(payment.paymentMethodId) ?? "Método eliminado"}`
                  : "Pendiente de pago",
              ],
              ...(current.rental
                ? [["Arrendamiento de inmueble", current.cadastralRef || "Sí"] as [string, ReactNode]]
                : []),
              ["Notas privadas", current.privateNotes.trim()],
            ]}
          />
        </DetailSection>

        {payee && (
          <DetailSection title="Proveedor">
            {supplier ? (
              <ContactDetails contact={supplier} />
            ) : (
              <DetailList
                items={[
                  ["Nombre o razón social", payee.name],
                  ["NIF", payee.taxId && <span className="font-mono">{payee.taxId}</span>],
                ]}
              />
            )}
          </DetailSection>
        )}

        <AttachmentsSection attachments={current.attachments} />

        <DetailFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cerrar</Button>
          </DialogClose>
          <Link to={expensePath(current)} className={cn(buttonVariants(), "no-underline")}>
            <Pencil strokeWidth={1.8} aria-hidden="true" />
            {locked ? "Ver gasto" : "Editar gasto"}
          </Link>
        </DetailFooter>
      </DialogContent>
    </Dialog>
  );
}

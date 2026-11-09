import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Pencil } from "lucide-react";
import { quarterOfDate } from "@cuentalibre/core";
import type { PurchaseInvoice } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { useLockedQuarter } from "@/features/closing/closing-store";
import {
  AttachmentsSection,
  ContactDetails,
  DetailFooter,
  DetailLink,
  DetailList,
  DetailSection,
  focusPanel,
  LinesTable,
  PaymentsTable,
  TotalsList,
  yesNo,
} from "@/features/sales/detail-parts";
import { WITHHOLDING_GROUPS } from "@/features/sales/sales-model";
import { formatDate, periodCode } from "@/lib/format";
import {
  ASSET_CATEGORY_LABELS,
  PURCHASE_OPERATION_TYPES,
  PURCHASE_STATUS,
  deductible,
  expenseTypeLabel,
  purchasePath,
  purchaseStatus,
  purchaseTotals,
  supplierOf,
} from "./purchases-model";
import { usePurchaseInvoices } from "./purchases-store";

/** The number of a received invoice in a list, opening its detail on click. */
export function PurchaseLink({
  doc,
  className,
  children,
}: {
  doc: PurchaseInvoice;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DetailLink to={purchasePath(doc)} onOpen={() => setOpen(true)} className={className}>
        {children}
      </DetailLink>
      {open && <PurchaseDialog doc={doc} onOpenChange={setOpen} />}
    </>
  );
}

/** Basic information of a received invoice or investment good, as the reference app's "Detalle de la factura recibida". */
export function PurchaseDialog({ doc, onOpenChange }: { doc: PurchaseInvoice; onOpenChange: (open: boolean) => void }) {
  // Follows the store, so a payment registered from the list shows up while it is open
  const invoices = usePurchaseInvoices();
  const current = invoices.find((d) => d.id === doc.id) ?? doc;
  const locked = useLockedQuarter()(current.bookedOn) !== null;
  const supplier = supplierOf(current);
  const status = PURCHASE_STATUS[purchaseStatus(current, new Date())];
  const amounts = deductible(current);
  const rectified = current.rectifiesId ? invoices.find((d) => d.id === current.rectifiesId) : undefined;
  const partial = current.imputation !== 100 || (current.vatImputation ?? 100) !== 100;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-5" onOpenAutoFocus={focusPanel}>
        <div className="flex flex-col gap-1">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {current.asset ? "Bien de inversión" : "Factura recibida"} {current.number}
            <Badge tone={status.tone}>{status.label}</Badge>
          </DialogTitle>
          <DialogDescription>
            {supplier.name} · {formatDate(current.issuedOn)}
          </DialogDescription>
        </div>

        <DetailSection title="Información de la factura">
          <DetailList
            items={[
              ["Periodo", periodCode(quarterOfDate(current.bookedOn))],
              ["Número", <span className="tabular-nums">{current.number}</span>],
              ["Fecha de factura", formatDate(current.issuedOn)],
              ...(current.bookedOn !== current.issuedOn
                ? [["Fecha contable", formatDate(current.bookedOn)] as [string, ReactNode]]
                : []),
              ["Vencimiento", current.dueOn && formatDate(current.dueOn)],
              ...(rectified ? [["Abono de", rectified.number] as [string, ReactNode]] : []),
              ...(current.asset
                ? [["Tipo de bien", ASSET_CATEGORY_LABELS[current.asset.category]] as [string, ReactNode]]
                : []),
              ["Tipo de gasto", expenseTypeLabel(current.expenseType)],
              [
                "Retención",
                WITHHOLDING_GROUPS.flatMap((g) => g.options).find((o) => o.value === current.withholding)?.label,
              ],
              ["Imputación", `${current.imputation} %`],
              ["Imputación a IVA", `${current.vatImputation ?? current.imputation} %`],
              ["Tipo de operación", PURCHASE_OPERATION_TYPES.find((o) => o.value === current.operationType)?.label],
              ["Fecha de operación", current.operationOn && formatDate(current.operationOn)],
              ["Criterio de caja", yesNo(current.cashBasis)],
              ["Notas privadas", current.privateNotes.trim()],
            ]}
          />
        </DetailSection>

        <DetailSection title="Proveedor">
          <ContactDetails contact={supplier} />
        </DetailSection>

        <DetailSection title="Conceptos">
          <LinesTable lines={current.lines} />
          <TotalsList totals={purchaseTotals(current)} />
          {partial && (
            <p className="m-0 text-right text-sm text-muted-foreground">
              Deducible: base <span className="amount">{formatEUR(amounts.base)}</span> · IVA{" "}
              <span className="amount">{formatEUR(amounts.vat)}</span>
            </p>
          )}
        </DetailSection>

        <DetailSection title="Pagos">
          <PaymentsTable payments={current.payments} empty="No se ha registrado ningún pago." />
        </DetailSection>

        <AttachmentsSection attachments={current.attachments} />

        <DetailFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cerrar</Button>
          </DialogClose>
          <Link to={purchasePath(current)} className={cn(buttonVariants(), "no-underline")}>
            <Pencil strokeWidth={1.8} aria-hidden="true" />
            {locked ? "Ver factura" : "Editar factura"}
          </Link>
        </DetailFooter>
      </DialogContent>
    </Dialog>
  );
}

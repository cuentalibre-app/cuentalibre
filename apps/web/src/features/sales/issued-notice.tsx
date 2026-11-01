import { useState } from "react";
import { Link } from "react-router";
import { Lock } from "lucide-react";
import type { SalesDocument, VerifactuStatus } from "@cuentalibre/contracts";
import { Badge, type BadgeProps } from "@cuentalibre/ui/components/badge";
import { cn } from "@cuentalibre/ui/lib/cn";
import { useLockedQuarter } from "@/features/closing/closing-store";
import { useCompliance } from "@/features/settings/compliance-store";
import { CorrectRecordDialog } from "./correct-record-dialog";
import { salesStore, useSalesDocuments } from "./sales-store";
import { KINDS, isFullyRectified, originalToRectify } from "./sales-model";

export const VERIFACTU_STATUS: Record<VerifactuStatus, { label: string; tone: BadgeProps["tone"] }> = {
  pending: { label: "Pendiente de envío", tone: "primary" },
  accepted: { label: "Registrada en la AEAT", tone: "success" },
  acceptedWithErrors: { label: "Registrada con errores", tone: "warning" },
  rejected: { label: "Rechazada por la AEAT", tone: "danger" },
};

/** A record the AEAT rejected or accepted with errors is corrected and sent again (subsanación). */
export const needsCorrection = (invoice: SalesDocument) =>
  invoice.issued?.verifactu?.status === "rejected" || invoice.issued?.verifactu?.status === "acceptedWithErrors";

/**
 * Shown on an issued invoice: it can be read but not changed, only corrected
 * with a rectifying invoice. A business exempt from VERI*FACTU can still delete it.
 * When the AEAT rejected its record or found errors in it, the client's data
 * can be fixed and the record sent again.
 */
export function IssuedNotice({ invoice: opened }: { invoice: SalesDocument }) {
  // The page keeps the invoice as it opened; its VERI*FACTU state changes while it is shown
  const invoice = useSalesDocuments().find((doc) => doc.id === opened.id) ?? opened;
  const verifactu = invoice.issued?.verifactu;
  const exempt = useCompliance().verifactu.system === "exempt" && !verifactu;
  // A rectifying invoice is undone by rectifying its original again
  const original = originalToRectify(invoice, salesStore.all());
  const rectifiable = original && !(invoice.series === "normal" && isFullyRectified(original, salesStore.all()));
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg bg-muted px-4 py-3 text-sm">
      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Lock className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        <span>
          {exempt
            ? "Esta factura está emitida: no se puede modificar, pero sí eliminar desde el listado."
            : "Esta factura está emitida: no se puede modificar ni eliminar."}
          {rectifiable && " Para corregirla, genera una factura rectificativa."}
        </span>
        {rectifiable && (
          <Link
            to={`${KINDS.invoice.newPath}?desde=${invoice.id}&rectificar=1`}
            className="font-medium text-primary no-underline hover:text-primary-hover"
          >
            Generar factura rectificativa
          </Link>
        )}
      </p>
      <VerifactuState invoice={invoice} />
    </div>
  );
}

/**
 * Where an issued invoice's VERI*FACTU record stands with the AEAT and, when
 * it rejected the record or found errors in it, why, with the way to correct it.
 */
export function VerifactuState({ invoice, title = "VERI*FACTU" }: { invoice: SalesDocument; title?: string }) {
  const verifactu = invoice.issued?.verifactu;
  const lockedQuarterOf = useLockedQuarter();
  const correctable = needsCorrection(invoice) && !lockedQuarterOf(invoice.issuedOn);
  const [correcting, setCorrecting] = useState(false);
  if (!verifactu) return null;
  // Only a record the AEAT holds is found by its checker
  const recorded = verifactu.status === "accepted" || verifactu.status === "acceptedWithErrors";
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
        {title && <span className="font-medium">{title}</span>}
        <Badge tone={VERIFACTU_STATUS[verifactu.status].tone}>{VERIFACTU_STATUS[verifactu.status].label}</Badge>
        {correctable && (
          <button
            type="button"
            onClick={() => setCorrecting(true)}
            className="cursor-pointer border-0 bg-transparent p-0 font-medium text-primary hover:text-primary-hover"
          >
            Corregir y reenviar
          </button>
        )}
        {recorded && (
          <a
            href={verifactu.qrUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary no-underline hover:text-primary-hover"
          >
            Comprobar en la AEAT
          </a>
        )}
      </p>
      {verifactu.error && (
        <p className={cn("m-0", verifactu.status === "rejected" ? "text-foreground" : "text-muted-foreground")}>
          {verifactu.error}
        </p>
      )}
      {correcting && <CorrectRecordDialog invoice={invoice} onOpenChange={setCorrecting} />}
    </div>
  );
}

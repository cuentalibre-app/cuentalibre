import { Link } from "react-router";
import { Lock } from "lucide-react";
import type { SalesDocument, VerifactuStatus } from "@cuentalibre/contracts";
import { Badge, type BadgeProps } from "@cuentalibre/ui/components/badge";
import { useCompliance } from "@/features/settings/compliance-store";
import { KINDS } from "./sales-model";

const VERIFACTU_STATUS: Record<VerifactuStatus, { label: string; tone: BadgeProps["tone"] }> = {
  pending: { label: "Pendiente de envío", tone: "primary" },
  accepted: { label: "Registrada en la AEAT", tone: "success" },
  acceptedWithErrors: { label: "Registrada con errores", tone: "warning" },
  rejected: { label: "Rechazada por la AEAT", tone: "danger" },
};

/**
 * Shown on an issued invoice: it can be read but not changed, only corrected
 * with a rectifying invoice. A business exempt from VERI*FACTU can still delete it.
 */
export function IssuedNotice({ invoice }: { invoice: SalesDocument }) {
  const verifactu = invoice.issued?.verifactu;
  const exempt = useCompliance().verifactu.system === "exempt" && !verifactu;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg bg-muted px-4 py-3 text-sm">
      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Lock className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        <span>
          {exempt
            ? "Esta factura está emitida: no se puede modificar, pero sí eliminar desde el listado."
            : "Esta factura está emitida: no se puede modificar ni eliminar."}
          {invoice.series === "normal" && " Para corregirla, genera una factura rectificativa."}
        </span>
        {invoice.series === "normal" && (
          <Link
            to={`${KINDS.invoice.newPath}?desde=${invoice.id}&rectificar=1`}
            className="font-medium text-primary no-underline hover:text-primary-hover"
          >
            Generar factura rectificativa
          </Link>
        )}
      </p>
      {verifactu && (
        <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">VERI*FACTU</span>
          <Badge tone={VERIFACTU_STATUS[verifactu.status].tone}>{VERIFACTU_STATUS[verifactu.status].label}</Badge>
          {verifactu.error && <span className="text-muted-foreground">{verifactu.error}</span>}
          <a
            href={verifactu.qrUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary no-underline hover:text-primary-hover"
          >
            Comprobar en la AEAT
          </a>
        </p>
      )}
    </div>
  );
}

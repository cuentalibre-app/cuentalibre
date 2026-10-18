import { Link } from "react-router";
import { Lock } from "lucide-react";
import type { SalesDocument } from "@fiscalia/contracts";
import { KINDS } from "./sales-model";

/** Shown on an issued invoice: it can be read but not changed, only corrected with a rectifying invoice. */
export function IssuedNotice({ invoice }: { invoice: SalesDocument }) {
  return (
    <p role="status" className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-muted px-4 py-3 text-sm">
      <Lock className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
      <span>
        Esta factura está emitida: no se puede modificar ni eliminar.
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
  );
}

import { Link } from "react-router";
import { buttonVariants } from "@cuentalibre/ui/components/button";
import { Lock } from "lucide-react";
import type { SalesDocument } from "@cuentalibre/contracts";
import { salesStore } from "./sales-store";
import { KINDS, isFullyRectified, originalToRectify } from "./sales-model";

/**
 * Shown on an issued invoice: it can be read but not changed, only corrected
 * with a rectifying invoice, or deleted from the list.
 */
export function IssuedNotice({ invoice }: { invoice: SalesDocument }) {
  // A rectifying invoice is undone by rectifying its original again
  const original = originalToRectify(invoice, salesStore.all());
  const rectifiable = original && !(invoice.series === "normal" && isFullyRectified(original, salesStore.all()));
  return (
    <div role="status" className="flex flex-col gap-2 rounded-xl bg-muted px-3.5 py-3 text-sm">
      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Lock className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        <span>
          Esta factura está emitida: no se puede modificar, pero sí eliminar desde el listado.
          {rectifiable && " Para corregirla, genera una factura rectificativa."}
        </span>
        {rectifiable && (
          <Link
            to={`${KINDS.invoice.newPath}?desde=${invoice.id}&rectificar=1`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Generar factura rectificativa
          </Link>
        )}
      </p>
    </div>
  );
}

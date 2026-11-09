import { useEffect, useState } from "react";
import { CircleAlert, X } from "lucide-react";
import { Button } from "@cuentalibre/ui/components/button";
import { ApiError } from "@/data/api";
import { onCommandError } from "@/data/backend";
import { refreshBilling } from "@/features/settings/billing-store";

/** What the user reads when the server rejects a change, by the API's error code. */
const MESSAGES: Record<string, string> = {
  quarter_closed: "El trimestre de esa fecha está cerrado. Reábrelo para registrar o cambiar documentos en él.",
  date_out_of_order:
    "Ya hay una factura de la serie con una fecha posterior: la nueva no puede tener una fecha anterior.",
  number_taken: "Ya existe una factura con ese número.",
  already_issued: "Esa factura ya estaba emitida.",
  issuer_missing:
    "Para emitir facturas, tu empresa necesita su NIF, su nombre fiscal y su dirección. Complétalos en Configuración › Datos de la empresa.",
  invalid_attachment: "No se ha podido subir uno de los archivos adjuntos. Vuelve a adjuntarlo.",
  file_too_large: "Uno de los archivos adjuntos es demasiado grande para subirlo.",
  storage_quota_exceeded: "Tu empresa ha llegado al límite de espacio para archivos y no caben más adjuntos.",
  subscription_required: "Tu empresa está en solo lectura. Suscríbete para volver a guardar cambios.",
};

function messageOf(error: unknown) {
  const detail = error instanceof ApiError ? MESSAGES[error.code] : undefined;
  return `No se ha guardado el último cambio y se ha deshecho. ${detail ?? "Revisa los datos e inténtalo de nuevo."}`;
}

/** Tells the user that a change was rejected by the server and undone, instead of letting it vanish. */
export function CommandErrorNotice() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(
    () =>
      onCommandError((error) => {
        console.warn("Change rejected:", error);
        setMessage(messageOf(error));
        // The trial may have ended since the plan loaded: show the read-only banner
        if (error instanceof ApiError && error.code === "subscription_required") void refreshBilling();
      }),
    [],
  );
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start justify-center gap-2 bg-destructive-soft px-4 py-2 text-sm text-destructive"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      <span>{message}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Cerrar el aviso"
        onClick={() => setMessage(null)}
        className="-my-1.5"
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}

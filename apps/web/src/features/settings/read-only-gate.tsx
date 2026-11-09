import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Lock } from "lucide-react";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { EXPORT_PATH } from "@/features/transfer/transfer-model";
import { planState } from "./billing-model";
import { useBilling } from "./billing-store";
import { BILLING_PATH } from "./settings-model";

/**
 * Shows a page that only creates (a new invoice, an import…) while the company can still write.
 * Read-only, it explains why instead, so nobody fills in a form the server would then reject.
 */
export function RequireWritable({ children }: { children: ReactNode }) {
  const billing = useBilling();
  const navigate = useNavigate();
  // Opened from outside the app (a bookmark, a new tab), there is no page of ours to go back to
  const back = useLocation().key === "default" ? () => void navigate("/") : () => void navigate(-1);
  if (!billing || billing.plan.canWrite) return children;
  const ended = planState(billing) === "subscriptionEnded" ? "Tu suscripción ha terminado" : "Tu prueba ha terminado";

  return (
    <div className="flex flex-col items-center gap-2 px-5 py-20 text-center">
      <span className="mb-1 flex size-11 items-center justify-center rounded-lg bg-warning-soft text-warning">
        <Lock strokeWidth={1.8} aria-hidden="true" />
      </span>
      <h1 className="m-0 text-xl font-semibold tracking-tight">{ended}</h1>
      <p className="m-0 max-w-sm text-muted-foreground">
        Tu empresa está en solo lectura: puedes consultar y exportar todo, pero para crear o importar necesitas una
        suscripción.
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Link to={BILLING_PATH} className={buttonVariants()}>
          Suscribirme
        </Link>
        <Link to={EXPORT_PATH} className={buttonVariants({ variant: "secondary" })}>
          Exportar mis datos
        </Link>
      </div>
      <Button variant="secondary" onClick={back} className="mt-2">
        Volver
      </Button>
    </div>
  );
}

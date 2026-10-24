import { Link } from "react-router";
import { Lock } from "lucide-react";
import { EXPORT_PATH } from "@/features/transfer/transfer-model";
import { planState } from "./billing-model";
import { useBilling } from "./billing-store";
import { BILLING_PATH } from "./settings-model";

/**
 * Says the company can only read once its trial or subscription ended, with the way
 * back and a way to take its data. It can't be closed: every change would fail.
 */
export function ReadOnlyBanner() {
  const billing = useBilling();
  if (!billing || billing.plan.canWrite) return null;
  const ended = planState(billing) === "subscriptionEnded" ? "Tu suscripción ha terminado." : "Tu prueba ha terminado.";

  return (
    <div className="flex items-center justify-center gap-3 bg-warning-soft px-4 py-2 text-sm text-foreground">
      <Lock className="hidden size-4 shrink-0 text-warning sm:block" aria-hidden="true" />
      <p className="m-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
        <span>{ended}</span>
        <span className="flex gap-3">
          <Link to={BILLING_PATH} className="font-semibold text-primary hover:text-primary-hover">
            Suscribirme
          </Link>
          <Link to={EXPORT_PATH} className="font-medium text-primary hover:text-primary-hover">
            Exportar
          </Link>
        </span>
      </p>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { CircleCheck, X } from "lucide-react";
import { Button } from "@cuentalibre/ui/components/button";
import { refreshBilling } from "./billing-store";

/**
 * Confirms the subscription to whoever paid from the welcome steps: Stripe sends them
 * back to the app's home with ?suscripcion=ok. The plan page has its own confirmation.
 */
export function SubscribedNotice() {
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [shown, setShown] = useState(() => pathname === "/" && searchParams.get("suscripcion") === "ok");

  useEffect(() => {
    if (!shown || !searchParams.has("suscripcion")) return;
    setSearchParams({}, { replace: true });
    void refreshBilling();
  }, [shown, searchParams, setSearchParams]);

  if (!shown) return null;
  return (
    <div role="status" className="flex items-start justify-center gap-2 bg-success-soft px-4 py-2 text-sm">
      <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={1.8} aria-hidden="true" />
      <span>
        <strong className="font-semibold text-success">Suscripción activada.</strong> No se cobra nada hasta que acaben
        tus 30 días gratis.
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Cerrar el aviso"
        onClick={() => setShown(false)}
        className="-my-1.5"
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}

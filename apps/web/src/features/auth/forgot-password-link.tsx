import { useEffect, useState } from "react";
import { Button } from "@cuentalibre/ui/components/button";
import { cn } from "@cuentalibre/ui/lib/cn";
import { Check } from "lucide-react";
import { currentUser, requestPasswordReset, signInMethods } from "./auth-api";

/**
 * "Forgot it?" next to a field asking the signed-in user for their password:
 * emails them a link to choose a new one, on instances that send email.
 */
export function ForgotPasswordLink() {
  const [available, setAvailable] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  useEffect(() => {
    let active = true;
    void signInMethods().then(({ email }) => active && setAvailable(email));
    return () => {
      active = false;
    };
  }, []);

  if (!available) return null;

  if (state === "sent") {
    return (
      <span role="status" className="flex items-center gap-1 text-sm text-success">
        <Check className="size-4" aria-hidden="true" />
        Enlace enviado a tu email
      </span>
    );
  }

  const send = async () => {
    setState("sending");
    try {
      const { email } = await currentUser();
      await requestPasswordReset(email);
      setState("sent");
    } catch {
      setState("failed");
    }
  };

  return (
    <Button
      variant="link"
      disabled={state === "sending"}
      onClick={() => void send()}
      className={cn("text-sm", state === "failed" && "text-destructive hover:text-destructive")}
    >
      {state === "sending"
        ? "Enviando enlace…"
        : state === "failed"
          ? "No se pudo enviar. Reintentar"
          : "¿La has olvidado?"}
    </Button>
  );
}

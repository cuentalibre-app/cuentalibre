import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { Link } from "react-router";
import { MailWarning, X } from "lucide-react";
import { ACCESS_PATH } from "@/features/settings/settings-model";
import { userStore, useEmailVerified, useUserSettings } from "@/features/settings/user-store";
import { signInMethods } from "./auth-api";
import { VerifyEmailDialog } from "./email-code";
import { sessionState } from "./session";

/** Closing the reminder hides it until the browser tab closes. */
const DISMISSED_KEY = "cuentalibre:verify-email-dismissed";

function wasDismissed() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Reminds the user their email isn't verified yet, with a way to verify it
 * on the spot; it goes away once verified. Only on instances that send email.
 */
export function VerifyEmailBanner() {
  const verified = useEmailVerified();
  const { profile } = useUserSettings();
  const [canSend, setCanSend] = useState(false);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [open, setOpen] = useState(false);
  const pending = sessionState() === "connected" && !verified && !dismissed;

  useEffect(() => {
    if (pending) void signInMethods().then((methods) => setCanSend(methods.email));
  }, [pending]);

  if (!pending || !canSend) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage blocked: it stays hidden until the page reloads.
    }
    setDismissed(true);
  };

  return (
    <div className="flex items-center gap-3 bg-warning-soft px-4 py-2 text-sm text-foreground">
      <MailWarning className="hidden size-4 shrink-0 text-warning sm:block" aria-hidden="true" />
      <p className="m-0 flex flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center sm:justify-start sm:text-left">
        <span>Tu email no está verificado: sin él no podrás recuperar tu cuenta si olvidas la contraseña.</span>
        <span className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Verificar mi email
          </Button>
          <Link to={ACCESS_PATH} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Credenciales de acceso
          </Link>
        </span>
      </p>
      <Button variant="ghost" size="icon-sm" aria-label="Cerrar el aviso" onClick={dismiss} className="-my-1.5">
        <X aria-hidden="true" />
      </Button>
      <VerifyEmailDialog
        email={profile.email}
        open={open}
        onOpenChange={setOpen}
        onVerified={userStore.emailVerified}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Button } from "@cuentalibre/ui/components/button";
import { authErrorMessage, signInMethods, signInWithGoogle } from "./auth-api";
import { LegalConsent } from "./legal-consent";
import { GoogleLogo } from "./provider-logos";
import { leaveDemo } from "./session";

interface GoogleSignInProps {
  intent: "sign-in" | "sign-up";
  /** Where signing in comes back to, in the app. */
  returnPath?: string;
  onError: (message: string) => void;
}

/**
 * "Continue with Google" above the email form, on instances that have it set up.
 * It creates the account if there is none, so signing in says what that accepts.
 */
export function GoogleSignIn({ intent, returnPath, onError }: GoogleSignInProps) {
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    void signInMethods().then(({ google }) => active && setAvailable(google));
    return () => {
      active = false;
    };
  }, []);

  if (!available) return null;

  const start = async () => {
    setPending(true);
    try {
      leaveDemo();
      await signInWithGoogle(intent, returnPath);
    } catch (error) {
      onError(authErrorMessage(error));
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Button
        variant="secondary"
        size="xl"
        className="w-full bg-background"
        disabled={pending}
        onClick={() => void start()}
      >
        <GoogleLogo />
        {pending ? "Un momento…" : "Continuar con Google"}
      </Button>
      {intent === "sign-in" && (
        <div className="-mt-2 text-center">
          <LegalConsent lead="Si no tienes cuenta, se crea y aceptas los" />
        </div>
      )}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />o con tu email
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

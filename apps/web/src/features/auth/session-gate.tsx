import type { ReactNode } from "react";
import { cn } from "@cuentalibre/ui/lib/cn";
import { buttonVariants } from "@cuentalibre/ui/components/button";
import { Navigate, useLocation } from "react-router";
import { AuthButton, AuthLayout } from "./auth-layout";
import {
  API_URL,
  DEMO_PATH,
  ONBOARDING_PATH,
  SIGN_UP_PATH,
  canExitDemo,
  exitDemo,
  leaveDemo,
  reloadAt,
  sessionState,
  signInPath,
} from "./session";

/** Lets the app through once it runs on the API or the demo; otherwise sends the user where they need to go. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  switch (sessionState()) {
    case "connected":
    case "demo":
      return children;
    case "signed-out":
      return <Navigate to={signInPath({ back: `${pathname}${search}` })} replace />;
    case "no-organization":
      return <Navigate to={ONBOARDING_PATH} replace />;
    case "unavailable":
      return (
        <AuthLayout title="No se puede conectar" description="El servidor de cuentalibre no responde ahora mismo.">
          <AuthButton onClick={() => reloadAt(window.location.pathname)}>Reintentar</AuthButton>
          <a href={DEMO_PATH} className="text-center font-medium text-primary hover:text-primary-hover">
            Probar la demo mientras tanto
          </a>
        </AuthLayout>
      );
  }
}

/** Sign-in and sign-up only make sense with an API and without a session. */
export function GuestOnly({ children }: { children: ReactNode }) {
  if (!API_URL || sessionState() === "connected") return <Navigate to="/" replace />;
  return children;
}

/** Reminds the user the demo runs on sample data, with a way into a real account. */
export function DemoBanner() {
  if (sessionState() !== "demo") return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-primary-soft px-4 py-2 text-center text-sm text-foreground">
      <span>Estás en la demo: los datos son de ejemplo y los cambios no se guardan.</span>
      <span className="flex gap-2">
        {API_URL && (
          // A plain link: it loads the app outside /demo, on the API
          <a href={SIGN_UP_PATH} onClick={leaveDemo} className={cn(buttonVariants({ size: "sm" }), "no-underline")}>
            Crear cuenta
          </a>
        )}
        {canExitDemo() && (
          <button
            type="button"
            onClick={exitDemo}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "no-underline")}
          >
            Salir de la demo
          </button>
        )}
      </span>
    </div>
  );
}

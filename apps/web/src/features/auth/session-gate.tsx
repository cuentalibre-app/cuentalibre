import type { ReactNode } from "react";
import { Link, Navigate } from "react-router";
import { Button } from "@fiscalia/ui/components/button";
import { AuthLayout } from "./auth-layout";
import {
  API_URL,
  DEMO_PATH,
  ONBOARDING_PATH,
  SIGN_IN_PATH,
  SIGN_UP_PATH,
  leaveDemo,
  reloadAt,
  sessionState,
} from "./session";

/** Lets the app through once it runs on the API or the demo; otherwise sends the user where they need to go. */
export function RequireSession({ children }: { children: ReactNode }) {
  switch (sessionState()) {
    case "connected":
    case "demo":
      return children;
    case "signed-out":
      return <Navigate to={SIGN_IN_PATH} replace />;
    case "no-organization":
      return <Navigate to={ONBOARDING_PATH} replace />;
    case "unavailable":
      return (
        <AuthLayout title="No se puede conectar" description="El servidor de Fiscalia no responde ahora mismo.">
          <Button onClick={() => reloadAt(window.location.pathname)} className="w-full">
            Reintentar
          </Button>
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
      {API_URL && (
        <span className="flex gap-3">
          <Link to={SIGN_UP_PATH} onClick={leaveDemo} className="font-semibold text-primary hover:text-primary-hover">
            Crear cuenta
          </Link>
          <Link to={SIGN_IN_PATH} onClick={leaveDemo} className="font-medium text-primary hover:text-primary-hover">
            Entrar
          </Link>
        </span>
      )}
    </div>
  );
}

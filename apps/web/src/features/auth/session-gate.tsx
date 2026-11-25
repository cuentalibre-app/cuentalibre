import { useTranslation } from "react-i18next";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@cuentalibre/ui/lib/cn";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
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
          <a href={DEMO_PATH} className={cn(buttonVariants({ variant: "link" }), "self-center")}>
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

/**
 * Reminds the user the demo runs on sample data, with a way into a real account. It stays pinned on
 * scroll and publishes its height as --demo-banner-h, so sticky things (the sidebar) sit below it.
 */
export function DemoBanner() {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const demo = sessionState() === "demo";

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty("--demo-banner-h", `${el.offsetHeight}px`));
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--demo-banner-h");
    };
  }, [demo]);

  if (!demo) return null;
  return (
    <div
      ref={ref}
      className="sticky top-0 z-30 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-primary-soft px-4 py-2 text-center text-sm text-foreground"
    >
      <span>{t("demo.banner")}</span>
      <span className="flex gap-2">
        {API_URL && (
          // A plain link: it loads the app outside /demo, on the API
          <a href={SIGN_UP_PATH} onClick={leaveDemo} className={buttonVariants({ size: "sm" })}>
            {t("demo.createAccount")}
          </a>
        )}
        {canExitDemo() && (
          <Button variant="secondary" size="sm" onClick={exitDemo}>
            {t("userMenu.exitDemo")}
          </Button>
        )}
      </span>
    </div>
  );
}

import { Outlet, useLocation } from "react-router";
import { DemoBanner } from "@/features/auth/session-gate";
import { VerifyEmailBanner } from "@/features/auth/verify-email-banner";
import { ReadOnlyBanner } from "@/features/settings/read-only-banner";
import { SubscribedNotice } from "@/features/settings/subscribed-notice";
import { FirstRunTour } from "@/features/tour/first-run-tour";
import { BottomNav } from "./bottom-nav";
import { CommandErrorNotice } from "./command-error-notice";
import { Sidebar } from "./sidebar";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";

export function AppLayout() {
  const { pathname } = useLocation();
  const [collapsed, toggleSidebar] = useSidebarCollapsed();

  return (
    <>
      <DemoBanner />
      <ReadOnlyBanner />
      <SubscribedNotice />
      <VerifyEmailBanner />
      <CommandErrorNotice />
      <div className="relative isolate flex min-h-dvh bg-canvas">
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-aurora" />
        <a
          href="#main"
          className="sr-only z-20 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Saltar al contenido
        </a>
        <Sidebar className="hidden lg:flex" collapsed={collapsed} onToggle={toggleSidebar} />
        <main id="main" className="min-w-0 flex-1 pb-24 lg:pb-0">
          {/* Keyed by path so each page plays its entrance; query changes (e.g. ?periodo) don't */}
          <div key={pathname} className="animate-page-in">
            <Outlet />
          </div>
        </main>
        <BottomNav className="lg:hidden" />
      </div>
      <FirstRunTour />
    </>
  );
}

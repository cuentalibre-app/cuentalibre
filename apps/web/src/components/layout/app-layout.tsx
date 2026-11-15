import { Outlet, useLocation } from "react-router";
import { DemoBanner } from "@/features/auth/session-gate";
import { VerifyEmailBanner } from "@/features/auth/verify-email-banner";
import { ReadOnlyBanner } from "@/features/settings/read-only-banner";
import { SubscribedNotice } from "@/features/settings/subscribed-notice";
import { FirstRunTour } from "@/features/tour/first-run-tour";
import { HelpChatPanel } from "@/features/help-chat/help-chat-panel";
import { HelpChatSheet } from "@/features/help-chat/help-chat-sheet";
import { useHelpChatAvailable } from "@/features/help-chat/help-chat-store";
import { BottomNav } from "./bottom-nav";
import { CommandErrorNotice } from "./command-error-notice";
import { Sidebar } from "./sidebar";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";

export function AppLayout() {
  const { pathname } = useLocation();
  const { collapsed, canExpand, toggle } = useSidebarCollapsed();
  const helpChat = useHelpChatAvailable();

  return (
    <>
      <DemoBanner />
      <ReadOnlyBanner />
      <SubscribedNotice />
      <VerifyEmailBanner />
      <CommandErrorNotice />
      <div className="relative isolate flex min-h-dvh bg-canvas">
        <a
          href="#main"
          className="sr-only z-20 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Saltar al contenido
        </a>
        <Sidebar className="hidden lg:flex" collapsed={collapsed} onToggle={canExpand ? toggle : undefined} />
        <main
          id="main"
          className="@container min-w-0 flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:my-2 lg:mr-2 lg:min-h-[calc(100dvh-1rem)] lg:rounded-xl lg:border lg:border-border lg:bg-background lg:pb-0"
        >
          {/* Keyed by path so each page plays its entrance; query changes (e.g. ?periodo) don't */}
          <div key={pathname} className="animate-page-in">
            <Outlet />
          </div>
        </main>
        {helpChat && <HelpChatPanel className="hidden lg:block" />}
        <BottomNav className="lg:hidden" />
      </div>
      {helpChat && <HelpChatSheet />}
      <FirstRunTour />
    </>
  );
}

import { Outlet, useLocation } from "react-router";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

export function AppLayout() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-20 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <Sidebar className="hidden lg:flex" />
      <main id="main" className="min-w-0 flex-1 pb-24 lg:pb-0">
        {/* Keyed by path so each page plays its entrance; query changes (e.g. ?periodo) don't */}
        <div key={pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>
      <BottomNav className="lg:hidden" />
    </div>
  );
}

import { Outlet } from "react-router";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

export function AppLayout() {
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
        <Outlet />
      </main>
      <BottomNav className="lg:hidden" />
    </div>
  );
}

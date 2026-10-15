import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@fiscalia/ui/components/button";
import { cn } from "@fiscalia/ui/lib/cn";
import { currentUser } from "@/mocks/data";
import { CreateMenu } from "./create-menu";
import { mainNav, secondaryNav, type NavItem } from "./nav";
import { useNavBadges } from "./use-nav-badges";

const itemClass =
  "flex h-10 items-center gap-3 rounded-lg px-3 font-semibold text-sidebar-foreground no-underline transition-colors hover:bg-sidebar-accent";
const subItemClass =
  "flex h-9 items-center justify-between rounded-md px-3 text-sidebar-foreground no-underline transition-colors hover:bg-sidebar-accent";
const activeClass = "bg-sidebar-accent";

function NavGroup({ item, badges }: { item: NavItem; badges: ReturnType<typeof useNavBadges> }) {
  const { pathname } = useLocation();
  const isCurrent = pathname.startsWith(item.to);
  const [open, setOpen] = useState(isCurrent || item.to === "/ventas");
  const Icon = item.icon;
  const Chevron = open ? ChevronDown : ChevronRight;
  const id = `nav-group-${item.to.slice(1)}`;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(itemClass, "w-full cursor-pointer text-left")}
      >
        <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
        <span className="flex-1">{item.label}</span>
        <Chevron className="size-4" aria-hidden="true" />
      </button>
      <div id={id} hidden={!open} className="flex flex-col gap-0.5 pl-8">
        {item.children!.map((child) => (
          <NavLink key={child.to} to={child.to} className={({ isActive }) => cn(subItemClass, isActive && activeClass)}>
            {child.label}
            {child.badge && badges[child.badge] > 0 && (
              <span className="font-mono text-xs text-muted-foreground">{badges[child.badge]}</span>
            )}
          </NavLink>
        ))}
      </div>
    </>
  );
}

export function Sidebar({ className }: { className?: string }) {
  const badges = useNavBadges();

  return (
    <nav
      aria-label="Principal"
      className={cn(
        "sticky top-0 h-dvh w-[264px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3.5 py-5",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-2.5 pt-1 pb-4">
        <div className="size-7 rounded-md bg-primary" aria-hidden="true" />
        <span className="text-md font-semibold">Fiscalia</span>
      </div>

      <CreateMenu contentClassName="w-[var(--radix-dropdown-menu-trigger-width)]">
        <Button variant="secondary" className="mb-4 w-full font-semibold">
          <Plus strokeWidth={2} aria-hidden="true" />
          Crear
        </Button>
      </CreateMenu>

      {mainNav.map((item) => {
        if (item.children) return <NavGroup key={item.to} item={item} badges={badges} />;
        const Icon = item.icon;
        const count = item.badge ? badges[item.badge] : 0;
        return (
          <NavLink key={item.to} to={item.to} end className={({ isActive }) => cn(itemClass, isActive && activeClass)}>
            <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
            {count > 0 && (
              <span className="rounded-full bg-warning px-2 py-0.5 text-2xs font-semibold text-warning-foreground">
                {count}
                <span className="sr-only"> presentaciones próximas</span>
              </span>
            )}
          </NavLink>
        );
      })}

      <div className="mx-2 my-3 h-px bg-sidebar-border" />

      {secondaryNav.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => cn(subItemClass, isActive && activeClass)}>
          {item.label}
        </NavLink>
      ))}

      <div className="flex-1" />

      <div className="flex items-center gap-2.5 border-t border-sidebar-border p-3">
        <div
          className="grid size-8 shrink-0 place-items-center rounded-full bg-muted-strong text-xs font-semibold"
          aria-hidden="true"
        >
          {currentUser.initials}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-semibold">{currentUser.name}</span>
          <span className="truncate text-xs text-muted-foreground">{currentUser.taxRegime}</span>
        </div>
      </div>
    </nav>
  );
}

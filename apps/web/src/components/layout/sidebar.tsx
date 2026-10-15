import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@fiscalia/ui/components/button";
import { cn } from "@fiscalia/ui/lib/cn";
import { currentUser } from "@/mocks/data";
import { CreateMenu } from "./create-menu";
import { mainNav, secondaryNav, type NavItem } from "./nav";
import { useNavBadges } from "./use-nav-badges";

const itemClass =
  "flex h-10 shrink-0 items-center gap-3 rounded-lg px-3 font-semibold text-sidebar-foreground no-underline transition-[background-color,scale] duration-150 hover:bg-sidebar-accent active:scale-[0.98]";
const subItemClass =
  "flex h-9 shrink-0 items-center justify-between rounded-md px-3 text-sidebar-foreground no-underline transition-[background-color,scale] duration-150 hover:bg-sidebar-accent active:scale-[0.98]";
const activeClass = "bg-sidebar-accent";

function NavGroup({ item, badges }: { item: NavItem; badges: ReturnType<typeof useNavBadges> }) {
  const { pathname } = useLocation();
  const isCurrent = pathname.startsWith(item.to);
  const [open, setOpen] = useState(isCurrent || item.to === "/ventas");
  const Icon = item.icon;
  const id = `nav-group-${item.to.slice(1)}`;

  // One flex item for the whole group, so a collapsed panel doesn't add an extra gap
  return (
    <div className="flex shrink-0 flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(itemClass, "w-full cursor-pointer text-left")}
      >
        <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
        <span className="flex-1">{item.label}</span>
        <ChevronRight
          className={cn("size-4 transition-transform duration-200 ease-out", open && "rotate-90")}
          aria-hidden="true"
        />
      </button>
      {/* Animates its height by transitioning the grid row between 0fr and 1fr */}
      <div
        id={id}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-250 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-0.5 pt-1 pl-8">
            {item.children!.map((child) => (
              <NavLink key={child.to} to={child.to} className={({ isActive }) => cn(subItemClass, isActive && activeClass)}>
                {child.label}
                {child.badge && badges[child.badge] > 0 && (
                  <span className="font-mono text-xs text-muted-foreground">{badges[child.badge]}</span>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
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
      <div className="flex shrink-0 items-center gap-2.5 px-2.5 pt-1 pb-4">
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

      <div className="mx-2 my-3 h-px shrink-0 bg-sidebar-border" />

      {secondaryNav.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => cn(subItemClass, isActive && activeClass)}>
          {item.label}
        </NavLink>
      ))}

      <div className="flex-1" />

      <div className="flex shrink-0 items-center gap-2.5 border-t border-sidebar-border p-3">
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

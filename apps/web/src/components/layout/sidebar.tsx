import { useState, type ComponentProps, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { ChevronRight, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { Button } from "@fiscalia/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@fiscalia/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { currentUser } from "@/mocks/data";
import { CreateMenu } from "./create-menu";
import { mainNav, secondaryNav, type NavItem } from "./nav";
import { useHoverMenu } from "./use-hover-menu";
import { useNavBadges } from "./use-nav-badges";

type Badges = ReturnType<typeof useNavBadges>;

// Items keep the same left padding in both modes, so icons stay put while the width animates
const itemClass =
  "flex h-9 shrink-0 items-center gap-3 overflow-hidden rounded-lg px-3 font-semibold whitespace-nowrap text-sidebar-foreground no-underline transition-[background-color,scale] duration-150 hover:bg-sidebar-accent active:scale-[0.98]";
const subItemClass =
  "flex h-8 shrink-0 items-center justify-between rounded-md px-3 text-sidebar-foreground no-underline transition-[background-color,scale] duration-150 hover:bg-sidebar-accent active:scale-[0.98]";
const activeClass = "bg-sidebar-accent";
// NavLink marks the current page with aria-current; a static class survives the tooltip's prop merge,
// which would stringify NavLink's function form of className
const currentClass = "aria-[current=page]:bg-sidebar-accent";

/** Fades labels out before the rail narrows and back in once it has widened. */
function labelClass(collapsed: boolean) {
  return cn("transition-opacity", collapsed ? "opacity-0 duration-100" : "opacity-100 delay-100 duration-200");
}

function NavIcon({ item, dot }: { item: NavItem; dot?: boolean }) {
  const Icon = item.icon;
  return (
    <span className="relative shrink-0">
      <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
      {dot && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-warning ring-2 ring-sidebar" />}
    </span>
  );
}

interface RailTooltipProps extends ComponentProps<typeof TooltipTrigger> {
  label: ReactNode;
  enabled: boolean;
  side?: "right" | "bottom";
}

/** Names an icon in the rail after a short hover; renders only the trigger while disabled. */
function RailTooltip({ label, enabled, side = "right", children, ...props }: RailTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild {...props}>
        {children}
      </TooltipTrigger>
      {enabled && <TooltipContent side={side}>{label}</TooltipContent>}
    </Tooltip>
  );
}

/** In the icon rail, a group opens its sections in a flyout menu instead of expanding inline. */
function NavGroupFlyout({ item, badges }: { item: NavItem; badges: Badges }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isCurrent = pathname.startsWith(item.to);
  const { open, onOpenChange, triggerProps, contentProps } = useHoverMenu();

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger asChild {...triggerProps}>
        <button type="button" className={cn(itemClass, "w-full cursor-pointer text-left", isCurrent && activeClass)}>
          <NavIcon item={item} />
          <span className={labelClass(true)}>{item.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={12} {...contentProps}>
        <div className="px-3 pt-1.5 pb-1 text-xs font-semibold text-muted-foreground">{item.label}</div>
        {item.children!.map((child) => (
          <DropdownMenuItem
            key={child.to}
            onSelect={() => navigate(child.to)}
            className={cn("justify-between", pathname.startsWith(child.to) && "bg-muted")}
          >
            {child.label}
            {child.badge && badges[child.badge] > 0 && (
              <span className="font-mono text-xs text-muted-foreground">{badges[child.badge]}</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavGroup({ item, badges, collapsed }: { item: NavItem; badges: Badges; collapsed: boolean }) {
  const { pathname } = useLocation();
  const isCurrent = pathname.startsWith(item.to);
  const [open, setOpen] = useState(isCurrent || item.to === "/ventas");
  const id = `nav-group-${item.to.slice(1)}`;

  if (collapsed) return <NavGroupFlyout item={item} badges={badges} />;

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
        <NavIcon item={item} />
        <span className={cn("flex flex-1 items-center justify-between", labelClass(false))}>
          {item.label}
          <ChevronRight
            className={cn("size-4 transition-transform duration-200 ease-out", open && "rotate-90")}
            aria-hidden="true"
          />
        </span>
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

interface SidebarProps {
  className?: string;
  /** Icon-only rail: labels hide and groups open as flyout menus. */
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ className, collapsed, onToggle }: SidebarProps) {
  const badges = useNavBadges();
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={400}>
      <nav
        aria-label="Principal"
        className={cn(
          "sticky top-0 h-dvh shrink-0 flex-col gap-1 overflow-x-hidden overflow-y-auto border-r border-sidebar-border bg-sidebar px-3.5 py-5 transition-[width] duration-300 ease-out",
          collapsed ? "w-[72px]" : "w-[264px]",
          className,
        )}
      >
        <div className={cn("flex shrink-0 items-center gap-2.5 pt-1 pb-4", collapsed ? "px-1.5" : "px-2")}>
          {!collapsed && (
            <>
              <div className="size-7 shrink-0 rounded-md bg-primary" aria-hidden="true" />
              <span className="flex-1 text-md font-semibold">Fiscalia</span>
            </>
          )}
          <RailTooltip
            enabled
            side={collapsed ? "right" : "bottom"}
            label={
              <>
                {collapsed ? "Expandir menú" : "Contraer menú"}
                <kbd className="font-sans text-xs opacity-60">⌘B</kbd>
              </>
            }
          >
            <button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
              aria-keyshortcuts="Meta+B Control+B"
              className={cn(
                "grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-[color,background-color,scale] duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.94]",
                !collapsed && "-mr-1.5",
              )}
            >
              <ToggleIcon className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </RailTooltip>
        </div>

        <CreateMenu
          side={collapsed ? "right" : "bottom"}
          openOnHover={collapsed}
          contentClassName={collapsed ? undefined : "w-[var(--radix-dropdown-menu-trigger-width)]"}
        >
          <Button
            variant="secondary"
            className={cn("mb-4 w-full overflow-hidden font-semibold", collapsed && "px-0")}
          >
            <Plus strokeWidth={2} aria-hidden="true" />
            <span className={collapsed ? "sr-only" : undefined}>Crear</span>
          </Button>
        </CreateMenu>

        {mainNav.map((item) => {
          if (item.children) return <NavGroup key={item.to} item={item} badges={badges} collapsed={collapsed} />;
          const count = item.badge ? badges[item.badge] : 0;
          return (
            <RailTooltip key={item.to} enabled={collapsed} label={item.label}>
              <NavLink to={item.to} end className={cn(itemClass, currentClass)}>
                <NavIcon item={item} dot={collapsed && count > 0} />
                <span className={cn("flex flex-1 items-center justify-between", labelClass(collapsed))}>
                  {item.label}
                  {count > 0 && (
                    <span className="rounded-sm bg-warning px-2 py-0.5 text-2xs font-semibold text-warning-foreground">
                      {count}
                      <span className="sr-only"> presentaciones próximas</span>
                    </span>
                  )}
                </span>
              </NavLink>
            </RailTooltip>
          );
        })}

        <div className="mx-2 my-3 h-px shrink-0 bg-sidebar-border" />

        {secondaryNav.map((item) => (
          <RailTooltip key={item.to} enabled={collapsed} label={item.label}>
            <NavLink to={item.to} className={cn(itemClass, currentClass, "h-8 font-normal")}>
              <NavIcon item={item} />
              <span className={labelClass(collapsed)}>{item.label}</span>
            </NavLink>
          </RailTooltip>
        ))}

        <div className="flex-1" />

        <RailTooltip enabled={collapsed} label={currentUser.name}>
          <div className="flex shrink-0 items-center gap-2.5 overflow-hidden border-t border-sidebar-border px-1.5 pt-3">
            <div
              className="grid size-8 shrink-0 place-items-center rounded-md bg-muted-strong text-xs font-semibold"
              aria-hidden="true"
            >
              {currentUser.initials}
            </div>
            <div className={cn("flex min-w-0 flex-col gap-0.5 whitespace-nowrap", labelClass(collapsed))}>
              <span className="truncate font-semibold">{currentUser.name}</span>
              <span className="truncate text-xs text-muted-foreground">{currentUser.taxRegime}</span>
            </div>
          </div>
        </RailTooltip>
      </nav>
    </TooltipProvider>
  );
}

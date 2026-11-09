import { forwardRef, useState, type ComponentProps } from "react";
import { NavLink, useLocation } from "react-router";
import { LayoutGrid, Menu, Percent, Plus, ReceiptText, type LucideIcon } from "lucide-react";
import { cn } from "@cuentalibre/ui/lib/cn";
import { CreateMenu } from "./create-menu";
import { MoreSheet } from "./more-sheet";
import { tabPaths } from "./nav";

/** Every tab is the same round target; the current one sits on a filled disc. */
const tabClass = (active: boolean) =>
  cn(
    "grid size-13 cursor-pointer place-items-center rounded-full border-0 bg-transparent no-underline transition-[background-color,color,scale] duration-200 ease-out active:scale-90",
    active ? "bg-foreground/8 text-foreground" : "text-muted-foreground hover:text-foreground",
  );

const iconProps = { className: "size-[22px]", strokeWidth: 1.8, "aria-hidden": true } as const;

function Tab({ label, to, icon: Icon, end }: { label: string; to: string; icon: LucideIcon; end?: boolean }) {
  return (
    <NavLink to={to} end={end} aria-label={label} data-tour={to} className={({ isActive }) => tabClass(isActive)}>
      <Icon {...iconProps} />
    </NavLink>
  );
}

/** A tab that opens something instead of navigating; forwards its ref so menus and sheets can anchor to it. */
const TabButton = forwardRef<HTMLButtonElement, ComponentProps<"button"> & { active?: boolean }>(
  ({ active = false, className, ...props }, ref) => (
    <button ref={ref} type="button" className={cn(tabClass(active), className)} {...props} />
  ),
);

/** Floating tab bar for phones: four sections and "Crear", as icons on a pill above the page. */
export function BottomNav({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const inTab = tabPaths.some((path) => (path === "/" ? pathname === "/" : pathname.startsWith(path)));

  return (
    <nav
      aria-label="Principal"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="pointer-events-auto flex w-full max-w-sm items-center justify-between rounded-full border border-glass-edge bg-glass p-1.5 shadow-floating backdrop-blur-md backdrop-saturate-[1.8]">
        <Tab label="Inicio" to="/" icon={LayoutGrid} end />
        <Tab label="Ventas" to="/ventas" icon={ReceiptText} />
        <CreateMenu side="top" align="center" contentClassName="mb-2">
          <TabButton aria-label="Crear" data-tour="crear" className="[&[data-state=open]]:bg-foreground/8 [&[data-state=open]>svg]:rotate-45">
            <Plus {...iconProps} className="size-6 transition-transform duration-250 ease-out" strokeWidth={2} />
          </TabButton>
        </CreateMenu>
        <Tab label="Impuestos" to="/impuestos" icon={Percent} />
        <MoreSheet open={moreOpen} onOpenChange={setMoreOpen}>
          <TabButton aria-label="Más" data-tour="/mas" active={moreOpen || !inTab}>
            <Menu {...iconProps} />
          </TabButton>
        </MoreSheet>
      </div>
    </nav>
  );
}

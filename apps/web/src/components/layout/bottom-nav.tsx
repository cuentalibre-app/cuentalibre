import { NavLink } from "react-router";
import { LayoutGrid, Menu, Percent, Plus, ReceiptText, type LucideIcon } from "lucide-react";
import { cn } from "@fiscalia/ui/lib/cn";
import { CreateMenu } from "./create-menu";

const tabs: { label: string; to: string; icon: LucideIcon; end?: boolean }[] = [
  { label: "Inicio", to: "/", icon: LayoutGrid, end: true },
  { label: "Ventas", to: "/ventas", icon: ReceiptText },
  { label: "Impuestos", to: "/impuestos", icon: Percent },
  { label: "Más", to: "/mas", icon: Menu },
];

function Tab({ label, to, icon: Icon, end }: (typeof tabs)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex min-h-12 flex-col items-center justify-center gap-1 text-2xs no-underline",
          isActive ? "font-semibold text-foreground" : "text-muted-foreground",
        )
      }
    >
      <Icon className="size-[22px]" strokeWidth={1.8} aria-hidden="true" />
      {label}
    </NavLink>
  );
}

export function BottomNav({ className }: { className?: string }) {
  const [home, sales, taxes, more] = tabs;
  return (
    <nav
      aria-label="Principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-border bg-background px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <Tab {...home!} />
      <Tab {...sales!} />
      <div className="flex items-center justify-center">
        <CreateMenu side="top" align="center">
          <button
            type="button"
            aria-label="Crear"
            className="grid size-12 cursor-pointer place-items-center rounded-2xl bg-primary text-primary-foreground"
          >
            <Plus className="size-[22px]" strokeWidth={2} aria-hidden="true" />
          </button>
        </CreateMenu>
      </div>
      <Tab {...taxes!} />
      <Tab {...more!} />
    </nav>
  );
}

import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router";
import { LogOut, Monitor, Moon, Settings, Sun, UserRound, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@cuentalibre/ui/components/dropdown-menu";
import { cn } from "@cuentalibre/ui/lib/cn";
import { SETTINGS_PATH, accountName, incomeTaxMethodLabel, initials } from "@/features/settings/settings-model";
import { useSettings } from "@/features/settings/settings-store";
import { signOut } from "@/features/auth/auth-api";
import { SIGN_IN_PATH, canExitDemo, exitDemo, reloadAt, sessionState } from "@/features/auth/session";
import { BACKDROPS, THEMES, setAppearance, useAppearance, type Backdrop, type Theme } from "@/lib/appearance";

interface UserMenuProps {
  /** Custom trigger, a single button; defaults to the round avatar. */
  children?: ReactNode;
  side?: "top" | "right" | "bottom";
  align?: "start" | "center" | "end";
  className?: string;
}

const THEME_OPTIONS: Record<Theme, { label: string; icon: LucideIcon }> = {
  light: { label: "Claro", icon: Sun },
  dark: { label: "Oscuro", icon: Moon },
  system: { label: "Auto", icon: Monitor },
};

const BACKDROP_LABELS: Record<Backdrop, string> = {
  aurora: "Aurora",
  sunset: "Atardecer",
  forest: "Bosque",
  plain: "Plano",
};

// The swatches show their wash stronger than the page does, so a small circle still reads
const swatchStyle = { "--aurora-strength": 4.5 } as CSSProperties;

/** Keeps the menu open, so trying a theme or a backdrop shows it behind the menu. */
const stayOpen = (event: Event) => event.preventDefault();

/** The account's shortcuts (settings, the look of the app, signing out), from the avatar or the sidebar. */
export function UserMenu({ children, side = "bottom", align = "end", className }: UserMenuProps) {
  const navigate = useNavigate();
  const { profile, tax } = useSettings();
  const name = accountName(profile);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children ?? (
          <button
            type="button"
            aria-label={name ? `Cuenta de ${name}` : "Tu cuenta"}
            className={cn(
              "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-muted-strong text-sm font-semibold text-foreground transition-[scale,opacity] duration-150 hover:opacity-85 active:scale-[0.96]",
              className,
            )}
          >
            {name ? initials(name) : <UserRound className="size-4.5" strokeWidth={1.8} aria-hidden="true" />}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className="w-64">
        <div className="flex flex-col gap-0.5 px-3 pt-2 pb-2.5">
          <span className="truncate font-semibold">{name || "Tu cuenta"}</span>
          <span className="truncate text-xs text-muted-foreground">
            {name && name !== profile.email.trim()
              ? profile.email.trim() || incomeTaxMethodLabel(tax.incomeTaxMethod)
              : "Completa los datos de tu negocio"}
          </span>
        </div>
        <DropdownMenuSeparator className="mt-0" />
        <DropdownMenuItem onSelect={() => navigate(SETTINGS_PATH)}>
          <Settings strokeWidth={1.8} aria-hidden="true" />
          Configuración
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <AppearanceOptions />
        <DropdownMenuSeparator />
        {sessionState() === "connected" ? (
          <DropdownMenuItem onSelect={() => void signOut().finally(() => reloadAt(SIGN_IN_PATH))}>
            <LogOut strokeWidth={1.8} aria-hidden="true" />
            Cerrar sesión
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled={!canExitDemo()} onSelect={exitDemo}>
            <LogOut strokeWidth={1.8} aria-hidden="true" />
            Salir de la demo
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppearanceOptions() {
  const { theme, backdrop } = useAppearance();

  return (
    <>
      <DropdownMenuLabel>Tema</DropdownMenuLabel>
      <div role="group" aria-label="Tema" className="mx-1.5 mb-1 grid grid-cols-3 gap-0.5 rounded-lg bg-muted p-0.5 dark:bg-canvas">
        {THEMES.map((option) => {
          const { label, icon: Icon } = THEME_OPTIONS[option];
          const active = option === theme;
          return (
            <DropdownMenuItem
              key={option}
              role="menuitemradio"
              aria-checked={active}
              onSelect={(event) => {
                stayOpen(event);
                setAppearance({ theme: option });
              }}
              className={cn(
                "h-8 justify-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground data-[highlighted]:bg-accent",
                active &&
                  "bg-popover text-foreground shadow-card data-[highlighted]:bg-popover dark:bg-accent dark:data-[highlighted]:bg-accent [&_svg]:text-foreground",
              )}
            >
              <Icon className="size-4!" strokeWidth={1.8} aria-hidden="true" />
              {label}
            </DropdownMenuItem>
          );
        })}
      </div>
      <DropdownMenuLabel className="pt-2">Fondo</DropdownMenuLabel>
      <div role="group" aria-label="Fondo" className="mx-1.5 mb-1 grid grid-cols-4 gap-0.5">
        {BACKDROPS.map((option) => {
          const active = option === backdrop;
          return (
            <DropdownMenuItem
              key={option}
              role="menuitemradio"
              aria-checked={active}
              onSelect={(event) => {
                stayOpen(event);
                setAppearance({ backdrop: option });
              }}
              className="group h-auto flex-col gap-1 px-0 py-1.5 text-xs font-medium text-muted-foreground aria-checked:text-foreground"
            >
              <span
                data-backdrop={option}
                style={swatchStyle}
                aria-hidden="true"
                className={cn(
                  "size-9 rounded-full border border-border bg-canvas bg-aurora transition-shadow duration-150",
                  active && "ring-2 ring-primary ring-offset-2 ring-offset-popover",
                )}
              />
              {BACKDROP_LABELS[option]}
            </DropdownMenuItem>
          );
        })}
      </div>
    </>
  );
}

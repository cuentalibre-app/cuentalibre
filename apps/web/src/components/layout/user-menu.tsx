import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { Building2, LogOut, Settings, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@cuentalibre/ui/components/dropdown-menu";
import { cn } from "@cuentalibre/ui/lib/cn";
import {
  BUSINESS_PATH,
  PROFILE_PATH,
  SETTINGS_PATH,
  accountName,
  incomeTaxMethodLabel,
  initials,
} from "@/features/settings/settings-model";
import { useSettings } from "@/features/settings/settings-store";
import { signOut } from "@/features/auth/auth-api";
import { SIGN_IN_PATH, canExitDemo, exitDemo, reloadAt, sessionState } from "@/features/auth/session";

interface UserMenuProps {
  /** Custom trigger, a single button; defaults to the round avatar. */
  children?: ReactNode;
  side?: "top" | "right" | "bottom";
  align?: "start" | "center" | "end";
  className?: string;
}

/** The account's shortcuts (personal and business details, settings, signing out), from the avatar or the sidebar. */
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
        <DropdownMenuItem onSelect={() => navigate(PROFILE_PATH)}>
          <UserRound strokeWidth={1.8} aria-hidden="true" />
          Datos personales
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(BUSINESS_PATH)}>
          <Building2 strokeWidth={1.8} aria-hidden="true" />
          Datos de la empresa
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(SETTINGS_PATH)}>
          <Settings strokeWidth={1.8} aria-hidden="true" />
          Configuración
        </DropdownMenuItem>
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

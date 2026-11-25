import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Languages, LogOut, Monitor, Moon, Settings, Sun, UserRound, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@cuentalibre/ui/components/dropdown-menu";
import { cn } from "@cuentalibre/ui/lib/cn";
import { SETTINGS_PATH, accountName, initials, profitTaxLabel } from "@/features/settings/settings-model";
import { useSettings } from "@/features/settings/settings-store";
import { signOut } from "@/features/auth/auth-api";
import { resetHelpChat } from "@/features/help-chat/help-chat-store";
import { SIGN_IN_PATH, canExitDemo, exitDemo, reloadAt, sessionState } from "@/features/auth/session";
import { THEMES, setAppearance, useAppearance, type Theme } from "@/lib/appearance";
import { LANGUAGES, parseLanguage, setLanguage } from "@/i18n";

interface UserMenuProps {
  /** Custom trigger, a single button; defaults to the round avatar. */
  children?: ReactNode;
  side?: "top" | "right" | "bottom";
  align?: "start" | "center" | "end";
  className?: string;
}

const THEME_ICONS: Record<Theme, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

/** Keeps the menu open, so trying a theme shows it behind the menu. */
const stayOpen = (event: Event) => event.preventDefault();

/** The account's shortcuts (settings, the look of the app, signing out), from the avatar or the sidebar. */
export function UserMenu({ children, side = "bottom", align = "end", className }: UserMenuProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile, tax } = useSettings();
  const name = accountName(profile);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children ?? (
          <button
            type="button"
            aria-label={name ? t("userMenu.accountOf", { name }) : t("userMenu.account")}
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
          <span className="truncate font-semibold">{name || t("userMenu.account")}</span>
          <span className="truncate text-xs text-muted-foreground">
            {name && name !== profile.email.trim()
              ? profile.email.trim() || profitTaxLabel(profile.kind, tax.incomeTaxMethod)
              : t("userMenu.completeBusiness")}
          </span>
        </div>
        <DropdownMenuSeparator className="mt-0" />
        <DropdownMenuItem onSelect={() => navigate(SETTINGS_PATH)}>
          <Settings strokeWidth={1.8} aria-hidden="true" />
          {t("userMenu.settings")}
        </DropdownMenuItem>
        <LanguageOptions />
        <DropdownMenuSeparator />
        <AppearanceOptions />
        <DropdownMenuSeparator />
        {sessionState() === "connected" ? (
          <DropdownMenuItem
            onSelect={() => {
              // Whoever signs in next in this tab mustn't see the questions
              resetHelpChat();
              void signOut().finally(() => reloadAt(SIGN_IN_PATH));
            }}
          >
            <LogOut strokeWidth={1.8} aria-hidden="true" />
            {t("userMenu.signOut")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled={!canExitDemo()} onSelect={exitDemo}>
            <LogOut strokeWidth={1.8} aria-hidden="true" />
            {t("userMenu.exitDemo")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LanguageOptions() {
  const { t, i18n } = useTranslation();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Languages strokeWidth={1.8} aria-hidden="true" />
        {t("userMenu.language")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={parseLanguage(i18n.language)}
          onValueChange={(code) => void setLanguage(parseLanguage(code))}
        >
          {LANGUAGES.map(({ code, name }) => (
            <DropdownMenuRadioItem key={code} value={code} lang={code}>
              {name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function AppearanceOptions() {
  const { t } = useTranslation();
  const { theme } = useAppearance();

  return (
    <>
      <DropdownMenuLabel>{t("userMenu.theme")}</DropdownMenuLabel>
      <div
        role="group"
        aria-label={t("userMenu.theme")}
        className="mx-1.5 mb-1 grid grid-cols-3 gap-0.5 rounded-lg bg-muted p-0.5 dark:bg-canvas"
      >
        {THEMES.map((option) => {
          const Icon = THEME_ICONS[option];
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
              {t(`userMenu.themes.${option}`)}
            </DropdownMenuItem>
          );
        })}
      </div>
    </>
  );
}

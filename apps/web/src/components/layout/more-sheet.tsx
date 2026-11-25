import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight, UserRound } from "lucide-react";
import { cn } from "@cuentalibre/ui/lib/cn";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@cuentalibre/ui/components/sheet";
import { PROFILE_PATH, accountName, initials } from "@/features/settings/settings-model";
import { useSettings } from "@/features/settings/settings-store";
import { LegalLinks } from "@/components/legal-links";
import { moreNav, type MoreEntry } from "./nav";
import { useNavGroupOpen } from "./use-nav-group-open";

const row =
  "flex min-h-13 items-center gap-3.5 text-md font-medium text-foreground no-underline transition-opacity duration-150 active:opacity-60";

interface MoreSheetProps {
  /** The trigger, a single button. */
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Everything that doesn't fit in the mobile tab bar: the account first, then the sections as in the sidebar. */
export function MoreSheet({ children, open, onOpenChange }: MoreSheetProps) {
  const { t } = useTranslation();
  const { profile } = useSettings();
  const name = accountName(profile);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent title={t("navigation.labels.more")}>
        <nav aria-label={t("navigation.moreSections")} className="flex flex-col">
          <SheetClose asChild>
            <Link to={PROFILE_PATH} className={cn(row, "border-b border-divider py-2")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                {name ? initials(name) : <UserRound className="size-4.5" strokeWidth={1.8} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1 truncate">{name || t("userMenu.account")}</span>
              <ChevronRight className="size-4.5 text-muted-foreground" aria-hidden="true" />
            </Link>
          </SheetClose>

          {moreNav.map((entry) =>
            entry.kind === "link" ? (
              <SheetClose key={entry.item.to} asChild>
                <Link to={entry.item.to} className={cn(row, "border-b border-divider")}>
                  <entry.item.icon className="size-5.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  <span className="flex-1">{t(entry.item.labelKey)}</span>
                  <ChevronRight className="size-4.5 text-muted-foreground" aria-hidden="true" />
                </Link>
              </SheetClose>
            ) : (
              <MoreGroup key={entry.to} group={entry} />
            ),
          )}
          <LegalLinks className="pt-6" />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

/** A section folded by default, like the sidebar's groups; remembered per browser once toggled. */
function MoreGroup({ group }: { group: Extract<MoreEntry, { kind: "group" }> }) {
  const { t } = useTranslation();
  const [open, toggle] = useNavGroupOpen(`more:${group.to}`, false);
  const id = `more-group-${group.to.slice(1)}`;

  return (
    <section aria-label={t(group.titleKey)} className="flex flex-col border-b border-divider">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        className={cn(row, "w-full cursor-pointer text-left")}
      >
        <group.icon className="size-5.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        <span className="flex-1">{t(group.titleKey)}</span>
        <ChevronRight
          className={cn(
            "size-4.5 text-muted-foreground transition-transform duration-200 ease-out",
            open && "rotate-90",
          )}
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
          <ul className="m-0 flex list-none flex-col p-0 pb-2 pl-9">
            {group.links.map((link) => (
              <li key={link.to}>
                <SheetClose asChild>
                  <Link to={link.to} className={cn(row, "min-h-11 font-normal")}>
                    <span className="flex-1">{t(link.labelKey)}</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

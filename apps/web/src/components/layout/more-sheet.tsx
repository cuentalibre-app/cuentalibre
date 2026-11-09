import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight, UserRound } from "lucide-react";
import { cn } from "@cuentalibre/ui/lib/cn";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@cuentalibre/ui/components/sheet";
import { PROFILE_PATH, accountName, initials } from "@/features/settings/settings-model";
import { useSettings } from "@/features/settings/settings-store";
import { LegalLinks } from "@/components/legal-links";
import { moreNav } from "./nav";

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
  const { profile } = useSettings();
  const name = accountName(profile);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent title="Más">
        <nav aria-label="Más secciones" className="flex flex-col">
          <SheetClose asChild>
            <Link to={PROFILE_PATH} className={cn(row, "border-b border-divider py-2")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                {name ? initials(name) : <UserRound className="size-4.5" strokeWidth={1.8} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1 truncate">{name || "Tu cuenta"}</span>
              <ChevronRight className="size-4.5 text-muted-foreground" aria-hidden="true" />
            </Link>
          </SheetClose>

          {moreNav.map((entry) =>
            entry.kind === "link" ? (
              <SheetClose key={entry.item.to} asChild>
                <Link to={entry.item.to} className={cn(row, "border-b border-divider")}>
                  <entry.item.icon className="size-5.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  <span className="flex-1">{entry.item.label}</span>
                  <ChevronRight className="size-4.5 text-muted-foreground" aria-hidden="true" />
                </Link>
              </SheetClose>
            ) : (
              <section key={entry.title} aria-label={entry.title} className="flex flex-col border-b border-divider py-2">
                <h2 className="m-0 flex min-h-11 items-center gap-3.5 text-md font-medium text-foreground">
                  <entry.icon className="size-5.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  {entry.title}
                </h2>
                <ul className="m-0 flex list-none flex-col p-0 pl-9">
                  {entry.links.map((link) => (
                    <li key={link.to}>
                      <SheetClose asChild>
                        <Link to={link.to} className={cn(row, "min-h-11 font-normal")}>
                          <span className="flex-1">{link.label}</span>
                          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                        </Link>
                      </SheetClose>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
          <LegalLinks className="pt-6" />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

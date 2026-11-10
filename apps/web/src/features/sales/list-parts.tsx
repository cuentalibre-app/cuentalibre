import { Fragment, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  FilePlus2,
  Filter,
  MoreHorizontal,
  Search,
  type LucideIcon,
} from "lucide-react";
import { centsToEuros, type Cents } from "@cuentalibre/core";
import { Button } from "@cuentalibre/ui/components/button";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";

/* Building blocks shared by the document lists (sales and purchases). Tooltips need a TooltipProvider above. */

export function pickFiles(onPick: (files: File[]) => void) {
  const input = Object.assign(document.createElement("input"), { type: "file", multiple: true });
  input.onchange = () => onPick(Array.from(input.files ?? []));
  input.click();
}

export interface Action {
  label: string;
  icon: LucideIcon;
  run?: () => void;
  danger?: boolean;
  /** Exclusive choices, shown in a submenu instead of running the action. */
  choice?: Choice;
}

export interface Choice {
  value: string;
  /** `hint` says why an option can't be chosen, or anything else worth knowing about it. */
  options: { value: string; label: string; disabled?: boolean; hint?: string }[];
  onChange: (value: string) => void;
}

/**
 * The actions of a record. A choice opens a submenu, or with `inlineChoices`
 * (phones, where a submenu has no room beside the menu) lists its options in place.
 */
export function ActionsMenu({
  groups,
  trigger,
  inlineChoices = false,
}: {
  groups: Action[][];
  trigger: ReactNode;
  inlineChoices?: boolean;
}) {
  return (
    <DropdownMenu>
      {trigger}
      <DropdownMenuContent align="end">
        {groups.map((group, i) => (
          <Fragment key={i}>
            {i > 0 && <DropdownMenuSeparator />}
            {group.map((a) => {
              if (!a.choice)
                return (
                  <DropdownMenuItem
                    key={a.label}
                    disabled={!a.run}
                    onSelect={a.run}
                    className={cn(a.danger && "text-destructive [&_svg]:text-destructive")}
                  >
                    <a.icon aria-hidden="true" />
                    {a.label}
                  </DropdownMenuItem>
                );
              const options = <ChoiceOptions label={a.label} choice={a.choice} />;
              return inlineChoices ? (
                <Fragment key={a.label}>
                  <DropdownMenuLabel>{a.label}</DropdownMenuLabel>
                  {options}
                </Fragment>
              ) : (
                <DropdownMenuSub key={a.label}>
                  <DropdownMenuSubTrigger>
                    <a.icon aria-hidden="true" />
                    {a.label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>{options}</DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChoiceOptions({ label, choice }: { label: string; choice: Choice }) {
  return (
    <DropdownMenuRadioGroup aria-label={label} value={choice.value} onValueChange={choice.onChange}>
      {choice.options.map((option) => (
        <DropdownMenuRadioItem key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
          {option.hint && <span className="ml-auto pl-4 text-xs font-normal text-muted-foreground">{option.hint}</span>}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

/** The "more actions" button of a row: the same ellipsis on desktop and phone, with a tooltip next to icon actions. */
export function MoreActionsTrigger({ label, tooltip = false }: { label: string; tooltip?: boolean }) {
  const trigger = (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon-sm" aria-label={label}>
        <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
  );
  if (!tooltip) return trigger;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent>Más acciones</TooltipContent>
    </Tooltip>
  );
}

/**
 * Opens a list's filter panel. Phones show just the funnel, and the panel there also holds the
 * filters the toolbar has no room for (such as the status), so they count them too.
 */
export function FiltersButton({
  open,
  controls,
  count,
  phoneCount = count,
  onToggle,
}: {
  open: boolean;
  /** The id of the panel it shows. */
  controls: string;
  /** Filters set in the panel. */
  count: number;
  phoneCount?: number;
  onToggle: () => void;
}) {
  const badge =
    "flex size-5 items-center justify-center rounded-sm bg-primary text-2xs font-semibold text-primary-foreground";
  return (
    <Button
      variant="secondary"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className="max-lg:px-3"
    >
      <Filter strokeWidth={1.8} aria-hidden="true" />
      <span className="max-lg:sr-only">Filtros</span>
      {phoneCount > 0 && <span className={cn(badge, "lg:hidden")}>{phoneCount}</span>}
      {count > 0 && <span className={cn(badge, "max-lg:hidden")}>{count}</span>}
    </Button>
  );
}

/**
 * Phones: a list's downloads (CSV, PDF…) behind one button in the page header, so the toolbar
 * keeps to a single line. Desktop shows them as buttons in the toolbar instead.
 */
export function ExportMenu({ actions }: { actions: Action[] }) {
  return (
    <ActionsMenu
      groups={[actions]}
      trigger={
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Más acciones" className="lg:hidden">
            <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      }
    />
  );
}

export function IconAction({ action, badge }: { action: Action; badge?: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={action.label}
          aria-disabled={!action.run}
          onClick={action.run}
          className={cn("relative", !action.run && "cursor-not-allowed opacity-40 hover:bg-transparent")}
        >
          <action.icon strokeWidth={1.8} aria-hidden="true" />
          {!!badge && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-sm bg-primary text-2xs font-semibold text-primary-foreground">
              {badge}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{action.label}</TooltipContent>
    </Tooltip>
  );
}

export function SortHeader({
  label,
  numeric,
  dir,
  onClick,
  className,
}: {
  /** A "\n" splits it over two lines, for long labels over narrow columns. */
  label: string;
  numeric?: boolean;
  /** Direction when this column is the active sort, otherwise null. */
  dir: "asc" | "desc" | null;
  onClick: () => void;
  className?: string;
}) {
  const SortIcon = dir === null ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={dir === null ? undefined : dir === "asc" ? "ascending" : "descending"}
      className={cn(className, "p-0 first:pl-0 last:pr-0", numeric && "text-right")}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group flex w-full cursor-pointer items-center gap-1.5 border-0 bg-transparent px-3 py-2.5 whitespace-pre text-inherit transition-colors duration-150 hover:text-foreground in-[th:first-child]:pl-5",
          // On numeric columns the sort icon goes first, so the label lines up with the figures
          numeric && "flex-row-reverse",
          dir !== null && "text-foreground",
        )}
      >
        <span className={cn("leading-tight", numeric ? "text-right" : "text-left")}>{label}</span>
        <SortIcon
          className={cn(
            "size-3.5 shrink-0 transition-opacity duration-150",
            dir === null && "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60",
          )}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

export function EmptyState({ message, hint, action }: { message: string; hint: string; action?: ReactNode }) {
  return (
    <div className="flex animate-fade-in flex-col items-center gap-2 border-t border-border px-5 py-14 text-center">
      <span className="mb-1 flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {action ? <FilePlus2 strokeWidth={1.8} aria-hidden="true" /> : <Search strokeWidth={1.8} aria-hidden="true" />}
      </span>
      <p className="m-0 font-medium">{message}</p>
      <p className="m-0 text-sm text-muted-foreground">{hint}</p>
      {action}
    </div>
  );
}

/** Semicolon-separated with decimal commas, so Excel in Spanish opens it as-is. Amounts print as euros with two decimals. */
export function downloadCsv(header: string[], rows: (string | Cents)[][], name: string) {
  const cell = (c: string | Cents) => (typeof c === "number" ? centsToEuros(c).toFixed(2).replace(".", ",") : c);
  const lines = [header, ...rows].map((cells) =>
    cells.map((c) => `"${String(cell(c)).replaceAll('"', '""')}"`).join(";"),
  );

  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `${name}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@cuentalibre/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@cuentalibre/ui/components/select";
import { cn } from "@cuentalibre/ui/lib/cn";
import { HelpTip } from "@/components/page";
import { LANGUAGES, NUMBER_FORMATS, formatSample } from "./invoice-locale";
import type { OptionGroup } from "./sales-model";

/* Form building blocks shared by the sales form and the invoice settings. Help icons need a TooltipProvider above. */

/** Radix Select can't hold an empty value: this stands for "the client's default". */
export const CLIENT_DEFAULT = "client";

/** Whether the sections below start folded; see `SectionsAtAGlance`. */
const FoldedContext = createContext(false);

/**
 * Opening a saved record on a phone: every section starts folded to its title, so the document
 * reads at a glance (the totals stay outside the sections) and each part opens on a tap.
 * New records and desktop keep the sections open, since they are there to be filled in.
 */
export function SectionsAtAGlance({ when, children }: { when: boolean; children: ReactNode }) {
  // Read once, at mount: rotating the phone mid-edit shouldn't fold what the user opened
  const [folded] = useState(
    () => when && typeof window !== "undefined" && window.matchMedia("(width < 48rem)").matches,
  );
  return <FoldedContext.Provider value={folded}>{children}</FoldedContext.Provider>;
}

export function Section({
  title,
  index,
  action,
  defaultOpen = true,
  children,
}: {
  title: string;
  index: number;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const folded = useContext(FoldedContext);
  const [open, setOpen] = useState(defaultOpen && !folded);
  const id = useId();
  const body = useRef<HTMLDivElement>(null);
  // A failed save marks fields invalid: a folded section holding one opens so the error shows
  useLayoutEffect(() => {
    if (!open && body.current?.querySelector('[aria-invalid="true"]')) setOpen(true);
  });
  return (
    <section
      className="flex animate-rise-in flex-col surface text-card-foreground"
      style={{ "--i": index } as CSSProperties}
    >
      {/* Ruled off from its fields while open, like the cards on Inicio */}
      <div
        className={cn(
          "flex min-h-14 flex-wrap items-center justify-between gap-3 px-5 py-2.5",
          open && "border-b border-divider",
        )}
      >
        <h2 className="m-0 text-lg font-semibold tracking-tight">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((o) => !o)}
            className="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-lg font-semibold tracking-tight text-foreground"
          >
            {title}
            <ChevronDown
              className={cn("size-5 text-muted-foreground transition-transform duration-200", !open && "-rotate-90")}
              aria-hidden="true"
            />
          </button>
        </h2>
        {open && action}
      </div>
      <div ref={body} id={id} className={cn(open ? "flex" : "hidden", "flex-col gap-4 p-5")}>
        {children}
      </div>
    </section>
  );
}

export interface FieldControlProps {
  id: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  /** Something to check, such as a value read from a document that doesn't add up. An error goes before it. */
  warning?: string;
  hint?: string;
  /** Explanation behind a help icon next to the label. */
  help?: string;
  /** Small control at the end of the label row, such as a link. */
  action?: ReactNode;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}

/** Label, control and message. The control receives the id and ARIA wiring. */
export function Field({ label, required, error, warning, hint, help, action, className, children }: FieldProps) {
  const id = useId();
  const message = error ?? warning ?? hint;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {/* Fixed height so a small action button doesn't push the input below the ones beside it */}
      <div className="flex h-5 items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
          {label}
          {required && (
            <span className="text-destructive" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </label>
        {help && <Help text={help} />}
        {action && <span className="ml-auto flex text-sm">{action}</span>}
      </div>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": message ? `${id}-msg` : undefined,
      })}
      {message && (
        <p
          id={`${id}-msg`}
          className={cn("m-0 text-xs", error ? "text-destructive" : warning ? "text-warning" : "text-muted-foreground")}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export function Help({ text }: { text: string }) {
  return <HelpTip label={text}>{text}</HelpTip>;
}

export interface GroupedSelectProps extends FieldControlProps {
  /** For a select without a visible label, such as a list filter. */
  "aria-label"?: string;
  value: string;
  onChange: (value: string) => void;
  groups: OptionGroup[];
  disabled?: boolean;
  className?: string;
  /** Shown in the closed select while no option is chosen. */
  placeholder?: string;
  /** Shown in the open list when there are no options at all. */
  empty?: string;
}

/** Select whose options may sit under headings; a group without options is a plain heading. */
export function GroupedSelect({
  value,
  onChange,
  groups,
  disabled,
  className,
  placeholder,
  empty = "No hay opciones",
  ...aria
}: GroupedSelectProps) {
  const hasOptions = groups.some((g) => g.options.length > 0);
  return (
    // Radix fires "" when the options change under a form (native select sync); ignore it
    <Select value={value} onValueChange={(v) => v && onChange(v)} disabled={disabled}>
      <SelectTrigger {...aria} className={cn("w-full disabled:cursor-not-allowed disabled:opacity-50", className)}>
        <span className="min-w-0 flex-1 truncate text-left">
          <SelectValue placeholder={<span className="text-muted-foreground">{placeholder}</span>} />
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </SelectTrigger>
      <SelectContent className="max-w-[min(40rem,calc(100vw-2rem))]">
        {!hasOptions && <p className="m-0 px-3 py-2 text-sm text-muted-foreground">{empty}</p>}
        {groups.map((group, i) => (
          <SelectGroup key={group.label ?? i}>
            {i > 0 && group.label && <SelectSeparator />}
            {group.label && <SelectLabel>{group.label}</SelectLabel>}
            {group.options.map((o) => (
              <SelectItem
                key={o.value}
                value={o.value}
                title={o.title}
                disabled={o.disabled}
                className="h-auto min-h-9 py-2"
              >
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CheckField({
  label,
  hint,
  help,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  help?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <label className={cn("flex items-start gap-3", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
        <Checkbox
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-px"
        />
        <span className="flex flex-col">
          <span className="font-medium">{label}</span>
          {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
        </span>
      </label>
      {help && (
        // As tall as the label's first line, so the icon centers on it
        <span className="flex h-[1lh] items-center font-medium">
          <Help text={help} />
        </span>
      )}
    </div>
  );
}

/** Language and number format of the PDF, with a live sample. Empty values follow a default: the client's, by default. */
export function LocaleFields({
  language,
  numberFormat,
  allowClientDefault = true,
  defaultLabels = {
    language: "Idioma por defecto del cliente",
    format: "Formato por defecto del cliente",
    note: "Se usa el idioma y formato configurados en la ficha del cliente.",
  },
  onLanguageChange,
  onNumberFormatChange,
}: {
  language: string;
  numberFormat: string;
  allowClientDefault?: boolean;
  /** Wording of the empty choice and of the sample without a language. */
  defaultLabels?: { language: string; format: string; note: string };
  onLanguageChange: (value: string) => void;
  onNumberFormatChange: (value: string) => void;
}) {
  const formats = language
    ? (NUMBER_FORMATS[language] ?? [])
    : [{ value: CLIENT_DEFAULT, label: defaultLabels.format }];
  const sample = formatSample(language, numberFormat, new Date());
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div className="flex flex-col gap-4">
        <Field label="Idioma">
          {(p) => (
            <GroupedSelect
              {...p}
              value={language || CLIENT_DEFAULT}
              onChange={onLanguageChange}
              groups={[
                {
                  options: allowClientDefault
                    ? [{ value: CLIENT_DEFAULT, label: defaultLabels.language }, ...LANGUAGES]
                    : LANGUAGES,
                },
              ]}
            />
          )}
        </Field>
        <Field label="Formato numérico">
          {(p) => (
            <GroupedSelect
              {...p}
              value={numberFormat || CLIENT_DEFAULT}
              onChange={onNumberFormatChange}
              groups={[{ options: formats }]}
            />
          )}
        </Field>
      </div>
      <div className="flex flex-col gap-1.5 self-start rounded-lg bg-muted p-4 text-sm">
        <span className="font-semibold">Ejemplo de formato</span>
        {sample ? (
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Números negativos</dt>
            <dd className="m-0 amount">{sample.negative}</dd>
            <dt className="text-muted-foreground">Números positivos</dt>
            <dd className="m-0 amount">{sample.positive}</dd>
            <dt className="text-muted-foreground">Fecha</dt>
            <dd className="m-0 amount">{sample.date}</dd>
          </dl>
        ) : (
          <span className="text-muted-foreground">{defaultLabels.note}</span>
        )}
      </div>
    </div>
  );
}

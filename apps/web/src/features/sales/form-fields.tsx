import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, CircleHelp } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { LANGUAGES, NUMBER_FORMATS, formatSample } from "./invoice-locale";
import type { OptionGroup } from "./sales-model";

/* Form building blocks shared by the sales form and the invoice settings. Help icons need a TooltipProvider above. */

/** Radix Select can't hold an empty value: this stands for "the client's default". */
export const CLIENT_DEFAULT = "client";

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
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section
      className="flex animate-rise-in flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground"
      style={{ "--i": index } as CSSProperties}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((o) => !o)}
            className="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-lg font-semibold text-foreground"
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
      <div id={id} className={cn(open ? "flex" : "hidden", "flex-col gap-4")}>
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
  hint?: string;
  /** Explanation behind a help icon next to the label. */
  help?: string;
  /** Small control at the end of the label row, such as a link. */
  action?: ReactNode;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}

/** Label, control and message. The control receives the id and ARIA wiring. */
export function Field({ label, required, error, hint, help, action, className, children }: FieldProps) {
  const id = useId();
  const message = error ?? hint;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1.5">
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
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": message ? `${id}-msg` : undefined,
      })}
      {message && (
        <p id={`${id}-msg`} className={cn("m-0 text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {message}
        </p>
      )}
    </div>
  );
}

export function Help({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={text}
          className="flex cursor-help items-center border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground"
        >
          <CircleHelp className="size-3.5" strokeWidth={2} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 font-normal">{text}</TooltipContent>
    </Tooltip>
  );
}

export interface GroupedSelectProps extends FieldControlProps {
  /** For a select without a visible label, such as a list filter. */
  "aria-label"?: string;
  value: string;
  onChange: (value: string) => void;
  groups: OptionGroup[];
  disabled?: boolean;
  className?: string;
}

/** Select whose options may sit under headings; a group without options is a plain heading. */
export function GroupedSelect({ value, onChange, groups, disabled, className, ...aria }: GroupedSelectProps) {
  return (
    // Radix fires "" when the options change under a form (native select sync); ignore it
    <Select value={value} onValueChange={(v) => v && onChange(v)} disabled={disabled}>
      <SelectTrigger
        {...aria}
        className={cn("w-full font-normal disabled:cursor-not-allowed disabled:opacity-50", className)}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          <SelectValue />
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </SelectTrigger>
      <SelectContent className="max-w-[min(40rem,calc(100vw-2rem))]">
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
        <span className="mt-1">
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

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { Check, Copy, Download, ExternalLink, Info, RotateCcw } from "lucide-react";
import {
  aeatBytes,
  aeatFileName,
  calendarStatus,
  cents,
  centsToEuros,
  daysUntil,
  obligation,
  sumBy,
  toIsoDate,
  type AeatFiler,
  type Boxes,
  type Cents,
  type Quarter,
} from "@cuentalibre/core";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { Input } from "@cuentalibre/ui/components/input";
import { SegmentedControl } from "@cuentalibre/ui/components/segmented-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { useSettings } from "@/features/settings/settings-store";
import { copyText } from "@/lib/clipboard";
import { daysLeftLabel, formatDate, parseEuros } from "@/lib/format";
import { downloadBlob } from "@/lib/xlsx";
import {
  AEAT_LINKS,
  CALENDAR_STATUS,
  ONLINE_ONLY_FORMS,
  type Cell,
  type FormAnswer,
  type FormCode,
  type FormSection,
  type Hint,
} from "./taxes-model";

/* Building blocks of the tax form pages. Tooltips need a TooltipProvider above. */

/** As the AEAT forms expect it: no thousands separator and a decimal comma. */
const decimalText = (value: number) => value.toFixed(2).replace(".", ",");

/** An amount as the AEAT forms expect it: euros without thousands separator and with a decimal comma. */
export const clipboardValue = (amount: Cents) => decimalText(centsToEuros(amount));

const formatPercent = (value: number) => `${value.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;

/** Money boxes hold cents; rate boxes a percentage and count boxes a number of people. */
const formatBox = (value: number, percent: boolean, count?: boolean) =>
  percent ? formatPercent(value) : count ? value.toLocaleString("es-ES") : formatEUR(cents(value));

const boxClipboard = (value: number, percent: boolean, count: boolean) =>
  count ? String(value) : percent ? decimalText(value) : clipboardValue(cents(value));

export function useCopied(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = (key: string, text: string) => {
    void copyText(text).then((done) => {
      if (!done) return;
      setCopied(key);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), 1_400);
    });
  };
  return [copied, copy];
}

export function BoxCode({ box }: { box: string }) {
  return <span className="text-2xs text-muted-foreground tabular-nums">[{box}]</span>;
}

/** A box and its amount; clicking copies the amount to paste it in the AEAT form. */
function BoxValue({
  box,
  value,
  percent,
  count,
  copied,
  onCopy,
  strong,
}: {
  box: string;
  value: number;
  percent: boolean;
  /** A number of people, not an amount. */
  count?: boolean;
  copied: boolean;
  onCopy: () => void;
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copiar casilla ${box}: ${formatBox(value, percent, count)}`}
      className="group inline-flex cursor-pointer items-center justify-end gap-2 rounded-md px-1.5 py-0.5 transition-colors duration-150 hover:bg-accent"
    >
      <BoxCode box={box} />
      <span className={cn("amount", value === 0 && "text-muted-foreground", strong && "font-semibold")}>
        {formatBox(value, percent, count)}
      </span>
      <span className="grid size-3.5 place-items-center text-muted-foreground" aria-hidden="true">
        {copied ? (
          <Check className="size-3.5 animate-fade-in text-success" strokeWidth={2} />
        ) : (
          <Copy
            className="size-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            strokeWidth={1.8}
          />
        )}
      </span>
    </button>
  );
}

export interface EditableBox {
  /** Text in the input. */
  value: string;
  onChange: (value: string) => void;
  /** Whether it differs from the computed value; offers to restore it. */
  overridden: boolean;
  onReset: () => void;
  invalid?: boolean;
}

/** An input box that starts on its computed value and can be corrected; empty counts as zero. */
export function useEditable(computed: Cents): [Cents, EditableBox] {
  const [typed, setTyped] = useState<string>();
  const parsed = typed === undefined ? null : parseEuros(typed);
  return [
    parsed ?? (typed?.trim() === "" ? cents(0) : computed),
    {
      value: typed ?? clipboardValue(computed),
      onChange: setTyped,
      overridden: typed !== undefined,
      onReset: () => setTyped(undefined),
      invalid: typed !== undefined && typed.trim() !== "" && parsed === null,
    },
  ];
}

function EditableValue({ box, edit }: { box: string; edit: EditableBox }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <BoxCode box={box} />
      <Input
        inputMode="decimal"
        aria-label={`Casilla ${box}`}
        value={edit.value}
        onChange={(e) => edit.onChange(e.target.value)}
        aria-invalid={edit.invalid || undefined}
        className="h-8 w-32 text-right amount"
      />
      {edit.overridden ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 px-0"
              aria-label="Volver al valor calculado"
              onClick={edit.onReset}
            >
              <RotateCcw className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Volver al valor calculado</TooltipContent>
        </Tooltip>
      ) : (
        <span className="size-7" aria-hidden="true" />
      )}
    </span>
  );
}

const isBox = (cell: Cell): cell is string => typeof cell === "string";

const cellKey = (cell: Cell) => (cell === null || isBox(cell) ? cell : (cell.box ?? cell.text));

/** The box numbers of a cell: none for a blank or a fixed text that isn't a box. */
const boxOf = (cell: Cell): string[] => (cell === null ? [] : isBox(cell) ? [cell] : cell.box ? [cell.box] : []);

/** "Casilla 13", "Casillas 28 y 29", "Casillas 01, 02 y 03" */
function boxesTitle(boxes: string[]): string {
  if (boxes.length === 0) return "Más información";
  if (boxes.length === 1) return `Casilla ${boxes[0]}`;
  return `Casillas ${boxes.slice(0, -1).join(", ")} y ${boxes.at(-1)}`;
}

/** A help text with **words** in bold. */
function RichText({ text }: { text: string }) {
  return text.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

/** The help of a row of boxes, titled with its boxes as on the form. */
function BoxHint({ boxes, hint }: { boxes: string[]; hint: Hint }) {
  const { text, table: helpTable, after = [] } = typeof hint === "string" ? { text: [hint] } : hint;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="Más información" className="cursor-help text-muted-foreground">
          <Info className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="block max-w-80 px-3.5 py-3 leading-snug font-normal">
        <p className="m-0 mb-1.5 text-center font-semibold">{boxesTitle(boxes)}</p>
        <div className="flex flex-col gap-2">
          {text.map((t, i) => (
            <p key={i} className="m-0">
              <RichText text={t} />
            </p>
          ))}
          {helpTable && (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-background/30">
                  {helpTable.columns.map((c, i) => (
                    <th key={c} className={cn("py-1 font-semibold", i === 0 ? "text-left" : "text-right")}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {helpTable.rows.map(([label, value]) => (
                  <tr key={label}>
                    <td className="py-0.5">{label}</td>
                    <td className="py-0.5 text-right font-semibold whitespace-nowrap">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {after.map((t, i) => (
            <p key={i} className="m-0">
              <RichText text={t} />
            </p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

const NO_BOXES = new Set<string>();

/** The form's sections, box by box. Rows whose boxes are all zero hide unless `showEmpty`. */
export function FormSections({
  sections,
  boxes,
  percentBoxes = NO_BOXES,
  countBoxes = NO_BOXES,
  editable = {},
  showEmpty,
}: {
  sections: FormSection[];
  boxes: Boxes;
  /** Boxes holding a rate, shown as a percentage. */
  percentBoxes?: Set<string>;
  /** Boxes holding a number of people (perceptors), shown without a currency. */
  countBoxes?: Set<string>;
  editable?: Record<string, EditableBox>;
  showEmpty: boolean;
}) {
  const [copied, copy] = useCopied();
  const value = (box: string) => boxes[box] ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section, s) => {
        const width = section.columns?.length ?? 1;
        const visible = section.rows.filter(
          (r) =>
            showEmpty ||
            r.total ||
            r.cells.some((c) => isBox(c) && (editable[c] || (!percentBoxes.has(c) && value(c) !== 0))),
        );
        const columns = { gridTemplateColumns: `minmax(0,1fr) repeat(${width}, 13rem)` };
        // Rows that continue a label ("" under "Régimen general") repeat it when the row above is hidden
        let previousSource = "";
        return (
          <section
            key={section.title}
            aria-label={section.title}
            className="animate-rise-in overflow-hidden rounded-xl border border-border"
            style={{ "--i": s } as CSSProperties}
          >
            <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground lg:grid" style={columns}>
              <h2 className="m-0 text-xs font-semibold text-foreground">{section.title}</h2>
              {section.columns?.map((c) => (
                <span key={c} className="hidden text-right font-medium lg:block">
                  {c}
                </span>
              ))}
            </div>
            {visible.length === 0 ? (
              <p className="m-0 border-t border-border px-4 py-3 text-sm text-muted-foreground">
                Sin importes en este periodo.
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {visible.map((r) => {
                  const source = r.label || labelAbove(section, r);
                  const continued = !r.label && source === previousSource;
                  previousSource = source;
                  return (
                    <li
                      key={r.cells.map(cellKey).join()}
                      className={cn(
                        "flex flex-col gap-1 border-t border-border px-4 py-2.5 lg:grid lg:items-center lg:gap-4 lg:py-1.5",
                        r.total && "bg-muted/50",
                      )}
                      style={columns}
                    >
                      <span
                        className={cn(
                          "flex items-center gap-1.5 text-sm",
                          r.total && "font-semibold",
                          continued && "lg:invisible",
                        )}
                      >
                        {source}
                        {r.hint && <BoxHint boxes={r.cells.flatMap(boxOf)} hint={r.hint} />}
                      </span>
                      {r.cells.map((cell, c) =>
                        cell === null ? (
                          <span key={c} className="hidden lg:block" />
                        ) : (
                          <div key={c} className="flex items-center justify-between gap-2 lg:justify-end">
                            <span className="text-xs text-muted-foreground lg:hidden">{section.columns?.[c]}</span>
                            {!isBox(cell) ? (
                              <span className="inline-flex items-center gap-2 pr-7">
                                {cell.box && <BoxCode box={cell.box} />}
                                <span className={cn("text-muted-foreground", cell.unit && "amount")}>
                                  {cell.unit ? `${cell.text} ${cell.unit}` : cell.text}
                                </span>
                              </span>
                            ) : editable[cell] ? (
                              <EditableValue box={cell} edit={editable[cell]} />
                            ) : (
                              <BoxValue
                                box={cell}
                                value={value(cell)}
                                percent={percentBoxes.has(cell)}
                                count={countBoxes.has(cell)}
                                strong={r.total}
                                copied={copied === cell}
                                onCopy={() =>
                                  copy(cell, boxClipboard(value(cell), percentBoxes.has(cell), countBoxes.has(cell)))
                                }
                              />
                            )}
                          </div>
                        ),
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {section.note && (
              <p className="m-0 flex gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                {section.note}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Label of the nearest labelled row above, for rows that continue it. */
function labelAbove(section: FormSection, target: FormSection["rows"][number]): string {
  const index = section.rows.indexOf(target);
  for (let i = index; i >= 0; i--) if (section.rows[i]!.label) return section.rows[i]!.label;
  return "";
}

/** The file the AEAT's online form imports, built from the boxes on screen, or the books Renta WEB imports. */
export interface AeatFile {
  /** Name of the downloaded file. */
  name: string;
  /** Text of the button, when it isn't the generic one. */
  label?: string;
  /** The file; throws a RangeError when an amount doesn't fit the record design. */
  build: () => Blob;
  /** Why it can't be built yet, such as a missing NIF. */
  missing?: string;
  /** Why the file rejects the amounts on screen; there is a default one for edited boxes. */
  invalid?: string;
}

/** The AEAT file of a form for a quarter, a month for the 349 or the year (null), filed by the profile's taxpayer. */
export function useAeatFile(
  form: FormCode,
  year: number,
  period: Quarter | string | null,
  build: (filer: AeatFiler) => string,
): AeatFile {
  const { profile } = useSettings();
  const filer = {
    taxId: profile.taxId,
    surnames: `${profile.lastName} ${profile.secondLastName}`,
    name: profile.firstName,
    phone: profile.phone,
  };
  return {
    name: aeatFileName(form, year, period),
    build: () => new Blob([aeatBytes(build(filer))], { type: "text/plain;charset=iso-8859-1" }),
    missing:
      !profile.taxId.trim() || !profile.firstName.trim() || !profile.lastName.trim()
        ? "Para generar el fichero, completa tu NIF, nombre y apellidos en Configuración › Datos personales."
        : undefined,
  };
}

const LABEL_AEAT_FILE = "Fichero para la AEAT";

/** A button that can't be clicked, with the reason in a tooltip. */
function UnavailableFile({ label, reason }: { label: string; reason: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Disabled buttons don't fire pointer events: the wrapper shows the tooltip */}
        <span tabIndex={0}>
          <Button variant="secondary" size="md" disabled>
            <Download strokeWidth={1.8} aria-hidden="true" />
            {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{reason}</TooltipContent>
    </Tooltip>
  );
}

/** Downloads the AEAT file, or says why it can't be built. */
function AeatFileButton({ file }: { file: AeatFile }) {
  const label = file.label ?? LABEL_AEAT_FILE;
  if (file.missing) return <UnavailableFile label={label} reason={file.missing} />;
  let blob: Blob;
  try {
    blob = file.build();
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return (
      <UnavailableFile
        label={label}
        reason={
          file.invalid ??
          "Alguna casilla tiene un importe que el fichero de la AEAT no admite. Revisa las casillas que has cambiado a mano."
        }
      />
    );
  }
  return (
    <Button variant="secondary" size="md" onClick={() => downloadBlob(blob, file.name)}>
      <Download strokeWidth={1.8} aria-hidden="true" />
      {label}
    </Button>
  );
}

export interface ResultSummary {
  label: string;
  amount: Cents;
  /** Short word under the amount: "A ingresar", "A compensar"… */
  verdict: string;
  tone: "danger" | "success" | "neutral";
  detail?: ReactNode;
}

/** The headline of a return: its result, deadline and the ways to file it. */
export function ResultPanel({
  form,
  year,
  quarter,
  deadline,
  deadlineText,
  today,
  result,
  extra,
  file,
}: {
  form: FormCode;
  year: number;
  quarter: Quarter | null;
  /** Filing deadline; null when it isn't a fixed date (form 100). */
  deadline: Date | null;
  /** Shown instead of the deadline when there is none. */
  deadlineText?: string;
  today: Date;
  result: ResultSummary;
  extra?: ReactNode;
  /** The file to import in the AEAT's form; online-only forms have none. */
  file?: AeatFile;
}) {
  // Each form has its own window: a Q4 111 is due on January 20th, a Q4 303 on the 30th
  const status = deadline ? calendarStatus(obligation(form, year, quarter), today) : null;
  const days = deadline ? daysUntil(today, deadline) : null;

  return (
    <section
      aria-label="Resultado"
      className="flex animate-rise-in flex-col gap-5 rounded-xl border border-border bg-card p-5 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{result.label}</span>
        <span
          className={cn(
            "amount text-3xl font-semibold tracking-tight",
            result.tone === "success" && "text-success",
            result.amount === 0 && "text-muted-foreground",
          )}
        >
          {formatEUR(result.amount)}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={result.tone === "danger" ? "warning" : result.tone === "success" ? "success" : "neutral"}>
            {result.verdict}
          </Badge>
          {result.detail && <span className="text-muted-foreground">{result.detail}</span>}
        </span>
        {extra}
      </div>

      <div className="flex flex-col gap-3 lg:items-end">
        <div className="flex flex-wrap items-center gap-2 text-sm lg:justify-end">
          {deadline ? (
            <>
              <span className="text-muted-foreground">Plazo hasta el</span>
              <span className="font-medium">{formatDate(toIsoDate(deadline))}</span>
              {status && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Badge tone={CALENDAR_STATUS[status].tone}>{CALENDAR_STATUS[status].label}</Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{CALENDAR_STATUS[status].hint}</TooltipContent>
                </Tooltip>
              )}
              {status === "open" && days !== null && (
                <span className="text-xs font-semibold text-warning">{daysLeftLabel(days)}</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">{deadlineText}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {file && <AeatFileButton file={file} />}
          <a
            href={AEAT_LINKS[form]}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "secondary", size: "md" }), "no-underline")}
          >
            <ExternalLink strokeWidth={1.8} aria-hidden="true" />
            {form === "100"
              ? "Ir a Renta WEB"
              : ONLINE_ONLY_FORMS.has(form)
                ? `Cumplimentar el ${form}`
                : `Presentar el ${form}`}
          </a>
        </div>
      </div>
    </section>
  );
}

/** Switch between the quarterly and the yearly form of a tax. */
export function FormSwitch<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return <SegmentedControl label="Modelo" options={options} value={value} onChange={onChange} />;
}

export interface DocumentRow {
  id: string;
  to: string;
  date: string;
  number: string;
  contact: string;
  tag?: string;
  amounts: Cents[];
}

export interface DocumentGroup {
  key: string;
  label: string;
  columns: string[];
  rows: DocumentRow[];
  empty: string;
}

/** The documents behind the figures, to check them or jump to one. */
export function DocumentsPanel({ title, groups }: { title: string; groups: DocumentGroup[] }) {
  const [active, setActive] = useState(groups[0]!.key);
  const group = groups.find((g) => g.key === active) ?? groups[0]!;
  const totals = group.columns.map((_, i) => sumBy(group.rows, (r) => r.amounts[i] ?? cents(0)));
  const th = cn(table.th, "px-2.5");
  const td = cn(table.td, "px-2.5");

  return (
    <section
      aria-label={title}
      className="flex animate-rise-in flex-col gap-3 lg:overflow-hidden lg:rounded-xl lg:border lg:border-border"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 lg:px-4 lg:pt-3">
        <h2 className="m-0 text-lg font-semibold tracking-tight lg:text-title">{title}</h2>
        <SegmentedControl
          label="Tipo de documento"
          value={active}
          onChange={setActive}
          options={groups.map((g) => ({ value: g.key, label: `${g.label} · ${g.rows.length}` }))}
        />
      </div>

      {group.rows.length === 0 ? (
        <p className="m-0 border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">{group.empty}</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className={table.headRow}>
                  <th scope="col" className={th}>
                    Fecha
                  </th>
                  <th scope="col" className={th}>
                    Número
                  </th>
                  <th scope="col" className={th}>
                    Contacto
                  </th>
                  <th scope="col" className={th}>
                    Operación
                  </th>
                  {group.columns.map((c) => (
                    <th key={c} scope="col" className={cn(th, "text-right")}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((r, i) => (
                  <tr key={r.id} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
                    <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatDate(r.date)}</td>
                    <td className={td}>
                      <Link
                        to={r.to}
                        className="text-sm font-medium text-foreground tabular-nums no-underline hover:text-primary"
                      >
                        {r.number || "Sin número"}
                      </Link>
                    </td>
                    <td className={cn(td, "max-w-56 truncate")} title={r.contact}>
                      {r.contact}
                    </td>
                    <td className={td}>{r.tag && <Badge>{r.tag}</Badge>}</td>
                    {r.amounts.map((a, j) => (
                      <td key={j} className={cn(td, "text-right amount whitespace-nowrap")}>
                        {formatEUR(a)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/50 font-semibold">
                  <td className={td} colSpan={4}>
                    Total
                  </td>
                  {totals.map((t, j) => (
                    <td key={j} className={cn(td, "text-right amount whitespace-nowrap")}>
                      {formatEUR(t)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          <ul className="m-0 flex list-none flex-col p-0 lg:hidden">
            {group.rows.map((r) => (
              <li key={r.id}>
                <Link
                  to={r.to}
                  className="flex items-center justify-between gap-3 border-b border-divider py-3 text-foreground no-underline active:bg-muted"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">{r.contact}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(r.date)} · <span className="tabular-nums">{r.number || "Sin número"}</span>
                      {r.tag && ` · ${r.tag}`}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="amount">{formatEUR(r.amounts[0] ?? cents(0))}</span>
                    {r.amounts.length > 1 && (
                      <span className="amount text-xs text-muted-foreground">
                        {group.columns[1]} {formatEUR(r.amounts[1]!)}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Questions of the form that the books don't answer, with what to answer in each. */
export function FormAnswers({ title, rows, note }: { title: string; rows: FormAnswer[]; note?: ReactNode }) {
  const columns = { gridTemplateColumns: "minmax(0,1fr) minmax(0,22rem)" };
  return (
    <section aria-label={title} className="animate-rise-in overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground lg:grid" style={columns}>
        <h2 className="m-0 text-xs font-semibold text-foreground">{title}</h2>
        <span className="hidden text-right font-medium lg:block">Respuesta</span>
      </div>
      {rows.length === 0 ? (
        <p className="m-0 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          Sin datos: complétalos en Configuración › Impuestos.
        </p>
      ) : (
        <ul className="m-0 list-none p-0">
          {rows.map((r) => (
            <li
              key={r.box ?? r.label}
              className="flex flex-col gap-1 border-t border-border px-4 py-2.5 text-sm lg:grid lg:items-center lg:gap-4 lg:py-2"
              style={columns}
            >
              <span>{r.label}</span>
              <span className="flex items-center gap-2 text-muted-foreground lg:justify-end lg:text-right">
                {r.box && <BoxCode box={r.box} />}
                {r.answer}
              </span>
            </li>
          ))}
        </ul>
      )}
      {note && (
        <p className="m-0 flex gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {note}
        </p>
      )}
    </section>
  );
}

/** What the calculation assumes, folded away by default. */
export function Assumptions({ items }: { items: ReactNode[] }) {
  return (
    <details className="group rounded-xl border border-border px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
        <Info className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        Qué tiene en cuenta este cálculo
      </summary>
      <ul className="mt-2 mb-0 flex flex-col gap-1.5 pl-6 text-muted-foreground">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </details>
  );
}

/** Toggle to show the boxes that are zero, as the paper form lists them all. */
export function EmptyBoxesToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 cursor-pointer accent-primary"
      />
      Mostrar casillas a cero
    </label>
  );
}

/** The four quarterly returns behind a yearly summary, each linking to its quarter with its filing status. */
export function QuarterCards({
  form,
  year,
  today,
  values,
  to,
}: {
  form: "111" | "115";
  year: number;
  today: Date;
  values: Cents[];
  to: (quarter: Quarter) => string;
}) {
  return (
    <section
      aria-label={`Resultados de los ${form} del año`}
      className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
    >
      {values.map((v, i) => {
        const quarter = (i + 1) as Quarter;
        const status = CALENDAR_STATUS[calendarStatus(obligation(form, year, quarter), today)];
        return (
          <Link
            key={i}
            to={to(quarter)}
            className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 text-foreground no-underline transition-colors duration-150 hover:bg-muted"
          >
            <span className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              {form} · T{quarter}
              <Badge tone={status.tone}>{status.label}</Badge>
            </span>
            <span className={cn("amount text-lg font-semibold", v === 0 && "text-muted-foreground")}>
              {formatEUR(v)}
            </span>
            <span className="text-xs text-muted-foreground">{v > 0 ? "A ingresar" : "Sin retenciones"}</span>
          </Link>
        );
      })}
    </section>
  );
}

/** A warning above the figures, with optional links to the documents to review. */
export function Notice({ children, tone = "warning" }: { children: ReactNode; tone?: "warning" | "info" }) {
  return (
    <div
      className={cn(
        "m-0 flex flex-col gap-1.5 rounded-lg px-4 py-2.5 text-sm",
        tone === "warning" ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}

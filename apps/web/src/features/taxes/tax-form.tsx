import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { Check, Copy, Download, ExternalLink, Info, RotateCcw } from "lucide-react";
import { daysUntil, filingStatus, toIsoDate, type Boxes, type Quarter } from "@fiscalia/core";
import { Badge } from "@fiscalia/ui/components/badge";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import { Input } from "@fiscalia/ui/components/input";
import { SegmentedControl } from "@fiscalia/ui/components/segmented-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { table } from "@fiscalia/ui/lib/table";
import { daysLeftLabel, formatDate, parseDecimal } from "@/lib/format";
import { AEAT_LINKS, FILING_STATUS, type Cell, type FormCode, type FormSection } from "./taxes-model";

/* Building blocks of the tax form pages. Tooltips need a TooltipProvider above. */

/** As the AEAT forms expect it: no thousands separator and a decimal comma. */
const clipboardValue = (value: number) => value.toFixed(2).replace(".", ",");

const formatPercent = (value: number) => `${value.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;

function useCopied(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), 1_400);
    });
  };
  return [copied, copy];
}

export function BoxCode({ box }: { box: string }) {
  return <span className="font-mono text-2xs text-muted-foreground">[{box}]</span>;
}

/** A box and its amount; clicking copies the amount to paste it in the AEAT form. */
function BoxValue({
  box,
  value,
  percent,
  copied,
  onCopy,
  strong,
}: {
  box: string;
  value: number;
  percent: boolean;
  copied: boolean;
  onCopy: () => void;
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copiar casilla ${box}: ${percent ? formatPercent(value) : formatEUR(value)}`}
      className="group inline-flex cursor-pointer items-center justify-end gap-2 rounded-md px-1.5 py-0.5 transition-colors duration-150 hover:bg-accent"
    >
      <BoxCode box={box} />
      <span className={cn("amount", value === 0 && "text-muted-foreground", strong && "font-semibold")}>
        {percent ? formatPercent(value) : formatEUR(value)}
      </span>
      <span className="grid size-3.5 place-items-center text-muted-foreground" aria-hidden="true">
        {copied ? (
          <Check className="size-3.5 animate-fade-in text-success" strokeWidth={2} />
        ) : (
          <Copy className="size-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" strokeWidth={1.8} />
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
export function useEditable(computed: number): [number, EditableBox] {
  const [typed, setTyped] = useState<string>();
  const parsed = typed === undefined ? null : parseDecimal(typed);
  return [
    parsed ?? (typed?.trim() === "" ? 0 : computed),
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
            <Button variant="ghost" size="sm" className="size-7 px-0" aria-label="Volver al valor calculado" onClick={edit.onReset}>
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

const NO_BOXES = new Set<string>();

/** The form's sections, box by box. Rows whose boxes are all zero hide unless `showEmpty`. */
export function FormSections({
  sections,
  boxes,
  percentBoxes = NO_BOXES,
  editable = {},
  showEmpty,
}: {
  sections: FormSection[];
  boxes: Boxes;
  /** Boxes holding a rate, shown as a percentage. */
  percentBoxes?: Set<string>;
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
            <div
              className="flex items-center gap-4 bg-muted px-4 py-2 text-xs tracking-wide text-muted-foreground uppercase lg:grid"
              style={columns}
            >
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
                      key={r.cells.join()}
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
                        {r.hint && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" aria-label="Más información" className="cursor-help text-muted-foreground">
                                <Info className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-72">{r.hint}</TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      {r.cells.map((cell, c) =>
                        cell === null ? (
                          <span key={c} className="hidden lg:block" />
                        ) : (
                          <div key={c} className="flex items-center justify-between gap-2 lg:justify-end">
                            <span className="text-xs text-muted-foreground lg:hidden">{section.columns?.[c]}</span>
                            {!isBox(cell) ? (
                              <span className="amount pr-7 text-muted-foreground">{cell.text} %</span>
                            ) : editable[cell] ? (
                              <EditableValue box={cell} edit={editable[cell]} />
                            ) : (
                              <BoxValue
                                box={cell}
                                value={value(cell)}
                                percent={percentBoxes.has(cell)}
                                strong={r.total}
                                copied={copied === cell}
                                onCopy={() => copy(cell, clipboardValue(value(cell)))}
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

export interface ResultSummary {
  label: string;
  amount: number;
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
}) {
  const status = deadline ? filingStatus(year, quarter, today) : null;
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
        >{formatEUR(result.amount)}</span>
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
                      <Badge tone={FILING_STATUS[status].tone}>{FILING_STATUS[status].label}</Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{FILING_STATUS[status].hint}</TooltipContent>
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
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Disabled buttons don't fire pointer events: the wrapper shows the tooltip */}
              <span tabIndex={0}>
                <Button variant="secondary" size="md" disabled>
                  <Download strokeWidth={1.8} aria-hidden="true" />
                  {form === "100" ? "Libros para Renta WEB" : "Fichero para la AEAT"}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              Disponible próximamente: generará el fichero para importarlo en la sede de la AEAT. Mientras, copia
              cada casilla haciendo clic en su importe.
            </TooltipContent>
          </Tooltip>
          <a
            href={AEAT_LINKS[form]}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "secondary", size: "md" }), "no-underline")}
          >
            <ExternalLink strokeWidth={1.8} aria-hidden="true" />
            {form === "100" ? "Ir a Renta WEB" : `Presentar el ${form}`}
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
  amounts: number[];
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
  const totals = group.columns.map((_, i) => group.rows.reduce((acc, r) => acc + (r.amounts[i] ?? 0), 0));
  const th = cn(table.th, "px-2.5");
  const td = cn(table.td, "px-2.5");

  return (
    <section aria-label={title} className="flex animate-rise-in flex-col gap-3 lg:overflow-hidden lg:rounded-xl lg:border lg:border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 lg:px-4 lg:pt-3">
        <h2 className="m-0 text-md font-semibold">{title}</h2>
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
                  <th scope="col" className={th}>Fecha</th>
                  <th scope="col" className={th}>Número</th>
                  <th scope="col" className={th}>Contacto</th>
                  <th scope="col" className={th}>Operación</th>
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
                      <Link to={r.to} className="font-mono text-sm font-medium text-foreground no-underline hover:text-primary">
                        {r.number || "Sin número"}
                      </Link>
                    </td>
                    <td className={cn(td, "max-w-56 truncate")} title={r.contact}>
                      {r.contact}
                    </td>
                    <td className={td}>{r.tag && <Badge>{r.tag}</Badge>}</td>
                    {r.amounts.map((a, j) => (
                      <td key={j} className={cn(td, "text-right whitespace-nowrap amount")}>
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
                    <td key={j} className={cn(td, "text-right whitespace-nowrap amount")}>
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
                      {formatDate(r.date)} · <span className="font-mono">{r.number || "Sin número"}</span>
                      {r.tag && ` · ${r.tag}`}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="amount">{formatEUR(r.amounts[0] ?? 0)}</span>
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

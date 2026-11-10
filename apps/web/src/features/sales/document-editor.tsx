import { useId, useState, type CSSProperties, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, EllipsisVertical, Minus, Package, Plus, Trash2, X } from "lucide-react";
import {
  newId,
  WITHHOLDING_RATES,
  applyRate,
  cents,
  eurosToCents,
  invoiceTotals,
  lineBase,
  roundHundredths,
  type InvoiceLine,
  type WithholdingKind,
} from "@cuentalibre/core";
import type { Product, SalesLine } from "@cuentalibre/contracts";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@cuentalibre/ui/components/dropdown-menu";
import { Input, Textarea } from "@cuentalibre/ui/components/input";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { AnimatedAmount } from "@/components/animated-amount";
import { formatDecimalInput, parseDecimal } from "@/lib/format";
import { conceptFor } from "@/features/catalog/catalog-model";
import { useCatalog } from "@/features/catalog/catalog-store";
import { TagChip } from "@/features/settings/tag-chip";
import { TAG_SWATCHES, nextTagColor, tagsStore, textColorOn, useTags } from "@/features/settings/tags-store";
import { Field, GroupedSelect } from "./form-fields";
import { SURCHARGE_OPTIONS, VAT_RATE_OPTIONS, ratePercent } from "./sales-model";

/* Concept lines, totals and tags shared by the sales and purchase forms. */

export interface LineDraft {
  id: string;
  concept: string;
  unitPrice: string;
  quantity: string;
  discount: string;
  vatRate: number;
  surchargeRate: number;
  detail: string;
  serviceFrom: string;
  serviceTo: string;
  productId?: string;
  unit?: string;
}

/** A blank line; `discount` is the contact's default, as typed in the form. */
export const emptyLine = (vatRate = 0.21, discount = "0"): LineDraft => ({
  id: newId(),
  concept: "",
  unitPrice: "",
  quantity: "1",
  discount,
  vatRate,
  surchargeRate: 0,
  detail: "",
  serviceFrom: "",
  serviceTo: "",
});

export function parseLine(line: LineDraft): InvoiceLine | null {
  const unitPrice = parseDecimal(line.unitPrice);
  const quantity = parseDecimal(line.quantity);
  const discount = parseDecimal(line.discount || "0");
  if (unitPrice === null || quantity === null || discount === null) return null;
  return { unitPrice, quantity, discount: discount / 100, vatRate: line.vatRate, surchargeRate: line.surchargeRate };
}

export const isBlank = (line: LineDraft) => !line.concept.trim() && !line.unitPrice.trim();

/** A stored line as editable text; `negate` flips the quantity, for credit notes. */
export function toLineDraft(line: SalesLine, negate = false): LineDraft {
  return {
    id: newId(),
    concept: line.concept,
    unitPrice: formatDecimalInput(line.unitPrice),
    quantity: formatDecimalInput(negate ? -line.quantity : line.quantity),
    discount: formatDecimalInput(line.discount * 100),
    vatRate: line.vatRate,
    surchargeRate: line.surchargeRate ?? 0,
    detail: line.detail ?? "",
    serviceFrom: line.serviceFrom ?? "",
    serviceTo: line.serviceTo ?? "",
    productId: line.productId,
    unit: line.unit,
  };
}

/** The filled-in drafts as stored lines. Call only after validating them. */
export function toLines(drafts: LineDraft[]): SalesLine[] {
  return drafts
    .filter((l) => !isBlank(l))
    .map((l) => ({
      id: l.id,
      concept: l.concept.trim(),
      ...parseLine(l)!,
      detail: l.detail.trim() || undefined,
      serviceFrom: l.serviceFrom || undefined,
      serviceTo: l.serviceTo || undefined,
      productId: l.productId,
      unit: l.unit,
    }));
}

/** Validation message for the lines, or undefined when they are fine. */
export function linesError(drafts: LineDraft[]): string | undefined {
  const filled = drafts.filter((l) => !isBlank(l));
  if (filled.length === 0) return "Añade al menos un concepto con su precio.";
  if (filled.some((l) => !l.concept.trim() || parseLine(l) === null))
    return "Revisa los conceptos: cada uno necesita descripción, precio y cantidad válidos.";
  return undefined;
}

export function TagsField({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const known = useTags();
  const [color, setColor] = useState<string | null>(null);
  // A name that isn't in Configuración › Etiquetas is created there, with the color picked here
  const isNew = draft.trim() !== "" && !tagsStore.find(draft);
  const newColor = color ?? nextTagColor();
  const add = () => {
    // Use the configured spelling when the name matches a known tag
    const tag = tagsStore.find(draft)?.name ?? draft.trim();
    if (isNew) tagsStore.add({ id: newId(), name: tag, color: newColor });
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setDraft("");
    setColor(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !draft && tags.length) onChange(tags.slice(0, -1));
  };
  return (
    <Field label="Etiquetas">
      {(p) => (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              {...p}
              value={draft}
              list={listId}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
            />
            {/* Tags from Configuración › Etiquetas as suggestions; any other name works too */}
            <datalist id={listId}>
              {known
                .filter((t) => !tags.includes(t.name))
                .map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
            </datalist>
            <Button variant="secondary" size="icon" aria-label="Añadir etiqueta" title="Añadir etiqueta" onClick={add}>
              <Plus strokeWidth={1.8} aria-hidden="true" />
            </Button>
          </div>
          {isNew && (
            <div
              role="group"
              aria-label="Color de la nueva etiqueta"
              className="flex flex-col gap-2 rounded-lg bg-muted/50 p-2.5"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                Etiqueta nueva
                <span
                  className="min-w-0 truncate rounded-full px-2.5 leading-6 font-medium"
                  style={{ backgroundColor: newColor, color: textColorOn(newColor) }}
                >
                  {draft.trim()}
                </span>
              </span>
              <span className="flex flex-wrap gap-2">
                {TAG_SWATCHES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-label={`Color ${s}`}
                    aria-pressed={newColor === s}
                    onClick={() => setColor(s)}
                    className={cn(
                      "size-6 cursor-pointer rounded-full border border-border p-0 transition-[scale] duration-150 active:scale-95",
                      newColor === s && "outline-2 outline-offset-2 outline-ring",
                    )}
                    // A sample of the color itself
                    style={{ backgroundColor: s }}
                  />
                ))}
              </span>
            </div>
          )}
          {tags.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {tags.map((tag) => (
                <TagChip key={tag} as="li" name={tag} className="flex h-7 items-center gap-1 pr-1 pl-2.5 text-sm">
                  <button
                    type="button"
                    aria-label={`Quitar etiqueta ${tag}`}
                    onClick={() => onChange(tags.filter((t) => t !== tag))}
                    className="flex size-5 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-current opacity-70 hover:bg-current/15 hover:opacity-100"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </TagChip>
              ))}
            </ul>
          )}
        </div>
      )}
    </Field>
  );
}

/*
 * Desktop: one row per line under a header. Advanced editing adds the taxable base column
 * and a second row with surcharge, detailed description and service period.
 * Mobile: each line is a small card.
 */
const lineGrid = (advanced: boolean) =>
  cn(
    "grid grid-cols-2 gap-x-3 gap-y-2.5 lg:items-start lg:gap-y-0",
    advanced
      ? "lg:grid-cols-[minmax(0,1fr)_6.5rem_8rem_5rem_6.5rem_5.5rem_6rem_4.5rem]"
      : "lg:grid-cols-[minmax(0,1fr)_6.5rem_8rem_5rem_5.5rem_6rem_4.5rem]",
  );

interface LinesEditorProps {
  lines: LineDraft[];
  parsed: (InvoiceLine | null)[];
  chargesVat: boolean;
  advanced: boolean;
  reordering: boolean;
  invalid: boolean;
  vatLabel: (line: InvoiceLine | null) => string;
  /** Which catalog price a picked product brings: the sale price, or the cost for purchases. */
  pricing?: "sale" | "cost";
  onChange: (id: string, changes: Partial<LineDraft>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onReorder: () => void;
}

export function LinesEditor({
  lines,
  parsed,
  chargesVat,
  advanced,
  reordering,
  invalid,
  vatLabel,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
  onReorder,
  pricing = "sale",
}: LinesEditorProps) {
  const { settings } = useCatalog();
  const fromProduct = (p: Product): Partial<LineDraft> => {
    const sale = pricing === "sale";
    return {
      productId: p.id,
      unit: p.unit ?? undefined,
      concept: conceptFor(p, settings.conceptText),
      unitPrice: formatDecimalInput(sale ? p.price : (p.cost ?? 0)),
      discount: sale ? formatDecimalInput(p.discount * 100) : "0",
      vatRate: chargesVat ? (sale ? p.vatRate : p.costVatRate) : 0,
      surchargeRate: chargesVat ? (sale ? p.surchargeRate : p.costSurchargeRate) : 0,
      ...(settings.copyDescription && p.description ? { detail: p.description } : {}),
    };
  };
  const head = "text-xs font-medium text-muted-foreground";
  const label = "text-xs font-medium text-muted-foreground lg:sr-only";
  const readOnlyBox =
    "flex h-10 items-center justify-end rounded-lg bg-muted px-3 text-sm text-muted-foreground amount";
  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden="true" className={cn(lineGrid(advanced), "hidden lg:grid")}>
        <span className={head}>Concepto</span>
        <span className={cn(head, "text-right")}>Base</span>
        <span className={cn(head, "text-center")}>Cantidad</span>
        <span className={cn(head, "text-right")}>Dto. %</span>
        {advanced && <span className={cn(head, "text-right")}>Total B.I.</span>}
        <span className={head}>IVA</span>
        <span className={cn(head, "text-right")}>Cuota IVA</span>
        <span />
      </div>
      <ul className="m-0 flex list-none flex-col gap-4 p-0 lg:gap-3">
        {lines.map((line, i) => {
          const value = parsed[i] ?? null;
          const n = i + 1;
          const lineInvalid = invalid && !isBlank(line) && (!line.concept.trim() || value === null);
          return (
            <li
              key={line.id}
              className={cn(
                // Phones stack the lines, a divider between each
                "flex animate-row-in flex-col gap-2.5 not-first:max-lg:border-t not-first:max-lg:border-divider not-first:max-lg:pt-4",
                advanced && "lg:border-b lg:border-divider lg:pb-3",
              )}
            >
              <div className={lineGrid(advanced)}>
                <div className="col-span-2 flex flex-col gap-1 lg:col-span-1">
                  <span className={label}>
                    Concepto <span className="sr-only">{n}</span>
                  </span>
                  <div className="flex gap-1.5">
                    <ProductPicker
                      disabled={reordering}
                      pricing={pricing}
                      onPick={(p) => onChange(line.id, fromProduct(p))}
                    />
                    <Textarea
                      autoGrow
                      rows={1}
                      value={line.concept}
                      onChange={(e) => onChange(line.id, { concept: e.target.value })}
                      placeholder="Descripción del servicio o producto"
                      aria-label={`Concepto ${n}`}
                      aria-invalid={lineInvalid && !line.concept.trim() ? true : undefined}
                      className="min-h-10 py-2"
                    />
                  </div>
                </div>
                <NumberCell
                  label="Base"
                  n={n}
                  labelClass={label}
                  value={line.unitPrice}
                  suffix="€"
                  invalid={lineInvalid && parseDecimal(line.unitPrice) === null}
                  onChange={(v) => onChange(line.id, { unitPrice: v })}
                />
                <QuantityCell
                  n={n}
                  labelClass={label}
                  value={line.quantity}
                  invalid={lineInvalid && parseDecimal(line.quantity) === null}
                  onChange={(v) => onChange(line.id, { quantity: v })}
                />
                <NumberCell
                  label="Descuento"
                  n={n}
                  labelClass={label}
                  value={line.discount}
                  suffix="%"
                  invalid={lineInvalid && parseDecimal(line.discount || "0") === null}
                  onChange={(v) => onChange(line.id, { discount: v })}
                />
                {advanced && (
                  <div className="flex flex-col gap-1">
                    <span className={label}>Total B.I.</span>
                    <span className={readOnlyBox}>{value ? formatEUR(lineBase(value)) : "—"}</span>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <span className={label} id={`${line.id}-vat`}>
                    IVA <span className="sr-only">{n}</span>
                  </span>
                  <GroupedSelect
                    id={`${line.id}-vat-select`}
                    aria-labelledby={`${line.id}-vat`}
                    value={String(line.vatRate)}
                    onChange={(v) => onChange(line.id, { vatRate: Number(v) })}
                    groups={[{ options: VAT_RATE_OPTIONS }]}
                    disabled={!chargesVat}
                    className="px-2.5"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className={label}>Cuota IVA</span>
                  <span className={readOnlyBox}>{vatLabel(value)}</span>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-0.5 lg:col-span-1 lg:h-10">
                  {reordering ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Subir concepto ${n}`}
                        disabled={i === 0}
                        onClick={() => onMove(i, i - 1)}
                      >
                        <ArrowUp strokeWidth={1.8} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Bajar concepto ${n}`}
                        disabled={i === lines.length - 1}
                        onClick={() => onMove(i, i + 1)}
                      >
                        <ArrowDown strokeWidth={1.8} aria-hidden="true" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onRemove(line.id)}
                        aria-label={`Eliminar concepto ${n}`}
                        className="hover:text-destructive"
                      >
                        <Trash2 strokeWidth={1.8} aria-hidden="true" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Más opciones del concepto ${n}`}
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                        >
                          <EllipsisVertical strokeWidth={1.8} aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => onRemove(line.id)}>
                            <Trash2 aria-hidden="true" />
                            Eliminar concepto
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={lines.length < 2} onSelect={onReorder}>
                            <ArrowUpDown aria-hidden="true" />
                            Reordenar concepto
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onDuplicate(line.id)}>
                            <Copy aria-hidden="true" />
                            Crear concepto por copia
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              </div>

              {advanced && (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end lg:gap-3">
                  <label className="col-span-full flex flex-col gap-1 lg:col-span-1">
                    <span className="text-xs font-medium text-muted-foreground">Descripción detallada</span>
                    <Textarea
                      autoGrow
                      rows={1}
                      value={line.detail}
                      onChange={(e) => onChange(line.id, { detail: e.target.value })}
                      placeholder="Texto adicional que se imprime bajo el concepto"
                      className="min-h-10 py-2"
                    />
                  </label>
                  <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
                    <legend className="mb-1 p-0 text-xs font-medium text-muted-foreground">
                      Periodo de prestación del servicio
                    </legend>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        aria-label={`Desde, concepto ${n}`}
                        value={line.serviceFrom}
                        onChange={(e) => onChange(line.id, { serviceFrom: e.target.value })}
                        className="w-40"
                      />
                      <span className="text-sm text-muted-foreground">hasta</span>
                      <Input
                        type="date"
                        aria-label={`Hasta, concepto ${n}`}
                        value={line.serviceTo}
                        min={line.serviceFrom || undefined}
                        onChange={(e) => onChange(line.id, { serviceTo: e.target.value })}
                        className="w-40"
                      />
                    </div>
                  </fieldset>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground" id={`${line.id}-re`}>
                      Recargo de equivalencia
                    </span>
                    <div className="flex gap-2">
                      <GroupedSelect
                        id={`${line.id}-re-select`}
                        aria-labelledby={`${line.id}-re`}
                        value={String(line.surchargeRate)}
                        onChange={(v) => onChange(line.id, { surchargeRate: Number(v) })}
                        groups={[{ options: SURCHARGE_OPTIONS }]}
                        disabled={!chargesVat}
                        className="w-24 px-2.5"
                      />
                      <span className={cn(readOnlyBox, "w-24")}>
                        {value ? formatEUR(applyRate(lineBase(value), line.surchargeRate)) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Active catalog products, searchable by name, code or family. */
function ProductPicker({
  disabled,
  pricing,
  onPick,
}: {
  disabled: boolean;
  pricing: "sale" | "cost";
  onPick: (product: Product) => void;
}) {
  const { products, families } = useCatalog();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const familyName = new Map(families.map((f) => [f.id, f.name]));
  const shown = products
    .filter((p) => p.active)
    .filter((p) => !q || [p.name, p.sku, familyName.get(p.familyId ?? "")].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label="Seleccionar producto del catálogo"
        title="Seleccionar producto del catálogo"
        className={buttonVariants({ variant: "secondary", size: "icon" })}
      >
        <Package strokeWidth={1.8} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 w-80 overflow-y-auto">
        <div className="p-1 pb-1.5">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Keep the menu's typeahead from taking the keys
            onKeyDown={(e) => e.key !== "ArrowDown" && e.key !== "Escape" && e.stopPropagation()}
            placeholder="Buscar en el catálogo"
            aria-label="Buscar en el catálogo"
            className="h-9"
          />
        </div>
        {shown.length === 0 && (
          <p className="m-0 px-2.5 py-2 text-sm text-muted-foreground">
            {products.length === 0 ? "El catálogo está vacío." : "Ningún producto coincide."}
          </p>
        )}
        {shown.map((p) => {
          const price = pricing === "sale" ? p.price : p.cost;
          return (
            <DropdownMenuItem key={p.id} onSelect={() => onPick(p)} className="h-auto justify-between gap-3 py-1.5">
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{p.name}</span>
                {p.sku && <span className="truncate text-xs text-muted-foreground tabular-nums">{p.sku}</span>}
              </span>
              <span className="amount text-sm text-muted-foreground">
                {price === null ? "—" : formatEUR(eurosToCents(price))}
                {p.unit && <span className="font-sans">/{p.unit}</span>}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NumberCell({
  label,
  n,
  labelClass,
  value,
  suffix,
  invalid,
  onChange,
}: {
  label: string;
  n: number;
  labelClass: string;
  value: string;
  suffix?: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass}>
        {label} <span className="sr-only">{n}</span>
      </span>
      <span className="relative flex items-center">
        <Input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid ? true : undefined}
          className={cn("text-right amount", suffix && "pr-7")}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 text-sm text-muted-foreground" aria-hidden="true">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

/** Quantity with − / + steppers of one unit. */
function QuantityCell({
  n,
  labelClass,
  value,
  invalid,
  onChange,
}: {
  n: number;
  labelClass: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const step = (delta: number) => onChange(formatDecimalInput(roundHundredths((parseDecimal(value) ?? 0) + delta)));
  const stepper =
    "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={labelClass}>
        Cantidad <span className="sr-only">{n}</span>
      </label>
      <div
        className={cn(
          "flex h-10 items-center rounded-lg border border-input bg-background px-0.5 focus-within:border-ring",
          invalid && "border-destructive",
        )}
      >
        <button
          type="button"
          className={stepper}
          aria-label={`Restar una unidad, concepto ${n}`}
          onClick={() => step(-1)}
        >
          <Minus className="size-3.5" aria-hidden="true" />
        </button>
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid ? true : undefined}
          className="w-full min-w-0 border-0 bg-transparent text-center amount text-foreground outline-none"
        />
        <button
          type="button"
          className={stepper}
          aria-label={`Sumar una unidad, concepto ${n}`}
          onClick={() => step(1)}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function Totals({
  totals,
  withholding,
  advanced,
  supplies,
  onSuppliesChange,
}: {
  totals: ReturnType<typeof invoiceTotals>;
  withholding: WithholdingKind;
  advanced: boolean;
  /** Suplidos input, shown in advanced mode; purchases don't have them. */
  supplies?: string;
  onSuppliesChange?: (value: string) => void;
}) {
  const rate = WITHHOLDING_RATES[withholding];
  const item = "flex min-w-0 flex-col gap-1 lg:flex-1";
  const caption = "text-sm text-muted-foreground";
  const amount = "m-0 amount text-lg font-semibold";
  const vatRates = totals.vatBreakdown.filter((v) => v.vat !== 0).map((v) => ratePercent(v.rate));
  return (
    <dl
      aria-label="Totales"
      className="m-0 grid animate-rise-in grid-cols-2 gap-4 surface p-5 sm:grid-cols-3 lg:flex lg:gap-6"
      style={{ "--i": 3 } as CSSProperties}
    >
      <div className={item}>
        <dt className={caption}>Subtotal</dt>
        <dd className={amount}>
          <AnimatedAmount value={totals.base} />
        </dd>
      </div>
      <div className={item}>
        <dt className={caption}>
          IVA {vatRates.length > 0 && <span className="text-xs">({vatRates.join(", ")})</span>}
        </dt>
        <dd className={amount}>
          <AnimatedAmount value={totals.vat} />
        </dd>
      </div>
      {(advanced || totals.surcharge !== 0) && (
        <div className={item}>
          <dt className={caption}>Recargo de equivalencia</dt>
          <dd className={amount}>
            <AnimatedAmount value={totals.surcharge} />
          </dd>
        </div>
      )}
      <div className={item}>
        <dt className={caption}>Retención{rate > 0 && ` ${ratePercent(rate)}`}</dt>
        <dd className={amount}>
          <AnimatedAmount value={cents(-totals.withholding)} />
        </dd>
      </div>
      {advanced && supplies !== undefined && onSuppliesChange && (
        <div className={item}>
          <dt className={caption}>
            <label htmlFor="supplies">Suplidos</label>
          </dt>
          <dd className="m-0">
            <span className="relative flex items-center">
              <Input
                id="supplies"
                inputMode="decimal"
                value={supplies}
                onChange={(e) => onSuppliesChange(e.target.value)}
                aria-invalid={parseDecimal(supplies || "0") === null ? true : undefined}
                className="pr-7 text-right amount font-semibold"
              />
              <span className="pointer-events-none absolute right-3 text-sm text-muted-foreground" aria-hidden="true">
                €
              </span>
            </span>
          </dd>
        </div>
      )}
      {/* The total closes the card: under a divider on phones, after one on desktop */}
      <div className="col-span-full flex min-w-0 flex-col gap-1 border-t border-divider pt-4 lg:flex-[1.3] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        <dt className="text-sm font-semibold">Total</dt>
        <dd className="m-0 amount text-2xl font-semibold">
          <AnimatedAmount value={totals.total} />
        </dd>
      </div>
    </dl>
  );
}

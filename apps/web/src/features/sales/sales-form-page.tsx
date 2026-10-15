import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ChevronDown, Plus, Trash2, UserPlus } from "lucide-react";
import {
  VAT_RATES,
  WITHHOLDING_RATES,
  addDays,
  invoiceTotals,
  lineBase,
  operationChargesVat,
  toIsoDate,
  type InvoiceLine,
  type OperationType,
  type WithholdingKind,
} from "@fiscalia/core";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import { Checkbox, Input, Textarea } from "@fiscalia/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@fiscalia/ui/components/select";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { formatDate, formatDecimalInput, parseDecimal } from "@/lib/format";
import { clients, type IncomeType, type InvoiceSeries, type SalesDocument, type SalesKind } from "@/mocks/sales";
import {
  INCOME_TYPES,
  KINDS,
  OPERATION_TYPES,
  SERIES_OPTIONS,
  WITHHOLDING_OPTIONS,
  nextNumber,
  periodKeyOf,
} from "./sales-model";
import { salesStore } from "./sales-store";

const DUE_TERMS = [30, 60, 90] as const;

interface LineDraft {
  id: string;
  concept: string;
  unitPrice: string;
  quantity: string;
  discount: string;
  vatRate: number;
}

interface FormState {
  clientId: string;
  number: string;
  series: InvoiceSeries;
  issuedOn: string;
  dueOn: string | null;
  incomeType: IncomeType;
  withholding: WithholdingKind;
  operationType: OperationType;
  operationOn: string;
  cashBasis: boolean;
  rental: boolean;
  markPaid: boolean;
  lines: LineDraft[];
  publicNotes: string;
  privateNotes: string;
}

type Errors = Partial<Record<"clientId" | "number" | "issuedOn" | "lines", string>>;

const emptyLine = (vatRate = 0.21): LineDraft => ({
  id: crypto.randomUUID(),
  concept: "",
  unitPrice: "",
  quantity: "1",
  discount: "0",
  vatRate,
});

/** The form starts from an existing document (edit), a source to copy (duplicate, rectify, convert) or blank. */
function initialState(kind: SalesKind, base: SalesDocument | undefined, isCopy: boolean, rectify: boolean): FormState {
  const today = toIsoDate(new Date());
  const issuedOn = isCopy || !base ? today : base.issuedOn;
  const series: InvoiceSeries = rectify ? "rectifying" : (base?.series ?? "normal");
  const dueOn = KINDS[kind].dueLabel === null ? null : isCopy || !base ? addDays(issuedOn, 30) : base.dueOn;
  const number =
    kind === "draft"
      ? ""
      : base && !isCopy
        ? (base.number ?? "")
        : nextNumber(kind, series, Number(issuedOn.slice(0, 4)), salesStore.all());

  return {
    clientId: base?.clientId ?? "",
    number,
    series,
    issuedOn,
    dueOn,
    incomeType: base?.incomeType ?? "705",
    withholding: base?.withholding ?? "none",
    operationType: base?.operationType ?? "national",
    operationOn: (!isCopy && base?.operationOn) || "",
    cashBasis: base?.cashBasis ?? false,
    rental: base?.rental ?? false,
    markPaid: !isCopy && base?.status === "paid",
    lines: base?.lines.map((l) => ({
      id: crypto.randomUUID(),
      concept: l.concept,
      unitPrice: formatDecimalInput(l.unitPrice),
      quantity: formatDecimalInput(rectify ? -l.quantity : l.quantity),
      discount: formatDecimalInput(l.discount * 100),
      vatRate: l.vatRate,
    })) ?? [emptyLine()],
    publicNotes: rectify && base?.number ? `Rectifica la factura ${base.number}.` : (base?.publicNotes ?? ""),
    privateNotes: isCopy ? "" : (base?.privateNotes ?? ""),
  };
}

function parseLine(line: LineDraft): InvoiceLine | null {
  const unitPrice = parseDecimal(line.unitPrice);
  const quantity = parseDecimal(line.quantity);
  const discount = parseDecimal(line.discount || "0");
  if (unitPrice === null || quantity === null || discount === null) return null;
  return { unitPrice, quantity, discount: discount / 100, vatRate: line.vatRate };
}

const isBlank = (line: LineDraft) => !line.concept.trim() && !line.unitPrice.trim();

export function SalesFormPage({ kind: routeKind }: { kind: SalesKind }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const existing = id ? salesStore.get(id) : undefined;

  if (id && !existing) {
    const config = KINDS[routeKind];
    return (
      <div className="flex flex-col gap-3 px-5 pt-6 lg:px-10 lg:pt-8">
        <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">No encontrado</h1>
        <p className="m-0 text-muted-foreground">Este documento no existe o se ha eliminado.</p>
        <Link to={config.path} className="font-medium text-primary no-underline hover:text-primary-hover">
          Volver a {config.title.toLowerCase()}
        </Link>
      </div>
    );
  }

  const source = !existing ? salesStore.get(params.get("desde") ?? "") : undefined;
  return (
    <SalesForm
      // A new ?desde= starts over
      key={existing?.id ?? source?.id ?? "new"}
      kind={existing?.kind ?? routeKind}
      existing={existing}
      source={source}
      rectify={params.get("rectificar") === "1"}
    />
  );
}

interface SalesFormProps {
  kind: SalesKind;
  existing?: SalesDocument;
  source?: SalesDocument;
  rectify: boolean;
}

function SalesForm({ kind, existing, source, rectify }: SalesFormProps) {
  const navigate = useNavigate();
  const config = KINDS[kind];
  const [form, setForm] = useState(() => initialState(kind, existing ?? source, !existing, rectify));
  const [errors, setErrors] = useState<Errors>({});
  const [dueTerm, setDueTerm] = useState<number | null | "custom">(() =>
    form.dueOn === null ? null : (DUE_TERMS.find((d) => addDays(form.issuedOn, d) === form.dueOn) ?? "custom"),
  );

  // Editing a field clears its error; the rest stay until the next submit
  const clearError = (key: keyof Errors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "clientId" || key === "number" || key === "issuedOn" || key === "lines") clearError(key);
  };
  const setLine = (lineId: string, changes: Partial<LineDraft>) => {
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.id === lineId ? { ...l, ...changes } : l)) }));
    clearError("lines");
  };

  const chargesVat = operationChargesVat(form.operationType);
  const parsedLines = form.lines.map(parseLine);
  const totals = invoiceTotals(
    parsedLines.filter((l) => l !== null),
    WITHHOLDING_RATES[form.withholding],
  );

  const numbered = kind !== "draft";
  const hasSeries = kind === "invoice" || kind === "draft";
  const title = existing
    ? `${config.singular} ${existing.number ?? "sin número"}`
    : rectify
      ? "Nueva factura rectificativa"
      : config.newLabel;

  const changeIssuedOn = (issuedOn: string) => {
    setForm((f) => ({
      ...f,
      issuedOn,
      dueOn: typeof dueTerm === "number" && issuedOn ? addDays(issuedOn, dueTerm) : f.dueOn,
    }));
  };

  const changeSeries = (series: InvoiceSeries) => {
    setForm((f) => ({
      ...f,
      series,
      number: existing ? f.number : nextNumber(kind, series, Number(f.issuedOn.slice(0, 4)), salesStore.all()),
    }));
  };

  const changeOperationType = (operationType: OperationType) => {
    const vat = operationChargesVat(operationType);
    setForm((f) => ({
      ...f,
      operationType,
      // Operations without VAT go at 0%; going back to national restores the general rate
      lines:
        vat === operationChargesVat(f.operationType)
          ? f.lines
          : f.lines.map((l) => ({ ...l, vatRate: vat ? 0.21 : 0 })),
    }));
  };

  function validate(asKind: SalesKind): Errors {
    const next: Errors = {};
    if (!form.clientId) next.clientId = "Elige un cliente.";
    if (!form.issuedOn) next.issuedOn = "Indica la fecha.";
    if (asKind !== "draft") {
      if (!form.number.trim()) next.number = "Indica el número.";
      else if (
        salesStore.all().some((d) => d.id !== existing?.id && d.kind === asKind && d.number === form.number.trim())
      )
        next.number = "Ya existe un documento con este número.";
    }
    const filled = form.lines.filter((l) => !isBlank(l));
    if (filled.length === 0) next.lines = "Añade al menos un concepto con su precio.";
    else if (filled.some((l) => !l.concept.trim() || parseLine(l) === null))
      next.lines = "Revisa los conceptos: cada uno necesita descripción, precio y cantidad válidos.";
    return next;
  }

  function save(asKind: SalesKind) {
    const found = validate(asKind);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }

    const lines = form.lines
      .filter((l) => !isBlank(l))
      .map((l) => ({ id: l.id, concept: l.concept.trim(), ...parseLine(l)! }));
    const isInvoice = asKind === "invoice";
    const doc: SalesDocument = {
      id: existing?.id ?? crypto.randomUUID(),
      kind: asKind,
      number: asKind === "draft" ? null : form.number.trim(),
      series: form.series,
      clientId: form.clientId,
      issuedOn: form.issuedOn,
      dueOn: config.dueLabel === null ? null : form.dueOn,
      incomeType: form.incomeType,
      withholding: form.withholding,
      operationType: form.operationType,
      operationOn: form.operationOn || null,
      cashBasis: form.cashBasis,
      rental: form.rental,
      lines,
      status: isInvoice
        ? form.markPaid
          ? "paid"
          : "pending"
        : (existing?.status ?? (asKind === "draft" ? "pending" : "created")),
      publicNotes: form.publicNotes.trim(),
      privateNotes: form.privateNotes.trim(),
    };

    if (existing) salesStore.update(existing.id, doc);
    else salesStore.add(doc);
    // Invoicing a quote or delivery note closes it
    if (source && (source.kind === "quote" || source.kind === "deliveryNote") && (isInvoice || asKind === "draft"))
      salesStore.update(source.id, { status: "invoiced" });

    navigate(`${KINDS[asKind].path}?periodo=${periodKeyOf(doc.issuedOn)}`);
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save(kind);
  };

  const primaryLabel = existing ? "Guardar cambios" : config.createLabel;
  const secondary =
    kind === "invoice" && !existing
      ? { label: "Guardar como borrador", onClick: () => save("draft") }
      : kind === "draft"
        ? { label: "Emitir factura", onClick: () => save("invoice") }
        : null;

  const actions = (className?: string) => (
    <div className={cn("flex gap-2.5", className)}>
      {secondary && (
        <Button variant="secondary" onClick={secondary.onClick} className="flex-1 lg:flex-none">
          {secondary.label}
        </Button>
      )}
      <Button type="submit" className="flex-1 lg:flex-none">
        {primaryLabel}
      </Button>
    </div>
  );

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5 px-5 pt-6 lg:gap-6 lg:px-10 lg:pt-8 lg:pb-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to={config.path}
            aria-label={`Volver a ${config.title.toLowerCase()}`}
            className={cn(buttonVariants({ variant: "secondary", size: "icon" }), "size-10 no-underline")}
          >
            <ArrowLeft strokeWidth={1.8} aria-hidden="true" />
          </Link>
          <h1 className="m-0 truncate text-2xl font-semibold tracking-tight lg:text-3xl">{title}</h1>
        </div>
        {actions("hidden lg:flex")}
      </header>

      {source && !existing && (
        <p className="m-0 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">
          {rectify
            ? `Rectificando la factura ${source.number}. Las cantidades se han puesto en negativo.`
            : `Copiado de ${KINDS[source.kind].noun} ${source.number ?? "sin número"}. Revisa los datos antes de guardar.`}
        </p>
      )}

      <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
        <Section title="Datos">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Cliente" required error={errors.clientId} className="xl:col-span-2">
              {(fieldProps) => (
                <div className="flex gap-2">
                  <Select value={form.clientId} onValueChange={(v) => set("clientId", v)}>
                    <SelectTrigger
                      {...fieldProps}
                      className="min-w-0 flex-1 font-normal aria-invalid:border-destructive"
                    >
                      <span className="flex-1 truncate text-left">
                        <SelectValue placeholder="Selecciona el cliente" />
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} · <span className="font-mono text-sm">{c.taxId}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Link
                    to="/contactos/clientes/nuevo"
                    aria-label="Nuevo cliente"
                    title="Nuevo cliente"
                    className={cn(buttonVariants({ variant: "secondary", size: "md" }), "w-10 px-0 no-underline")}
                  >
                    <UserPlus strokeWidth={1.8} aria-hidden="true" />
                  </Link>
                </div>
              )}
            </Field>

            {numbered ? (
              <Field label="Número" required error={errors.number}>
                {(p) => (
                  <Input
                    {...p}
                    value={form.number}
                    onChange={(e) => set("number", e.target.value)}
                    className="font-mono"
                  />
                )}
              </Field>
            ) : (
              <Field label="Número" hint="Se asigna al emitir la factura.">
                {(p) => <Input {...p} value="" placeholder="Borrador" disabled />}
              </Field>
            )}

            {hasSeries && (
              <Field label="Serie">
                {(p) => (
                  <SelectField
                    value={form.series}
                    onChange={(v) => changeSeries(v as InvoiceSeries)}
                    options={SERIES_OPTIONS}
                    {...p}
                  />
                )}
              </Field>
            )}

            <Field label="Fecha" required error={errors.issuedOn}>
              {(p) => (
                <Input {...p} type="date" value={form.issuedOn} onChange={(e) => changeIssuedOn(e.target.value)} />
              )}
            </Field>

            {config.dueLabel && (
              <Field
                label={config.dueLabel}
                hint={form.dueOn ? `Vence el ${formatDate(form.dueOn)}` : "Sin fecha de vencimiento"}
              >
                {(p) => (
                  <div className="flex flex-col gap-2">
                    <Input
                      {...p}
                      type="date"
                      value={form.dueOn ?? ""}
                      onChange={(e) => {
                        set("dueOn", e.target.value || null);
                        setDueTerm(e.target.value ? "custom" : null);
                      }}
                    />
                    <div role="group" aria-label="Plazos rápidos" className="flex flex-wrap gap-1.5">
                      {[...DUE_TERMS, null].map((term) => (
                        <button
                          key={term ?? "none"}
                          type="button"
                          aria-pressed={dueTerm === term}
                          onClick={() => {
                            setDueTerm(term);
                            set("dueOn", term === null ? null : addDays(form.issuedOn, term));
                          }}
                          className="h-7 cursor-pointer rounded-full border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary"
                        >
                          {term === null ? "Sin fecha" : `${term} días`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Field>
            )}

            <Field label="Tipo de ingreso">
              {(p) => (
                <SelectField
                  value={form.incomeType}
                  onChange={(v) => set("incomeType", v as IncomeType)}
                  options={INCOME_TYPES}
                  {...p}
                />
              )}
            </Field>

            <Field label="Retención de IRPF">
              {(p) => (
                <SelectField
                  value={form.withholding}
                  onChange={(v) => set("withholding", v as WithholdingKind)}
                  options={WITHHOLDING_OPTIONS}
                  {...p}
                />
              )}
            </Field>
          </div>
        </Section>

        <Section title="Conceptos">
          <LinesEditor
            lines={form.lines}
            parsed={parsedLines}
            chargesVat={chargesVat}
            invalid={Boolean(errors.lines)}
            onChange={setLine}
            onRemove={(lineId) =>
              set("lines", form.lines.length > 1 ? form.lines.filter((l) => l.id !== lineId) : [emptyLine()])
            }
          />
          {errors.lines && (
            <p role="alert" className="m-0 text-sm text-destructive">
              {errors.lines}
            </p>
          )}
          <Button
            variant="secondary"
            size="md"
            className="self-start"
            onClick={() => set("lines", [...form.lines, emptyLine(chargesVat ? 0.21 : 0)])}
          >
            <Plus strokeWidth={2} aria-hidden="true" />
            Añadir concepto
          </Button>
          <Totals totals={totals} withholding={form.withholding} />
        </Section>

        <Section title="Notas">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Notas en el documento" hint="Se imprimen al pie: condiciones de pago, IBAN…">
              {(p) => <Textarea {...p} value={form.publicNotes} onChange={(e) => set("publicNotes", e.target.value)} />}
            </Field>
            <Field label="Notas privadas" hint="Solo las ves tú.">
              {(p) => (
                <Textarea {...p} value={form.privateNotes} onChange={(e) => set("privateNotes", e.target.value)} />
              )}
            </Field>
          </div>
        </Section>

        <details className="group rounded-xl border border-border bg-card">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 font-semibold [&::-webkit-details-marker]:hidden">
            <span className="text-lg">Opciones avanzadas</span>
            <ChevronDown
              className="size-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="flex flex-col gap-4 px-5 pb-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha de operación" hint="Solo si es distinta de la fecha del documento.">
                {(p) => (
                  <Input
                    {...p}
                    type="date"
                    value={form.operationOn}
                    onChange={(e) => set("operationOn", e.target.value)}
                  />
                )}
              </Field>
              <Field label="Tipo de operación" hint={OPERATION_TYPES.find((o) => o.value === form.operationType)?.hint}>
                {(p) => (
                  <SelectField
                    value={form.operationType}
                    onChange={(v) => changeOperationType(v as OperationType)}
                    options={OPERATION_TYPES}
                    {...p}
                  />
                )}
              </Field>
            </div>
            <div className="flex flex-col gap-3">
              <CheckField
                label="Criterio de caja"
                hint="El IVA se declara cuando cobras, no cuando emites."
                checked={form.cashBasis}
                onChange={(v) => set("cashBasis", v)}
              />
              <CheckField
                label="Arrendamiento de inmuebles"
                hint="Alquiler de un local o vivienda para uso profesional."
                checked={form.rental}
                onChange={(v) => set("rental", v)}
              />
              {kind === "invoice" && (
                <CheckField label="Marcar como cobrada" checked={form.markPaid} onChange={(v) => set("markPaid", v)} />
              )}
            </div>
          </div>
        </details>
      </div>

      {/* Mobile: actions at the end of the form */}
      {actions("lg:hidden")}
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

interface FieldControlProps {
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
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}

/** Label, control and message. The control receives the id and ARIA wiring. */
function Field({ label, required, error, hint, className, children }: FieldProps) {
  const id = useId();
  const message = error ?? hint;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
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

interface SelectFieldProps extends FieldControlProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}

function SelectField({ value, onChange, options, disabled, className, ...aria }: SelectFieldProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        {...aria}
        className={cn("w-full font-normal disabled:cursor-not-allowed disabled:opacity-50", className)}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          <SelectValue />
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CheckField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-px" />
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

const VAT_OPTIONS = VAT_RATES.map((r) => ({ value: String(r), label: `${Math.round(r * 100)} %` }));

/* Desktop: one row per line under a header. Mobile: each line is a small card. */
const lineGrid =
  "grid grid-cols-2 gap-x-3 gap-y-2.5 lg:grid-cols-[minmax(0,1fr)_7rem_5rem_5rem_5.5rem_7rem_2.5rem] lg:items-start lg:gap-y-0";

interface LinesEditorProps {
  lines: LineDraft[];
  parsed: (InvoiceLine | null)[];
  chargesVat: boolean;
  invalid: boolean;
  onChange: (id: string, changes: Partial<LineDraft>) => void;
  onRemove: (id: string) => void;
}

function LinesEditor({ lines, parsed, chargesVat, invalid, onChange, onRemove }: LinesEditorProps) {
  const head = "text-xs font-medium tracking-wide text-muted-foreground uppercase";
  const label = "text-xs font-medium text-muted-foreground lg:sr-only";
  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden="true" className={cn(lineGrid, "hidden lg:grid")}>
        <span className={head}>Concepto</span>
        <span className={cn(head, "text-right")}>Precio</span>
        <span className={cn(head, "text-right")}>Cantidad</span>
        <span className={cn(head, "text-right")}>Dto. %</span>
        <span className={head}>IVA</span>
        <span className={cn(head, "text-right")}>Importe</span>
        <span />
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {lines.map((line, i) => {
          const value = parsed[i];
          const n = i + 1;
          const lineInvalid = invalid && !isBlank(line) && (!line.concept.trim() || value === null);
          return (
            <li
              key={line.id}
              className={cn(lineGrid, "rounded-lg border border-border p-3 lg:rounded-none lg:border-0 lg:p-0")}
            >
              <label className="col-span-2 flex flex-col gap-1 lg:col-span-1">
                <span className={label}>
                  Concepto <span className="sr-only">{n}</span>
                </span>
                <Textarea
                  rows={1}
                  value={line.concept}
                  onChange={(e) => onChange(line.id, { concept: e.target.value })}
                  placeholder="Descripción del servicio o producto"
                  aria-invalid={lineInvalid && !line.concept.trim() ? true : undefined}
                  className="min-h-10 py-2"
                />
              </label>
              <NumberCell
                label="Precio"
                n={n}
                labelClass={label}
                value={line.unitPrice}
                suffix="€"
                invalid={lineInvalid && parseDecimal(line.unitPrice) === null}
                onChange={(v) => onChange(line.id, { unitPrice: v })}
              />
              <NumberCell
                label="Cantidad"
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
              <div className="flex flex-col gap-1">
                <span className={label} id={`${line.id}-vat`}>
                  IVA <span className="sr-only">{n}</span>
                </span>
                <SelectField
                  id={`${line.id}-vat-select`}
                  aria-labelledby={`${line.id}-vat`}
                  value={String(line.vatRate)}
                  onChange={(v) => onChange(line.id, { vatRate: Number(v) })}
                  options={VAT_OPTIONS}
                  disabled={!chargesVat}
                  className="px-2.5"
                />
              </div>
              <div className="flex flex-col items-end justify-center gap-1 lg:h-10">
                <span className={label}>Importe</span>
                <span className="amount text-base font-medium">{formatEUR(value ? lineBase(value) : 0)}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(line.id)}
                aria-label={`Quitar concepto ${n}`}
                className="col-span-2 justify-self-end text-muted-foreground hover:text-destructive lg:col-span-1 lg:size-10 lg:px-0"
              >
                <Trash2 strokeWidth={1.8} aria-hidden="true" />
                <span className="lg:hidden">Quitar</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
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
          className={cn("amount text-right", suffix && "pr-7")}
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

function Totals({ totals, withholding }: { totals: ReturnType<typeof invoiceTotals>; withholding: WithholdingKind }) {
  const rate = WITHHOLDING_RATES[withholding];
  const row = "flex items-baseline justify-between gap-4";
  return (
    <div className="flex justify-end border-t border-divider pt-4">
      <dl aria-label="Totales" className="m-0 flex w-full flex-col gap-2.5 sm:w-80">
        <div className={row}>
          <dt className="text-muted-foreground">Base imponible</dt>
          <dd className="amount m-0">{formatEUR(totals.base)}</dd>
        </div>
        {(totals.vatBreakdown.length ? totals.vatBreakdown : [{ rate: 0.21, base: 0, vat: 0 }]).map((v) => (
          <div key={v.rate} className={row}>
            <dt className="text-muted-foreground">IVA {Math.round(v.rate * 100)} %</dt>
            <dd className="amount m-0">{formatEUR(v.vat)}</dd>
          </div>
        ))}
        {rate > 0 && (
          <div className={row}>
            <dt className="text-muted-foreground">Retención IRPF {Math.round(rate * 100)} %</dt>
            <dd className="amount m-0">{formatEUR(-totals.withholding)}</dd>
          </div>
        )}
        <div className={cn(row, "mt-1 border-t border-divider pt-3.5")}>
          <dt className="font-semibold">Total</dt>
          <dd className="amount m-0 text-2xl font-semibold">{formatEUR(totals.total)}</dd>
        </div>
      </dl>
    </div>
  );
}

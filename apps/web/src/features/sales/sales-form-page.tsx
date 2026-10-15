import { useId, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  CircleHelp,
  Copy,
  EllipsisVertical,
  FilePen,
  Landmark,
  Mail,
  Minus,
  Package,
  Pencil,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import {
  WITHHOLDING_RATES,
  addDays,
  invoiceTotals,
  lineBase,
  operationChargesVat,
  roundCents,
  toIsoDate,
  type InvoiceLine,
  type OperationType,
  type WithholdingKind,
} from "@fiscalia/core";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@fiscalia/ui/components/dropdown-menu";
import { Input, Textarea } from "@fiscalia/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@fiscalia/ui/components/select";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { AnimatedAmount } from "@/components/animated-amount";
import { formatDate, formatDecimalInput, parseDecimal } from "@/lib/format";
import { paymentMethods, products } from "@/mocks/invoicing";
import {
  clients,
  type Client,
  type IncomeType,
  type InvoiceSeries,
  type RentalLocation,
  type SalesDocument,
  type SalesKind,
} from "@/mocks/sales";
import { CLIENT_DEFAULT, CheckField, Field, GroupedSelect, LocaleFields, Section } from "./form-fields";
import { defaultNumberFormat } from "./invoice-locale";
import { invoiceSettingsStore, useInvoiceSettings } from "./invoice-settings";
import {
  INCOME_TYPE_GROUPS,
  KINDS,
  OPERATION_TYPES,
  RENTAL_LOCATIONS,
  SERIES_GROUPS,
  SURCHARGE_OPTIONS,
  VAT_RATE_OPTIONS,
  WITHHOLDING_GROUPS,
  clientOf,
  nextNumber,
  periodKeyOf,
  ratePercent,
} from "./sales-model";
import { salesStore } from "./sales-store";

const DUE_TERMS = [30, 60, 90] as const;
const SETTINGS_PATH = "/configuracion/facturas";
/** Radix Select can't hold an empty value: this stands for "no client". */
const NO_CLIENT = "none";

interface LineDraft {
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
}

interface FormState {
  clientId: string;
  number: string;
  series: InvoiceSeries;
  rectifiesId: string;
  issuedOn: string;
  dueOn: string | null;
  incomeType: IncomeType;
  withholding: WithholdingKind;
  operationType: OperationType;
  operationOn: string;
  cashBasis: boolean;
  rental: boolean;
  rentalLocation: RentalLocation;
  cadastralRef: string;
  markPaid: boolean;
  paidOn: string;
  paymentMethodId: string;
  lines: LineDraft[];
  supplies: string;
  publicNotes: string;
  privateNotes: string;
  tags: string[];
  language: string;
  numberFormat: string;
}

type Errors = Partial<Record<"clientId" | "number" | "rectifiesId" | "issuedOn" | "lines", string>>;

/** What happens after saving, from the create button's menu. */
type AfterSave = "list" | "edit" | "send" | "receipt";

const emptyLine = (vatRate = 0.21): LineDraft => ({
  id: crypto.randomUUID(),
  concept: "",
  unitPrice: "",
  quantity: "1",
  discount: "0",
  vatRate,
  surchargeRate: 0,
  detail: "",
  serviceFrom: "",
  serviceTo: "",
});

/** The form starts from an existing document (edit), a source to copy (duplicate, rectify, convert) or blank. */
function initialState(kind: SalesKind, base: SalesDocument | undefined, isCopy: boolean, rectify: boolean): FormState {
  const today = toIsoDate(new Date());
  const issuedOn = isCopy || !base ? today : base.issuedOn;
  // Only invoices have rectifying series; the other kinds have a single series of their own
  const series: InvoiceSeries = rectify ? "rectifying" : kind === "invoice" ? (base?.series ?? "normal") : "normal";
  const dueOn = KINDS[kind].dueLabel === null ? null : isCopy || !base ? addDays(issuedOn, 30) : base.dueOn;
  const number =
    base && !isCopy && base.number
      ? base.number
      : nextNumber(kind, series, Number(issuedOn.slice(0, 4)), salesStore.all());

  return {
    clientId: base?.clientId ?? "",
    number,
    series,
    rectifiesId: rectify && base ? base.id : (base?.rectifiesId ?? ""),
    issuedOn,
    dueOn,
    incomeType: base?.incomeType ?? "705",
    withholding: base?.withholding ?? "none",
    operationType: base?.operationType ?? "national",
    operationOn: (!isCopy && base?.operationOn) || "",
    cashBasis: base?.cashBasis ?? false,
    rental: base?.rental ?? false,
    rentalLocation: base?.rentalLocation ?? "spain",
    cadastralRef: base?.cadastralRef ?? "",
    markPaid: !isCopy && base?.status === "paid",
    paidOn: (!isCopy && base?.paidOn) || issuedOn,
    paymentMethodId: base?.paymentMethodId ?? paymentMethods[0]!.id,
    lines: base?.lines.map((l) => ({
      id: crypto.randomUUID(),
      concept: l.concept,
      unitPrice: formatDecimalInput(l.unitPrice),
      quantity: formatDecimalInput(rectify ? -l.quantity : l.quantity),
      discount: formatDecimalInput(l.discount * 100),
      vatRate: l.vatRate,
      surchargeRate: l.surchargeRate ?? 0,
      detail: l.detail ?? "",
      serviceFrom: l.serviceFrom ?? "",
      serviceTo: l.serviceTo ?? "",
    })) ?? [emptyLine()],
    supplies: base?.supplies ? formatDecimalInput(base.supplies) : "0",
    publicNotes: rectify && base?.number ? `Rectifica la factura ${base.number}.` : (base?.publicNotes ?? ""),
    privateNotes: isCopy ? "" : (base?.privateNotes ?? ""),
    tags: base?.tags ?? [],
    language: base?.language ?? "",
    numberFormat: base?.numberFormat ?? "",
  };
}

function parseLine(line: LineDraft): InvoiceLine | null {
  const unitPrice = parseDecimal(line.unitPrice);
  const quantity = parseDecimal(line.quantity);
  const discount = parseDecimal(line.discount || "0");
  if (unitPrice === null || quantity === null || discount === null) return null;
  return { unitPrice, quantity, discount: discount / 100, vatRate: line.vatRate, surchargeRate: line.surchargeRate };
}

const isBlank = (line: LineDraft) => !line.concept.trim() && !line.unitPrice.trim();

/** "la factura" → "Información de la factura"; "el presupuesto" → "Información del presupuesto". */
const infoTitle = (noun: string) => `Información ${noun.replace(/^el /, "del ").replace(/^la /, "de la ")}`;

export function SalesFormPage({ kind: routeKind }: { kind: SalesKind }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const existing = id ? salesStore.get(id) : undefined;

  if (id && !existing) {
    const config = KINDS[routeKind];
    return (
      <div className="flex flex-col gap-3 px-5 pt-6 lg:px-8 lg:pt-6">
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
  const settings = useInvoiceSettings();
  const [form, setForm] = useState(() => initialState(kind, existing ?? source, !existing, rectify));
  const [errors, setErrors] = useState<Errors>({});
  const [advanced, setAdvanced] = useState(
    () => form.lines.some((l) => l.surchargeRate || l.detail || l.serviceFrom || l.serviceTo) || form.supplies !== "0",
  );
  const [reordering, setReordering] = useState(false);
  const [dueTerm, setDueTerm] = useState<number | null | "custom">(() =>
    form.dueOn === null ? null : (DUE_TERMS.find((d) => addDays(form.issuedOn, d) === form.dueOn) ?? "custom"),
  );

  // Editing a field clears its error; the rest stay until the next submit
  const clearError = (key: keyof Errors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "clientId" || key === "number" || key === "rectifiesId" || key === "issuedOn" || key === "lines")
      clearError(key);
  };
  const setLines = (update: (lines: LineDraft[]) => LineDraft[]) => {
    setForm((f) => ({ ...f, lines: update(f.lines) }));
    clearError("lines");
  };
  const setLine = (lineId: string, changes: Partial<LineDraft>) =>
    setLines((lines) => lines.map((l) => (l.id === lineId ? { ...l, ...changes } : l)));

  const chargesVat = operationChargesVat(form.operationType);
  const parsedLines = form.lines.map(parseLine);
  const totals = invoiceTotals(
    parsedLines.filter((l) => l !== null),
    WITHHOLDING_RATES[form.withholding],
    parseDecimal(form.supplies || "0") ?? 0,
  );

  const isInvoice = kind === "invoice";
  const rectifying = isInvoice && form.series === "rectifying";
  const client = clients.find((c) => c.id === form.clientId);
  const rectifiable = salesStore
    .all()
    .filter((d) => d.kind === "invoice" && d.series === "normal" && d.id !== existing?.id);
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

  const suggestedNumber = (series: InvoiceSeries) =>
    nextNumber(kind, series, Number((form.issuedOn || toIsoDate(new Date())).slice(0, 4)), salesStore.all());

  const changeSeries = (value: string) => {
    // The "Opciones" entries lead to the series settings
    if (value === "new" || value === "settings") {
      navigate(`${SETTINGS_PATH}#series`);
      return;
    }
    const series = value as InvoiceSeries;
    setForm((f) => ({ ...f, series, number: existing ? f.number : suggestedNumber(series) }));
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
          : f.lines.map((l) => ({ ...l, vatRate: vat ? 0.21 : 0, surchargeRate: 0 })),
    }));
  };

  const changeLanguage = (value: string) => {
    const language = value === CLIENT_DEFAULT ? "" : value;
    setForm((f) => ({ ...f, language, numberFormat: defaultNumberFormat(language) }));
  };

  function validate(asKind: SalesKind): Errors {
    const next: Errors = {};
    if (KINDS[asKind].clientRequired && !form.clientId) next.clientId = "Elige un cliente.";
    if (!form.issuedOn) next.issuedOn = "Indica la fecha.";
    // Issuing a draft takes the next invoice number, so only the kind's own number is checked
    if (asKind === kind) {
      if (!form.number.trim()) next.number = "Indica el número.";
      else if (
        salesStore.all().some((d) => d.id !== existing?.id && d.kind === asKind && d.number === form.number.trim())
      )
        next.number = "Ya existe un documento con este número.";
    }
    if (rectifying && !existing && !form.rectifiesId) next.rectifiesId = "Elige la factura que rectifica.";
    const filled = form.lines.filter((l) => !isBlank(l));
    if (filled.length === 0) next.lines = "Añade al menos un concepto con su precio.";
    else if (filled.some((l) => !l.concept.trim() || parseLine(l) === null))
      next.lines = "Revisa los conceptos: cada uno necesita descripción, precio y cantidad válidos.";
    return next;
  }

  function save(asKind: SalesKind, after: AfterSave = "list") {
    const found = validate(asKind);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }

    const lines = form.lines
      .filter((l) => !isBlank(l))
      .map((l) => ({
        id: l.id,
        concept: l.concept.trim(),
        ...parseLine(l)!,
        detail: l.detail.trim() || undefined,
        serviceFrom: l.serviceFrom || undefined,
        serviceTo: l.serviceTo || undefined,
      }));
    const asInvoice = asKind === "invoice";
    const paid = asInvoice && form.markPaid;
    const number =
      asKind === kind
        ? form.number.trim()
        : nextNumber(asKind, form.series, Number(form.issuedOn.slice(0, 4)), salesStore.all());
    const doc: SalesDocument = {
      id: existing?.id ?? crypto.randomUUID(),
      kind: asKind,
      number,
      series: form.series,
      rectifiesId: rectifying ? form.rectifiesId || undefined : undefined,
      clientId: form.clientId,
      issuedOn: form.issuedOn,
      dueOn: KINDS[asKind].dueLabel === null ? null : form.dueOn,
      incomeType: form.incomeType,
      withholding: form.withholding,
      operationType: form.operationType,
      operationOn: form.operationOn || null,
      cashBasis: form.cashBasis,
      rental: form.rental,
      rentalLocation: form.rental ? form.rentalLocation : undefined,
      cadastralRef: form.rental ? form.cadastralRef.trim() || undefined : undefined,
      lines,
      supplies: totals.supplies || undefined,
      status: asInvoice
        ? paid
          ? "paid"
          : "pending"
        : (existing?.status ?? (asKind === "draft" ? "pending" : "created")),
      paidOn: paid ? form.paidOn || form.issuedOn : undefined,
      paymentMethodId: paid ? form.paymentMethodId : undefined,
      publicNotes: form.publicNotes.trim(),
      privateNotes: form.privateNotes.trim(),
      tags: form.tags.length ? form.tags : undefined,
      language: form.language || undefined,
      numberFormat: form.numberFormat || undefined,
      attachments: existing?.attachments,
    };

    if (existing) salesStore.update(existing.id, doc);
    else salesStore.add(doc);
    // Invoicing a quote or delivery note closes it
    if (source && (source.kind === "quote" || source.kind === "deliveryNote") && (asInvoice || asKind === "draft"))
      salesStore.update(source.id, { status: "invoiced" });

    if (after === "edit") {
      navigate(`${KINDS[asKind].path}/${doc.id}`);
      return;
    }
    if (after === "send") {
      // No email backend yet: download the PDF and open the mail client to attach it
      void import("./sales-pdf").then((m) => m.downloadDocumentPdf(doc));
      const email = clientOf(doc).email ?? "";
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(`${KINDS[asKind].singular} ${doc.number}`)}`;
    }
    navigate(after === "receipt" ? "/bancos" : `${KINDS[asKind].path}?periodo=${periodKeyOf(doc.issuedOn)}`);
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save(kind);
  };

  const primaryLabel = existing ? "Guardar cambios" : config.createLabel;
  const secondary = kind === "draft" ? { label: "Emitir factura", onClick: () => save("invoice") } : null;

  const actions = (className?: string) => (
    <div className={cn("flex gap-2.5", className)}>
      {secondary && (
        <Button variant="secondary" onClick={secondary.onClick} className="flex-1 lg:flex-none">
          {secondary.label}
        </Button>
      )}
      {!existing ? (
        <div className="flex flex-1 lg:flex-none">
          <Button type="submit" className="flex-1 rounded-r-none lg:flex-none">
            {primaryLabel}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Más formas de crear"
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-l-none border-l border-primary-foreground/25 px-2.5",
              )}
            >
              <ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => save(kind, "edit")}>
                <FilePen aria-hidden="true" />
                Crear e ir a la pantalla de editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => save(kind, "send")}>
                <Mail aria-hidden="true" />
                Crear y enviar
              </DropdownMenuItem>
              {isInvoice && (
                <DropdownMenuItem onSelect={() => save(kind, "receipt")}>
                  <Landmark aria-hidden="true" />
                  Crear y generar recibo de cobro
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <Button type="submit" className="flex-1 lg:flex-none">
          {primaryLabel}
        </Button>
      )}
    </div>
  );

  const vatLabel = (line: InvoiceLine | null) => (line ? formatEUR(roundCents(lineBase(line) * line.vatRate)) : "—");

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5 px-5 pt-6 lg:gap-4 lg:px-8 lg:pt-6 lg:pb-8">
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
          <div className="flex items-center gap-2.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Opciones"
                className={cn(buttonVariants({ variant: "secondary", size: "icon" }), "size-10")}
              >
                <EllipsisVertical strokeWidth={1.8} aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => navigate(SETTINGS_PATH)}>
                  <Settings aria-hidden="true" />
                  Configurar {config.singular.toLowerCase()}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/ayuda")}>
                  <CircleHelp aria-hidden="true" />
                  Ayuda
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link
              to="/contactos/clientes/nuevo"
              className={cn(buttonVariants({ variant: "secondary" }), "hidden no-underline sm:inline-flex")}
            >
              Nuevo cliente
            </Link>
            {actions("hidden lg:flex")}
          </div>
        </header>

        {source && !existing && (
          <p className="m-0 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">
            {rectify
              ? `Rectificando la factura ${source.number}. Las cantidades se han puesto en negativo.`
              : `Copiado de ${KINDS[source.kind].noun} ${source.number ?? "sin número"}. Revisa los datos antes de guardar.`}
          </p>
        )}

        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          <Section title={infoTitle(config.noun)} index={1}>
            {client && <ClientSummary client={client} />}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Cliente" required={config.clientRequired} error={errors.clientId}>
                {(fieldProps) => (
                  <Select value={form.clientId} onValueChange={(v) => set("clientId", v === NO_CLIENT ? "" : v)}>
                    <SelectTrigger {...fieldProps} className="w-full font-normal aria-invalid:border-destructive">
                      <span className="min-w-0 flex-1 truncate text-left">
                        <SelectValue placeholder={config.clientPlaceholder} />
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                    </SelectTrigger>
                    <SelectContent>
                      {!config.clientRequired && (
                        <SelectItem value={NO_CLIENT} className="text-muted-foreground">
                          {config.clientPlaceholder}
                        </SelectItem>
                      )}
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} · <span className="font-mono text-sm">{c.taxId}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field
                label="Número"
                required
                error={errors.number}
                help="Número correlativo dentro de la serie. «Obtener número» propone el siguiente libre."
                action={
                  <button
                    type="button"
                    onClick={() => set("number", suggestedNumber(form.series))}
                    className="cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Obtener número
                  </button>
                }
              >
                {(p) => (
                  <Input
                    {...p}
                    value={form.number}
                    onChange={(e) => set("number", e.target.value)}
                    className="font-mono"
                  />
                )}
              </Field>

              <Field label="Serie" required>
                {(p) => (
                  <GroupedSelect
                    {...p}
                    value={form.series}
                    onChange={changeSeries}
                    groups={[
                      ...(isInvoice ? SERIES_GROUPS : [{ options: [{ value: "normal", label: config.seriesLabel }] }]),
                      {
                        label: "Opciones",
                        options: [
                          { value: "new", label: "Crear nueva serie" },
                          { value: "settings", label: "Configurar series" },
                        ],
                      },
                    ]}
                  />
                )}
              </Field>

              {rectifying && (
                <Field label="Rectifica la factura" required error={errors.rectifiesId}>
                  {(p) => (
                    <Select value={form.rectifiesId} onValueChange={(v) => set("rectifiesId", v)}>
                      <SelectTrigger {...p} className="w-full font-normal aria-invalid:border-destructive">
                        <span className="min-w-0 flex-1 truncate text-left">
                          <SelectValue placeholder="No se ha seleccionado ninguna factura" />
                        </span>
                        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                      </SelectTrigger>
                      <SelectContent>
                        {rectifiable.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            <span className="font-mono text-sm">{d.number}</span> · {clientOf(d).name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  hint={
                    form.dueOn
                      ? `${isInvoice ? "Vence" : "Válido hasta"} el ${formatDate(form.dueOn)}`
                      : `Sin ${config.dueLabel.toLowerCase()}`
                  }
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
                            className="h-7 cursor-pointer rounded-sm border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary"
                          >
                            {term === null ? "Sin fecha" : `${term} días`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </Field>
              )}

              {isInvoice && (
                <Field
                  label="Tipo de ingreso"
                  help="Cuenta del Plan General Contable (grupo 7) en la que se registra el ingreso."
                >
                  {(p) => (
                    <GroupedSelect
                      {...p}
                      value={form.incomeType}
                      onChange={(v) => set("incomeType", v as IncomeType)}
                      groups={[{ label: "Grupo 7: Ventas e ingresos", options: [] }, ...INCOME_TYPE_GROUPS]}
                    />
                  )}
                </Field>
              )}

              <Field label="Retención" help="IRPF que el cliente te retiene e ingresa a Hacienda en tu nombre.">
                {(p) => (
                  <GroupedSelect
                    {...p}
                    value={form.withholding}
                    onChange={(v) => set("withholding", v as WithholdingKind)}
                    groups={WITHHOLDING_GROUPS}
                  />
                )}
              </Field>
            </div>
          </Section>

          <Section
            title="Conceptos"
            index={2}
            action={
              reordering ? (
                <Button variant="secondary" size="sm" onClick={() => setReordering(false)}>
                  Terminar de reordenar
                </Button>
              ) : (
                <button
                  type="button"
                  aria-pressed={advanced}
                  onClick={() => setAdvanced((a) => !a)}
                  className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-sm font-medium text-primary hover:text-primary-hover"
                >
                  <ChevronDown
                    className={cn("size-4 transition-transform duration-200", advanced && "rotate-180")}
                    aria-hidden="true"
                  />
                  {advanced ? "Ocultar edición avanzada" : "Mostrar edición avanzada"}
                </button>
              )
            }
          >
            <LinesEditor
              lines={form.lines}
              parsed={parsedLines}
              chargesVat={chargesVat}
              advanced={advanced}
              reordering={reordering}
              invalid={Boolean(errors.lines)}
              vatLabel={vatLabel}
              onChange={setLine}
              onRemove={(lineId) =>
                setLines((lines) => (lines.length > 1 ? lines.filter((l) => l.id !== lineId) : [emptyLine()]))
              }
              onDuplicate={(lineId) =>
                setLines((lines) =>
                  lines.flatMap((l) => (l.id === lineId ? [l, { ...l, id: crypto.randomUUID() }] : [l])),
                )
              }
              onMove={(from, to) =>
                setLines((lines) => {
                  const next = [...lines];
                  next.splice(to, 0, next.splice(from, 1)[0]!);
                  return next;
                })
              }
              onReorder={() => setReordering(true)}
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
              Añadir otro concepto
            </Button>
          </Section>

          <Totals
            totals={totals}
            withholding={form.withholding}
            advanced={advanced}
            supplies={form.supplies}
            onSuppliesChange={(v) => set("supplies", v)}
          />

          <Section title="Notas" index={3}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <InvoiceNotes
                label={`Notas en ${config.noun}`}
                value={form.publicNotes}
                onChange={(v) => set("publicNotes", v)}
              />
              <Field label="Notas privadas" help="Solo las ves tú: no aparecen en el documento.">
                {(p) => (
                  <Textarea
                    {...p}
                    rows={2}
                    value={form.privateNotes}
                    onChange={(e) => set("privateNotes", e.target.value)}
                  />
                )}
              </Field>
              <TagsField tags={form.tags} onChange={(tags) => set("tags", tags)} />
            </div>
          </Section>

          {isInvoice && (
            <Section title="Opciones avanzadas" index={4}>
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
                <Field
                  label="Tipo de operación"
                  help="Decide cómo se trata el IVA y en qué casillas de los modelos 303, 349 y 390 aparece."
                >
                  {(p) => (
                    <Select value={form.operationType} onValueChange={(v) => changeOperationType(v as OperationType)}>
                      <SelectTrigger {...p} className="w-full font-normal">
                        <span className="min-w-0 flex-1 truncate text-left">
                          <SelectValue>
                            {OPERATION_TYPES.find((o) => o.value === form.operationType)?.label}
                          </SelectValue>
                        </span>
                        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                      </SelectTrigger>
                      <SelectContent className="max-w-[min(36rem,calc(100vw-2rem))]">
                        {OPERATION_TYPES.map((o) => (
                          <SelectItem key={o.value} value={o.value} className="h-auto min-h-9 py-2">
                            {o.label}
                            <span className="block text-sm font-normal text-muted-foreground">{o.hint}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </div>
              <div className="flex flex-col gap-4">
                <CheckField
                  label="Factura emitida en criterio de caja"
                  help="El IVA se declara cuando cobras, no cuando emites. Solo si estás acogido al régimen especial de criterio de caja."
                  checked={form.cashBasis}
                  onChange={(v) => set("cashBasis", v)}
                />
                <CheckField
                  label="Operación de arrendamiento de inmuebles"
                  help="Alquiler de un local o vivienda. Se informa en los modelos 115, 180 y 347 con su situación y referencia catastral."
                  checked={form.rental}
                  onChange={(v) => set("rental", v)}
                />
                {form.rental && (
                  <div className="grid gap-4 pl-7.5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <Field label="Situación">
                      {(p) => (
                        <Select
                          value={form.rentalLocation}
                          onValueChange={(v) => set("rentalLocation", v as RentalLocation)}
                        >
                          <SelectTrigger {...p} className="w-full font-normal">
                            <span className="min-w-0 flex-1 truncate text-left">
                              <SelectValue />
                            </span>
                            <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                          </SelectTrigger>
                          <SelectContent className="max-w-[min(40rem,calc(100vw-2rem))]">
                            {RENTAL_LOCATIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value} className="h-auto min-h-9 py-2">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </Field>
                    <Field label="Referencia catastral">
                      {(p) => (
                        <Input
                          {...p}
                          value={form.cadastralRef}
                          onChange={(e) => set("cadastralRef", e.target.value)}
                          disabled={form.rentalLocation === "noCadastralRef" || form.rentalLocation === "abroad"}
                          className="font-mono"
                        />
                      )}
                    </Field>
                  </div>
                )}
                <CheckField
                  label="Marcar factura como cobrada"
                  help="Registra el cobro con su fecha y el método por el que lo recibiste."
                  checked={form.markPaid}
                  onChange={(v) => set("markPaid", v)}
                />
                {form.markPaid && (
                  <div className="flex flex-wrap items-end gap-3 pl-7.5">
                    <Field label="Fecha de cobro" className="w-44">
                      {(p) => (
                        <Input {...p} type="date" value={form.paidOn} onChange={(e) => set("paidOn", e.target.value)} />
                      )}
                    </Field>
                    <Field label="Método de cobro" className="w-56">
                      {(p) => (
                        <GroupedSelect
                          {...p}
                          value={form.paymentMethodId}
                          onChange={(v) => set("paymentMethodId", v)}
                          groups={[{ options: paymentMethods.map((m) => ({ value: m.id, label: m.name })) }]}
                        />
                      )}
                    </Field>
                    <Link
                      to="/configuracion/metodos-de-pago"
                      className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "text-primary no-underline")}
                    >
                      <Plus aria-hidden="true" />
                      Nuevo método
                    </Link>
                  </div>
                )}
              </div>
            </Section>
          )}

          <Section title="Otros" index={isInvoice ? 5 : 4}>
            <LocaleFields
              language={form.language}
              numberFormat={form.numberFormat}
              onLanguageChange={changeLanguage}
              onNumberFormatChange={(v) => set("numberFormat", v === CLIENT_DEFAULT ? "" : v)}
            />
            {kind !== "draft" && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Servicios externos</span>
                <CheckField
                  label={`Subir ${config.noun} a tu cuenta de Dropbox`}
                  hint={`Para subir ${config.noun} a tu cuenta de Dropbox es necesario que conectes tu cuenta.`}
                  checked={settings.uploadToDropbox}
                  disabled
                  onChange={() => {}}
                />
                <CheckField
                  label={`Subir ${config.noun} a tu cuenta de Google Drive`}
                  hint={`Para subir ${config.noun} a tu cuenta de Google Drive es necesario que conectes tu cuenta.`}
                  checked={settings.uploadToDrive}
                  disabled
                  onChange={() => {}}
                />
              </div>
            )}
          </Section>
        </div>

        {/* Mobile: actions at the end of the form */}
        {actions("lg:hidden")}
      </form>
    </TooltipProvider>
  );
}

/** Contact and address of the chosen client, as they will print on the document. */
function ClientSummary({ client }: { client: Client }) {
  const row = (label: string, value: string | undefined) => (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 min-w-0 break-words">{value || "—"}</dd>
    </div>
  );
  const city = [client.city, client.province].filter(Boolean).join(", ");
  return (
    <div className="grid gap-4 rounded-lg bg-muted p-4 text-sm sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <h3 className="m-0 text-sm font-semibold">General</h3>
        <dl className="m-0 flex flex-col gap-1">
          {row("Cliente", client.name)}
          {row("NIF", client.taxId)}
          {row("Email", client.email)}
          {row("Teléfono", client.phone)}
        </dl>
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="m-0 text-sm font-semibold">Dirección</h3>
        <dl className="m-0 flex flex-col gap-1">
          {row("Dirección", client.address)}
          {row("Población", city)}
          {row("Código postal", client.postalCode)}
          {row("País", client.country)}
        </dl>
      </div>
    </div>
  );
}

/** Public notes, with saved templates that can be picked, created or edited. */
function InvoiceNotes({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { noteTemplates } = useInvoiceSettings();
  const [templateId, setTemplateId] = useState("");
  const [editing, setEditing] = useState<{ title: string; text: string } | null>(null);
  const selected = noteTemplates.find((t) => t.id === templateId);

  const saveTemplate = () => {
    if (!editing?.title.trim()) return;
    const template = { id: selected?.id ?? crypto.randomUUID(), title: editing.title.trim(), text: editing.text };
    invoiceSettingsStore.update({
      noteTemplates: selected
        ? noteTemplates.map((t) => (t.id === selected.id ? template : t))
        : [...noteTemplates, template],
    });
    setTemplateId(template.id);
    onChange(template.text);
    setEditing(null);
  };

  return (
    <Field label={label} help="Se imprimen en el documento. Guarda las que repites como notas predefinidas.">
      {(p) => (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Select
              value={templateId}
              onValueChange={(id) => {
                setTemplateId(id);
                onChange(noteTemplates.find((t) => t.id === id)?.text ?? "");
              }}
            >
              <SelectTrigger className="min-w-0 flex-1 font-normal" aria-label="Nota predefinida">
                <span className="min-w-0 flex-1 truncate text-left">
                  <SelectValue placeholder="Selecciona una nota" />
                </span>
                <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
              </SelectTrigger>
              <SelectContent>
                {noteTemplates.length === 0 && (
                  <p className="m-0 px-3 py-2 text-sm text-muted-foreground">No hay notas guardadas.</p>
                )}
                {noteTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="secondary"
              size="lg"
              className="w-10 px-0"
              aria-label="Gestionar información de la nota"
              title="Gestionar información de la nota"
              onClick={() =>
                setEditing(editing ? null : { title: selected?.title ?? "", text: selected?.text ?? value })
              }
            >
              <Pencil strokeWidth={1.8} aria-hidden="true" />
            </Button>
          </div>
          {editing && (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <Input
                placeholder="Título"
                aria-label="Título de la nota"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
              <Textarea
                rows={2}
                placeholder="Descripción"
                aria-label="Descripción de la nota"
                value={editing.text}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                  Cancelar edición
                </Button>
                <Button size="sm" onClick={saveTemplate} disabled={!editing.title.trim()}>
                  {selected ? "Actualizar" : "Insertar"}
                </Button>
              </div>
            </div>
          )}
          <Textarea {...p} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      )}
    </Field>
  );
}

function TagsField({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const tag = draft.trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setDraft("");
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
            <Input {...p} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} />
            <Button
              variant="secondary"
              size="lg"
              className="w-10 px-0"
              aria-label="Añadir etiqueta"
              title="Añadir etiqueta"
              onClick={add}
            >
              <Plus strokeWidth={1.8} aria-hidden="true" />
            </Button>
          </div>
          {tags.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {tags.map((tag) => (
                <li
                  key={tag}
                  className="flex h-7 items-center gap-1 rounded-full bg-accent pr-1 pl-2.5 text-sm font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    aria-label={`Quitar etiqueta ${tag}`}
                    onClick={() => onChange(tags.filter((t) => t !== tag))}
                    className="flex size-5 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground hover:bg-muted-strong hover:text-foreground"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
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
  onChange: (id: string, changes: Partial<LineDraft>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onReorder: () => void;
}

function LinesEditor({
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
}: LinesEditorProps) {
  const head = "text-xs font-medium tracking-wide text-muted-foreground uppercase";
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
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {lines.map((line, i) => {
          const value = parsed[i] ?? null;
          const n = i + 1;
          const lineInvalid = invalid && !isBlank(line) && (!line.concept.trim() || value === null);
          return (
            <li
              key={line.id}
              className={cn(
                "flex animate-row-in flex-col gap-2.5 rounded-lg border border-border p-3 lg:rounded-none lg:border-0 lg:p-0",
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
                      onPick={(p) =>
                        onChange(line.id, {
                          concept: p.name,
                          unitPrice: formatDecimalInput(p.price),
                          vatRate: chargesVat ? p.vatRate : 0,
                        })
                      }
                    />
                    <Textarea
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
                        size="sm"
                        className="size-9 px-0"
                        aria-label={`Subir concepto ${n}`}
                        disabled={i === 0}
                        onClick={() => onMove(i, i - 1)}
                      >
                        <ArrowUp strokeWidth={1.8} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-9 px-0"
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
                        size="sm"
                        onClick={() => onRemove(line.id)}
                        aria-label={`Eliminar concepto ${n}`}
                        className="size-9 px-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 strokeWidth={1.8} aria-hidden="true" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Más opciones del concepto ${n}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "size-9 px-0")}
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
                        {value ? formatEUR(roundCents(lineBase(value) * line.surchargeRate)) : "—"}
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

function ProductPicker({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (product: (typeof products)[number]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label="Seleccionar producto"
        title="Seleccionar producto"
        className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-10 px-0")}
      >
        <Package strokeWidth={1.8} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-72">
        {products.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => onPick(p)} className="justify-between">
            <span className="truncate">{p.name}</span>
            <span className="amount text-sm text-muted-foreground">{formatEUR(p.price)}</span>
          </DropdownMenuItem>
        ))}
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
  const step = (delta: number) => onChange(formatDecimalInput(roundCents((parseDecimal(value) ?? 0) + delta)));
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

function Totals({
  totals,
  withholding,
  advanced,
  supplies,
  onSuppliesChange,
}: {
  totals: ReturnType<typeof invoiceTotals>;
  withholding: WithholdingKind;
  advanced: boolean;
  supplies: string;
  onSuppliesChange: (value: string) => void;
}) {
  const rate = WITHHOLDING_RATES[withholding];
  const card = "flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card p-4";
  const caption = "text-sm text-muted-foreground";
  const vatRates = totals.vatBreakdown.filter((v) => v.vat !== 0).map((v) => ratePercent(v.rate));
  return (
    <dl
      aria-label="Totales"
      className="m-0 grid animate-rise-in grid-cols-2 gap-3 sm:grid-cols-3 lg:flex"
      style={{ "--i": 3 } as CSSProperties}
    >
      <div className={cn(card, "lg:flex-1")}>
        <dt className={caption}>Subtotal</dt>
        <dd className="m-0 amount text-lg font-semibold">
          <AnimatedAmount value={totals.base} />
        </dd>
      </div>
      <div className={cn(card, "lg:flex-1")}>
        <dt className={caption}>
          IVA {vatRates.length > 0 && <span className="text-xs">({vatRates.join(", ")})</span>}
        </dt>
        <dd className="m-0 amount text-lg font-semibold">
          <AnimatedAmount value={totals.vat} />
        </dd>
      </div>
      {(advanced || totals.surcharge !== 0) && (
        <div className={cn(card, "lg:flex-1")}>
          <dt className={caption}>Recargo de equivalencia</dt>
          <dd className="m-0 amount text-lg font-semibold">
            <AnimatedAmount value={totals.surcharge} />
          </dd>
        </div>
      )}
      <div className={cn(card, "lg:flex-1")}>
        <dt className={caption}>Retención{rate > 0 && ` ${ratePercent(rate)}`}</dt>
        <dd className="m-0 amount text-lg font-semibold">
          <AnimatedAmount value={totals.withholding ? -totals.withholding : 0} />
        </dd>
      </div>
      {advanced && (
        <div className={cn(card, "lg:flex-1")}>
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
                className="h-8 pr-7 text-right amount font-semibold"
              />
              <span className="pointer-events-none absolute right-3 text-sm text-muted-foreground" aria-hidden="true">
                €
              </span>
            </span>
          </dd>
        </div>
      )}
      <div className={cn(card, "col-span-full border-transparent bg-muted sm:col-span-1 lg:flex-[1.3]")}>
        <dt className="text-sm font-semibold">Total</dt>
        <dd className="m-0 amount text-2xl font-semibold">
          <AnimatedAmount value={totals.total} />
        </dd>
      </div>
    </dl>
  );
}

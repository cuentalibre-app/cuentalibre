import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowLeft,
  ChevronDown,
  CircleHelp,
  EllipsisVertical,
  FilePen,
  Landmark,
  Mail,
  Pencil,
  Plus,
  Settings,
} from "lucide-react";
import {
  newId,
  WITHHOLDING_RATES,
  addDays,
  applyRate,
  cents,
  invoiceTotals,
  isSupportedDate,
  lineBase,
  operationChargesVat,
  toIsoDate,
  type InvoiceLine,
  type OperationType,
  type WithholdingKind,
} from "@fiscalia/core";
import type {
  Contact,
  IncomeType,
  InvoiceSeries,
  InvoiceSeriesDefinition,
  RentalLocation,
  SalesDocument,
  SalesKind,
} from "@fiscalia/contracts";
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
import { stockShortageMessage } from "@/features/catalog/catalog-store";
import { lockedMessage } from "@/features/closing/closing-model";
import { useLockedQuarter } from "@/features/closing/closing-store";
import { LockedNotice } from "@/features/closing/locked-notice";
import { isIntraEu } from "@/features/contacts/contacts-model";
import { contactsStore, useContacts } from "@/features/contacts/contacts-store";
import { NewContactDialog } from "@/features/contacts/new-contact-dialog";
import { formatDate, formatDecimalInput, formatEurosInput, parseEuros } from "@/lib/format";
import { defaultPaymentMethodId, paymentMethodOptions } from "@/features/settings/settings-model";
import { MethodDialog } from "@/features/settings/method-dialog";
import { settingsStore } from "@/features/settings/settings-store";
import {
  LinesEditor,
  TagsField,
  Totals,
  emptyLine,
  linesError,
  parseLine,
  toLineDraft,
  toLines,
  type LineDraft,
} from "./document-editor";
import { CLIENT_DEFAULT, CheckField, Field, GroupedSelect, LocaleFields, Section } from "./form-fields";
import { defaultNumberFormat } from "./invoice-locale";
import { documentSettingsStore, invoiceSettingsStore, useInvoiceSettings, useUploadDefaults } from "./invoice-settings";
import {
  INCOME_TYPE_GROUPS,
  KINDS,
  OPERATION_TYPES,
  RENTAL_LOCATIONS,
  WITHHOLDING_GROUPS,
  clientOf,
  groupLinesByTax,
  invoiceSeriesList,
  laterInvoice,
  nextNumber,
  periodKeyOf,
  seriesGroups,
  seriesRefOf,
  type SeriesRef,
} from "./sales-model";
import { SeriesDialog } from "./series-dialog";
import { canSendEmail } from "@/data/email";
import { SendDialog, sendWithMailClient } from "./document-dialogs";
import { IssuedNotice } from "./issued-notice";
import { salesStore } from "./sales-store";

const DUE_TERMS = [30, 60, 90] as const;
const SETTINGS_PATH = "/configuracion/facturas";
/** Value of the "Crear nueva serie" entry of the series select; series ids are UUIDs or the series types. */
const NEW_SERIES = "new";
/** Radix Select can't hold an empty value: this stands for "no client". */
const NO_CLIENT = "none";

interface FormState {
  clientId: string;
  number: string;
  series: InvoiceSeries;
  /** Custom series of an invoice; absent for the built-in one of `series`. */
  seriesId?: string;
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

type Errors = Partial<Record<"clientId" | "number" | "rectifiesId" | "issuedOn" | "lines" | "paymentMethodId", string>>;

/** What happens after saving, from the create button's menu. */
type AfterSave = "list" | "edit" | "send" | "receipt";

/** The form starts from an existing document (edit), a source to copy (duplicate, rectify, convert) or blank. */
function initialState(kind: SalesKind, base: SalesDocument | undefined, isCopy: boolean, rectify: boolean): FormState {
  const today = toIsoDate(new Date());
  const issuedOn = isCopy || !base ? today : base.issuedOn;
  // Only invoices have rectifying series; the other kinds have a single series of their own
  const series: InvoiceSeries = rectify ? "rectifying" : kind === "invoice" ? (base?.series ?? "normal") : "normal";
  const seriesId = !rectify && kind === "invoice" ? base?.seriesId : undefined;
  const dueOn = KINDS[kind].dueLabel === null ? null : isCopy || !base ? addDays(issuedOn, 30) : base.dueOn;
  // Invoicing a delivery note copies its lines or, if the settings say so, one line per tax rate
  const groupedOnInvoice =
    kind === "invoice" &&
    isCopy &&
    base?.kind === "deliveryNote" &&
    !documentSettingsStore.get("deliveryNote").keepLinesOnInvoice;
  const number =
    base && !isCopy && base.number ? base.number : nextNumber(kind, { series, seriesId }, issuedOn, salesStore.all());

  return {
    clientId: base?.clientId ?? "",
    number,
    series,
    seriesId,
    rectifiesId: rectify && base ? base.id : (base?.rectifiesId ?? ""),
    issuedOn,
    dueOn,
    incomeType: base?.incomeType ?? "705",
    withholding: base?.withholding ?? settingsStore.get().tax.defaultWithholding,
    operationType: base?.operationType ?? "national",
    operationOn: (!isCopy && base?.operationOn) || "",
    cashBasis: base?.cashBasis ?? false,
    rental: base?.rental ?? false,
    rentalLocation: base?.rentalLocation ?? "spain",
    cadastralRef: base?.cadastralRef ?? "",
    markPaid: !isCopy && base?.status === "paid",
    paidOn: (!isCopy && base?.payments?.at(-1)?.date) || issuedOn,
    paymentMethodId: base?.payments?.at(-1)?.paymentMethodId ?? defaultPaymentMethodId(),
    lines: (groupedOnInvoice ? groupLinesByTax(base!) : base?.lines)?.map((l) => toLineDraft(l, rectify)) ?? [
      emptyLine(settingsStore.get().tax.defaultVatRate),
    ],
    supplies: base?.supplies ? formatEurosInput(base.supplies) : "0",
    publicNotes: rectify && base?.number ? `Rectifica la factura ${base.number}.` : (base?.publicNotes ?? ""),
    privateNotes: isCopy ? "" : (base?.privateNotes ?? ""),
    tags: base?.tags ?? [],
    language: base?.language ?? "",
    numberFormat: base?.numberFormat ?? "",
  };
}

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
      presetClient={!existing && !source ? contactsStore.get("client", params.get("cliente") ?? "") : undefined}
    />
  );
}

interface SalesFormProps {
  kind: SalesKind;
  existing?: SalesDocument;
  source?: SalesDocument;
  rectify: boolean;
  /** From "Nueva factura" on a client's sheet. */
  presetClient?: Contact;
}

/** What a client's sheet proposes for their documents: withholding, collection method, intra-EU and discount. */
function withClientDefaults(form: FormState, client: Contact): FormState {
  const intraEu = isIntraEu(client);
  const operationType = intraEu ? "intraEu" : form.operationType === "intraEu" ? "national" : form.operationType;
  const vat = operationChargesVat(operationType);
  const discount = client.discount ? formatDecimalInput(client.discount) : null;
  return {
    ...form,
    clientId: client.id,
    withholding: intraEu ? "none" : (client.withholding ?? form.withholding),
    paymentMethodId: client.paymentMethodId ?? form.paymentMethodId,
    operationType,
    lines: form.lines.map((l) => ({
      ...l,
      ...(vat !== operationChargesVat(form.operationType) && { vatRate: vat ? 0.21 : 0, surchargeRate: 0 }),
      // Only lines still without a discount take the client's
      ...(discount && (l.discount === "0" || l.discount === "") && { discount }),
    })),
  };
}

function SalesForm({ kind, existing, source, rectify, presetClient }: SalesFormProps) {
  const navigate = useNavigate();
  const config = KINDS[kind];
  const uploads = useUploadDefaults(kind);
  const [form, setForm] = useState(() => {
    const initial = initialState(kind, existing ?? source, !existing, rectify);
    return presetClient ? withClientDefaults(initial, presetClient) : initial;
  });
  const clients = useContacts("client");
  const [creatingClient, setCreatingClient] = useState(false);
  const [creatingMethod, setCreatingMethod] = useState(false);
  const [creatingSeries, setCreatingSeries] = useState(false);
  const customSeries = useInvoiceSettings().series;
  /** The document just saved to be sent, and where to go after. */
  const [sending, setSending] = useState<{ doc: SalesDocument; next: string } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const lockedQuarterOf = useLockedQuarter();
  // Issued invoices are read-only: they are corrected with a rectifying invoice
  const issued = existing?.kind === "invoice";
  // Drafts, quotes and delivery notes are not booked, so only invoices belong to a closed quarter
  const locked = issued ? lockedQuarterOf(existing.issuedOn) : null;
  const [advanced, setAdvanced] = useState(
    () => form.lines.some((l) => l.surchargeRate || l.detail || l.serviceFrom || l.serviceTo) || form.supplies !== "0",
  );
  const [reordering, setReordering] = useState(false);
  // The collection date follows the invoice date until the user picks another one
  const [paidOnFollows, setPaidOnFollows] = useState(() => form.paidOn === form.issuedOn);
  const [dueTerm, setDueTerm] = useState<number | null | "custom">(() =>
    form.dueOn === null ? null : (DUE_TERMS.find((d) => addDays(form.issuedOn, d) === form.dueOn) ?? "custom"),
  );

  // Editing a field clears its error; the rest stay until the next submit
  const clearError = (key: keyof Errors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "clientId" || key === "number" || key === "rectifiesId" || key === "issuedOn" || key === "lines")
      clearError(key);
    if (key === "paymentMethodId" || key === "markPaid") clearError("paymentMethodId");
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
    parseEuros(form.supplies || "0") ?? cents(0),
  );

  const isInvoice = kind === "invoice";
  const rectifying = isInvoice && form.series === "rectifying";
  const client = clients.find((c) => c.id === form.clientId);
  // New lines take the client's default discount
  const lineDiscount = client?.discount ? formatDecimalInput(client.discount) : "0";

  const changeClient = (clientId: string) => {
    const picked = clients.find((c) => c.id === clientId);
    // An existing document keeps its terms; a new one takes the client's
    setForm((f) => (picked && !existing ? withClientDefaults(f, picked) : { ...f, clientId }));
    clearError("clientId");
  };
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
      paidOn: paidOnFollows && issuedOn ? issuedOn : f.paidOn,
    }));
  };

  const suggestedNumber = (series: SeriesRef) =>
    nextNumber(kind, series, form.issuedOn || toIsoDate(new Date()), salesStore.all());
  // The server numbers invoices when they are issued: a new one shows the number it will most likely get
  const invoiceNumber = (asKind: SalesKind) =>
    asKind === "invoice" && !issued
      ? nextNumber("invoice", form, form.issuedOn || toIsoDate(new Date()), salesStore.all())
      : null;

  const pickSeries = (series: InvoiceSeriesDefinition) => {
    const ref = seriesRefOf(series);
    setForm((f) => ({ ...f, ...ref, number: existing ? f.number : suggestedNumber(ref) }));
  };
  const changeSeries = (value: string) => {
    // "Crear nueva serie" opens its dialog in place, so nothing typed is lost
    if (value === NEW_SERIES) setCreatingSeries(true);
    else if (!isInvoice) set("series", value as InvoiceSeries);
    else pickSeries(invoiceSeriesList(customSeries).find((s) => s.id === value)!);
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

  /** Kind of the document this one is made from when it converts it (quote → invoice…), for the stock rules. */
  const originKind = (asKind: SalesKind) =>
    existing && existing.kind !== asKind ? existing.kind : source && source.kind !== asKind ? source.kind : undefined;

  function validate(asKind: SalesKind): Errors {
    const next: Errors = {};
    if (KINDS[asKind].clientRequired && !form.clientId) next.clientId = "Elige un cliente.";
    if (!form.issuedOn) next.issuedOn = "Indica la fecha.";
    else if (!isSupportedDate(form.issuedOn)) next.issuedOn = "Fecha no válida: revisa el año.";
    else if (asKind === "invoice" && lockedQuarterOf(form.issuedOn))
      next.issuedOn = lockedMessage(lockedQuarterOf(form.issuedOn)!);
    else if (asKind === "invoice") {
      const later = laterInvoice(form, form.issuedOn, salesStore.all());
      if (later)
        next.issuedOn = `La factura ${later.number} de esta serie es del ${formatDate(later.issuedOn)}: esta no puede tener una fecha anterior.`;
    }
    // Invoices take the next number of their series, so only the other kinds' own number is checked
    if (asKind === kind && asKind !== "invoice") {
      if (!form.number.trim()) next.number = "Indica el número.";
      else if (
        salesStore.all().some((d) => d.id !== existing?.id && d.kind === asKind && d.number === form.number.trim())
      )
        next.number = "Ya existe un documento con este número.";
    }
    if (rectifying && !existing && !form.rectifiesId) next.rectifiesId = "Elige la factura que rectifica.";
    if (asKind === "invoice" && form.markPaid && !form.paymentMethodId)
      next.paymentMethodId = "Elige el método por el que lo cobraste.";
    next.lines =
      linesError(form.lines) ??
      stockShortageMessage({ id: existing?.id ?? "", kind: asKind, lines: toLines(form.lines) }, originKind(asKind));
    return next;
  }

  function save(asKind: SalesKind, after: AfterSave = "list") {
    if (issued) return;
    const found = validate(asKind);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }

    const lines = toLines(form.lines);
    const asInvoice = asKind === "invoice";
    const paid = asInvoice && form.markPaid;
    const number =
      invoiceNumber(asKind) ??
      (asKind === kind ? form.number.trim() : nextNumber(asKind, form, form.issuedOn, salesStore.all()));
    const doc: SalesDocument = {
      id: existing?.id ?? newId(),
      kind: asKind,
      number,
      series: form.series,
      seriesId: form.seriesId,
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
      // Marked as collected when issued: one collection of the whole total
      payments: paid
        ? [
            {
              id: newId(),
              date: form.paidOn || form.issuedOn,
              amount: totals.total,
              paymentMethodId: form.paymentMethodId,
            },
          ]
        : undefined,
      publicNotes: form.publicNotes.trim(),
      privateNotes: form.privateNotes.trim(),
      tags: form.tags.length ? form.tags : undefined,
      language: form.language || undefined,
      numberFormat: form.numberFormat || undefined,
      attachments: existing?.attachments,
    };

    if (asInvoice) salesStore.issue(doc, { origin: originKind(asKind) });
    else if (existing) salesStore.update(existing.id, doc);
    else salesStore.add(doc, originKind(asKind));
    // Invoicing a quote or delivery note closes it
    if (source && (source.kind === "quote" || source.kind === "deliveryNote") && (asInvoice || asKind === "draft"))
      salesStore.update(source.id, { status: "invoiced" });

    if (after === "edit") {
      navigate(`${KINDS[asKind].path}/${doc.id}`);
      return;
    }
    const next = after === "receipt" ? "/bancos" : `${KINDS[asKind].path}?periodo=${periodKeyOf(doc.issuedOn)}`;
    if (after === "send" && canSendEmail()) {
      // Leave once the email is sent or the dialog closed
      setSending({ doc, next });
      return;
    }
    if (after === "send") sendWithMailClient(doc);
    navigate(next);
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

  const vatLabel = (line: InvoiceLine | null) => (line ? formatEUR(applyRate(lineBase(line), line.vatRate)) : "—");

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
            {!issued && (
              <Button variant="secondary" className="hidden sm:inline-flex" onClick={() => setCreatingClient(true)}>
                Nuevo cliente
              </Button>
            )}
            {!issued && actions("hidden lg:flex")}
          </div>
        </header>

        {locked ? <LockedNotice period={locked} noun="Esta factura" /> : issued && <IssuedNotice invoice={existing} />}
        {sending && <SendDialog doc={sending.doc} onOpenChange={(open) => !open && navigate(sending.next)} />}

        {source && !existing && (
          <p className="m-0 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">
            {rectify
              ? `Rectificando la factura ${source.number}. Las cantidades se han puesto en negativo.`
              : `Copiado de ${KINDS[source.kind].noun} ${source.number ?? "sin número"}. Revisa los datos antes de guardar.`}
          </p>
        )}

        <fieldset
          disabled={issued}
          className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0 lg:gap-6 disabled:[&_button:disabled]:opacity-60"
        >
          <Section title={infoTitle(config.noun)} index={1}>
            {client && <ClientSummary client={client} />}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field
                label="Cliente"
                required={config.clientRequired}
                error={errors.clientId}
                action={
                  <button
                    type="button"
                    onClick={() => setCreatingClient(true)}
                    className="cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Nuevo cliente
                  </button>
                }
              >
                {(fieldProps) => (
                  <Select
                    value={form.clientId}
                    // Radix fires "" when the options change (a client was just created); ignore it
                    onValueChange={(v) => v && changeClient(v === NO_CLIENT ? "" : v)}
                  >
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
                      {[...clients]
                        .sort((a, b) => a.name.localeCompare(b.name, "es"))
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} · <span className="font-mono text-sm">{c.taxId}</span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              {isInvoice ? (
                <Field
                  label="Número"
                  help={
                    issued
                      ? "Número que recibió al emitirse."
                      : "Se asigna al emitir la factura: el siguiente de la serie, en orden de fecha."
                  }
                >
                  {(p) => <Input {...p} readOnly value={invoiceNumber(kind) ?? form.number} className="font-mono" />}
                </Field>
              ) : (
                <Field
                  label="Número"
                  required
                  error={errors.number}
                  help="Número correlativo dentro de la serie. «Obtener número» propone el siguiente libre."
                  action={
                    <button
                      type="button"
                      onClick={() => set("number", suggestedNumber(form))}
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
              )}

              <Field label="Serie" required>
                {(p) => (
                  <GroupedSelect
                    {...p}
                    value={form.seriesId ?? form.series}
                    onChange={changeSeries}
                    groups={
                      isInvoice
                        ? [
                            ...seriesGroups(invoiceSeriesList(customSeries)),
                            { label: "Opciones", options: [{ value: NEW_SERIES, label: "Crear nueva serie" }] },
                          ]
                        : [{ options: [{ value: "normal", label: config.seriesLabel }] }]
                    }
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
                setLines((lines) =>
                  lines.length > 1
                    ? lines.filter((l) => l.id !== lineId)
                    : [emptyLine(settingsStore.get().tax.defaultVatRate, lineDiscount)],
                )
              }
              onDuplicate={(lineId) =>
                setLines((lines) => lines.flatMap((l) => (l.id === lineId ? [l, { ...l, id: newId() }] : [l])))
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
              onClick={() =>
                set("lines", [
                  ...form.lines,
                  emptyLine(chargesVat ? settingsStore.get().tax.defaultVatRate : 0, lineDiscount),
                ])
              }
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
                        <Input
                          {...p}
                          type="date"
                          value={form.paidOn}
                          onChange={(e) => {
                            set("paidOn", e.target.value);
                            setPaidOnFollows(false);
                          }}
                        />
                      )}
                    </Field>
                    <Field label="Método de cobro" required error={errors.paymentMethodId} className="w-56">
                      {(p) => (
                        <GroupedSelect
                          {...p}
                          value={form.paymentMethodId}
                          onChange={(v) => set("paymentMethodId", v)}
                          groups={[{ options: paymentMethodOptions(form.paymentMethodId) }]}
                        />
                      )}
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="text-primary"
                      onClick={() => setCreatingMethod(true)}
                    >
                      <Plus aria-hidden="true" />
                      Nuevo método
                    </Button>
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
                  checked={uploads.uploadToDropbox}
                  disabled
                  onChange={() => {}}
                />
                <CheckField
                  label={`Subir ${config.noun} a tu cuenta de Google Drive`}
                  hint={`Para subir ${config.noun} a tu cuenta de Google Drive es necesario que conectes tu cuenta.`}
                  checked={uploads.uploadToDrive}
                  disabled
                  onChange={() => {}}
                />
              </div>
            )}
          </Section>
        </fieldset>

        {/* Mobile: actions at the end of the form */}
        {!issued && actions("lg:hidden")}
        <NewContactDialog
          role="client"
          open={creatingClient}
          onOpenChange={setCreatingClient}
          onCreated={(c) => {
            setForm((f) => (existing ? { ...f, clientId: c.id } : withClientDefaults(f, c)));
            clearError("clientId");
          }}
        />
        {creatingSeries && (
          <SeriesDialog open onOpenChange={setCreatingSeries} type={form.series} onCreated={pickSeries} />
        )}
        {creatingMethod && (
          <MethodDialog
            open
            onOpenChange={setCreatingMethod}
            method={null}
            onCreated={(id) => set("paymentMethodId", id)}
          />
        )}
      </form>
    </TooltipProvider>
  );
}

/** Contact and address of the chosen client, as they will print on the document. */
function ClientSummary({ client }: { client: Contact }) {
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
    const template = { id: selected?.id ?? newId(), title: editing.title.trim(), text: editing.text };
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

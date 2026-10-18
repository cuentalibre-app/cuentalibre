import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowLeft,
  ChevronDown,
  CircleHelp,
  EllipsisVertical,
  FilePen,
  FilePlus2,
  Landmark,
  Plus,
  Trash2,
} from "lucide-react";
import {
  ASSET_CATEGORIES,
  WITHHOLDING_RATES,
  addDays,
  amortizableValue,
  amountOutstanding,
  applyRate,
  cents,
  deductibleAmounts,
  invoiceTotals,
  isBookedLate,
  isDuplicatePurchase,
  isValidBookingDate,
  lineBase,
  paymentStatus,
  purchaseCarriesVat,
  quarterOfMonth,
  sumCents,
  toIsoDate,
  type Cents,
  type PurchaseOperationType,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { lockedMessage } from "@/features/closing/closing-model";
import { useLockedQuarter } from "@/features/closing/closing-store";
import { LockedNotice } from "@/features/closing/locked-notice";
import { AnimatedAmount } from "@/components/animated-amount";
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
} from "@/features/sales/document-editor";
import { isIntraEu } from "@/features/contacts/contacts-model";
import { contactsStore, useContacts } from "@/features/contacts/contacts-store";
import { NewContactDialog } from "@/features/contacts/new-contact-dialog";
import { CheckField, Field, GroupedSelect, Section } from "@/features/sales/form-fields";
import { RENTAL_LOCATIONS, WITHHOLDING_GROUPS, periodKeyOf } from "@/features/sales/sales-model";
import { formatDate, formatDecimalInput, formatEurosInput, parseEuros, periodLabel } from "@/lib/format";
import { paymentMethodOptions } from "@/features/settings/settings-model";
import type { Contact } from "@/mocks/contacts";
import type { ExpenseType, PurchaseInvoice } from "@/mocks/purchases";
import type { Attachment, RentalLocation } from "@/mocks/sales";
import {
  ASSETS_PATH,
  EXPENSE_TYPE_GROUPS,
  NEW_ASSET_PATH,
  NEW_PURCHASE_PATH,
  PURCHASES_PATH,
  PURCHASE_OPERATION_TYPES,
  lastExpenseType,
  supplierOf,
} from "./purchases-model";
import { AssetSection, assetDraftError, toAsset, toAssetDraft, type AssetDraft } from "./asset-fields";
import { PercentInput, ReceiptDrop, parseImputation } from "./form-parts";
import { purchasesStore } from "./purchases-store";

const DUE_TERMS = [30, 60, 90] as const;
/** Default expense account, as in the reference app, when the supplier has no previous invoices. */
const DEFAULT_EXPENSE_TYPE: ExpenseType = "600";

/** The form registers received invoices and investment goods, which are received invoices that get amortized. */
export type PurchaseFormKind = "invoice" | "asset";

const FORM_KINDS = {
  invoice: {
    listPath: PURCHASES_PATH,
    newPath: NEW_PURCHASE_PATH,
    back: "Volver a facturas recibidas",
    newTitle: "Nueva factura recibida",
    editTitle: "Factura recibida",
    expenseTypes: [{ label: "Grupo 6: Compras y gastos", options: [] }, ...EXPENSE_TYPE_GROUPS],
    defaultExpenseType: DEFAULT_EXPENSE_TYPE,
  },
  asset: {
    listPath: ASSETS_PATH,
    newPath: NEW_ASSET_PATH,
    back: "Volver a bienes de inversión",
    newTitle: "Nuevo bien de inversión",
    editTitle: "Bien de inversión",
    // Investment goods are no expense: they go to the amortization accounts
    expenseTypes: EXPENSE_TYPE_GROUPS.filter((g) => g.label?.startsWith("68")),
    defaultExpenseType: "681" as ExpenseType,
  },
} satisfies Record<PurchaseFormKind, unknown>;

interface PaymentDraft {
  id: string;
  date: string;
  amount: string;
  paymentMethodId: string;
}

interface FormState {
  supplierId: string;
  number: string;
  issuedOn: string;
  bookedOn: string;
  dueOn: string | null;
  expenseType: ExpenseType;
  imputation: string;
  vatImputation: string;
  withholding: WithholdingKind;
  operationType: PurchaseOperationType;
  operationOn: string;
  customsDocument: string;
  cashBasis: boolean;
  rental: boolean;
  rentalLocation: RentalLocation;
  cadastralRef: string;
  rectifiesId: string;
  lines: LineDraft[];
  payments: PaymentDraft[];
  privateNotes: string;
  tags: string[];
  attachments: Attachment[];
  asset: AssetDraft;
}

type ErrorKey =
  | "supplierId"
  | "number"
  | "issuedOn"
  | "bookedOn"
  | "imputation"
  | "vatImputation"
  | "customsDocument"
  | "lines"
  | "payments"
  | "asset";
type Errors = Partial<Record<ErrorKey, string>>;

/** What happens after creating, from the create button's menu. */
type AfterSave = "list" | "edit" | "another";

/** The form starts from an existing invoice (edit), a source to copy (duplicate, credit note) or blank. */
/** What a supplier's sheet proposes for a first invoice: withholding, intra-EU and discount. */
function withSupplierDefaults(form: FormState, supplier: Contact): FormState {
  const intraEu = isIntraEu(supplier);
  const operationType = intraEu ? "intraEu" : form.operationType === "intraEu" ? "national" : form.operationType;
  const vat = purchaseCarriesVat(operationType);
  const discount = supplier.discount ? formatDecimalInput(supplier.discount) : null;
  return {
    ...form,
    withholding: supplier.withholding ?? form.withholding,
    operationType,
    lines: form.lines.map((l) => ({
      ...l,
      ...(vat !== purchaseCarriesVat(form.operationType) && { vatRate: vat ? 0.21 : 0, surchargeRate: 0 }),
      ...(discount && (l.discount === "0" || l.discount === "") && { discount }),
    })),
  };
}

/** A new invoice takes the terms of the supplier's last one or, without history, those on its sheet. */
function prefillFromSupplier(f: FormState, supplierId: string, kind: PurchaseFormKind): FormState {
  const sameKind = purchasesStore.all().filter((d) => Boolean(d.asset) === (kind === "asset"));
  const last = sameKind
    .filter((d) => d.supplierId === supplierId)
    .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))[0];
  if (!last) {
    const contact = contactsStore.get("supplier", supplierId);
    return contact ? withSupplierDefaults({ ...f, supplierId }, contact) : { ...f, supplierId };
  }
  const vat = purchaseCarriesVat(last.operationType);
  return {
    ...f,
    supplierId,
    expenseType: lastExpenseType(supplierId, sameKind) ?? f.expenseType,
    withholding: last.withholding,
    operationType: last.operationType,
    imputation: String(last.imputation),
    vatImputation: last.vatImputation == null ? "" : String(last.vatImputation),
    lines: vat ? f.lines : f.lines.map((l) => ({ ...l, vatRate: 0, surchargeRate: 0 })),
  };
}

function initialState(
  base: PurchaseInvoice | undefined,
  isCopy: boolean,
  creditNote: boolean,
  kind: PurchaseFormKind,
): FormState {
  const today = toIsoDate(new Date());
  const issuedOn = isCopy || !base ? today : base.issuedOn;
  return {
    supplierId: base?.supplierId ?? "",
    // The supplier gives the number: a copy or a credit note has its own
    number: isCopy ? "" : (base?.number ?? ""),
    issuedOn,
    bookedOn: isCopy || !base ? issuedOn : base.bookedOn,
    dueOn: isCopy ? null : (base?.dueOn ?? null),
    expenseType: base?.expenseType ?? FORM_KINDS[kind].defaultExpenseType,
    imputation: String(base?.imputation ?? 100),
    vatImputation: base?.vatImputation == null ? "" : String(base.vatImputation),
    withholding: base?.withholding ?? "none",
    operationType: base?.operationType ?? "national",
    operationOn: (!isCopy && base?.operationOn) || "",
    customsDocument: (!isCopy && base?.customsDocument) || "",
    cashBasis: base?.cashBasis ?? false,
    rental: base?.rental ?? false,
    rentalLocation: base?.rentalLocation ?? "spain",
    cadastralRef: base?.cadastralRef ?? "",
    rectifiesId: creditNote && base ? base.id : (base?.rectifiesId ?? ""),
    lines: base?.lines.map((l) => toLineDraft(l, creditNote)) ?? [emptyLine()],
    payments: isCopy ? [] : (base?.payments.map((p) => ({ ...p, amount: formatEurosInput(p.amount) })) ?? []),
    privateNotes: creditNote && base ? `Abono de la factura ${base.number}.` : isCopy ? "" : (base?.privateNotes ?? ""),
    tags: base?.tags ?? [],
    attachments: isCopy ? [] : (base?.attachments ?? []),
    asset: toAssetDraft(base?.asset),
  };
}

export function PurchaseFormPage({ kind = "invoice" }: { kind?: PurchaseFormKind }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const existing = id ? purchasesStore.get(id) : undefined;
  const copy = FORM_KINDS[kind];

  // An investment good opened from the invoices' path, or the other way round
  if (existing && Boolean(existing.asset) !== (kind === "asset")) {
    const other = existing.asset ? ASSETS_PATH : PURCHASES_PATH;
    return <Navigate to={`${other}/${existing.id}`} replace />;
  }

  if (id && !existing) {
    return (
      <div className="flex flex-col gap-3 px-5 pt-6 lg:px-8 lg:pt-6">
        <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">No encontrada</h1>
        <p className="m-0 text-muted-foreground">Esta factura no existe o se ha eliminado.</p>
        <Link to={copy.listPath} className="font-medium text-primary no-underline hover:text-primary-hover">
          {copy.back}
        </Link>
      </div>
    );
  }

  const source = !existing ? purchasesStore.get(params.get("desde") ?? "") : undefined;
  const creditNote = params.get("abono") === "1";
  const justSaved = !existing ? purchasesStore.get(params.get("registrada") ?? "") : undefined;
  return (
    <PurchaseForm
      // A new ?desde= or ?registrada= starts over
      key={`${kind}-${existing?.id ?? params.toString()}`}
      kind={kind}
      existing={existing}
      source={source}
      creditNote={creditNote}
      justSaved={justSaved}
      presetSupplierId={!existing && !source ? params.get("proveedor") : null}
    />
  );
}

function PurchaseForm({
  kind,
  existing,
  source,
  creditNote,
  justSaved,
  presetSupplierId,
}: {
  kind: PurchaseFormKind;
  existing?: PurchaseInvoice;
  source?: PurchaseInvoice;
  creditNote: boolean;
  /** From "Nueva factura recibida" on a supplier's sheet. */
  presetSupplierId: string | null;
  /** The invoice registered right before, with "Registrar y añadir otra". */
  justSaved?: PurchaseInvoice;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const copy = FORM_KINDS[kind];
  const isAssetForm = kind === "asset";
  const [form, setForm] = useState(() => {
    const initial = initialState(existing ?? source, !existing, creditNote, kind);
    return presetSupplierId && contactsStore.get("supplier", presetSupplierId)
      ? prefillFromSupplier(initial, presetSupplierId, kind)
      : initial;
  });
  const [errors, setErrors] = useState<Errors>({});
  const lockedQuarterOf = useLockedQuarter();
  // The booking date decides the quarter, so it's the one a closed quarter locks
  const locked = existing ? lockedQuarterOf(existing.bookedOn) : null;
  const [advanced, setAdvanced] = useState(() =>
    form.lines.some((l) => l.surchargeRate || l.detail || l.serviceFrom || l.serviceTo),
  );
  const [reordering, setReordering] = useState(false);
  const [dueTerm, setDueTerm] = useState<number | null | "custom">(() =>
    form.dueOn === null ? null : (DUE_TERMS.find((d) => addDays(form.issuedOn, d) === form.dueOn) ?? "custom"),
  );
  // Whether the booking date follows the issue date, until it is changed by hand
  const [bookedFollows, setBookedFollows] = useState(form.bookedOn === form.issuedOn);
  // Prefill from the supplier's last invoice only on a blank form, until the user picks a type
  const [prefill, setPrefill] = useState(!existing && !source);

  // "Gestionar los pagos" links straight to the payments section
  const paymentsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (location.hash === "#pagos") paymentsRef.current?.scrollIntoView({ block: "start" });
  }, [location.hash]);

  const clearError = (key: ErrorKey) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in ERROR_KEYS) clearError(key as ErrorKey);
  };
  const setLines = (update: (lines: LineDraft[]) => LineDraft[]) => {
    setForm((f) => ({ ...f, lines: update(f.lines) }));
    clearError("lines");
  };
  const setLine = (lineId: string, changes: Partial<LineDraft>) =>
    setLines((lines) => lines.map((l) => (l.id === lineId ? { ...l, ...changes } : l)));
  const setPayments = (update: (payments: PaymentDraft[]) => PaymentDraft[]) => {
    setForm((f) => ({ ...f, payments: update(f.payments) }));
    clearError("payments");
  };

  const carriesVat = purchaseCarriesVat(form.operationType);
  const parsedLines = form.lines.map(parseLine);
  const totals = invoiceTotals(
    parsedLines.filter((l) => l !== null),
    WITHHOLDING_RATES[form.withholding],
  );
  const imputation = parseImputation(form.imputation);
  const vatImputation = form.vatImputation.trim() === "" ? null : parseImputation(form.vatImputation);
  const deductible = deductibleAmounts(totals, imputation ?? 0, vatImputation);
  const paymentAmounts = form.payments.map((p) => parseEuros(p.amount) ?? cents(0));
  const pending = amountOutstanding(totals.total, paymentAmounts);
  const assetError = isAssetForm ? assetDraftError(form.asset) : undefined;
  const amortized =
    isAssetForm && !assetError && imputation !== null && form.issuedOn
      ? {
          value: amortizableValue(totals.base, totals.vat, imputation, vatImputation),
          startsOn: form.operationOn || form.issuedOn,
          plan: toAsset(form.asset),
        }
      : null;

  const suppliers = useContacts("supplier");
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const supplier = suppliers.find((s) => s.id === form.supplierId);
  // New lines take the supplier's default discount
  const lineDiscount = supplier?.discount ? formatDecimalInput(supplier.discount) : "0";
  const isCreditNote = Boolean(form.rectifiesId) || (creditNote && !existing);
  const creditable = purchasesStore
    .all()
    .filter(
      (d) =>
        d.id !== existing?.id &&
        Boolean(d.asset) === isAssetForm &&
        (!form.supplierId || d.supplierId === form.supplierId) &&
        !d.rectifiesId,
    );
  const title = existing
    ? `${copy.editTitle} ${existing.number}`
    : isCreditNote
      ? "Nuevo abono de proveedor"
      : copy.newTitle;

  const changeSupplier = (supplierId: string) => {
    setForm((f) => (prefill ? prefillFromSupplier(f, supplierId, kind) : { ...f, supplierId }));
    clearError("supplierId");
    clearError("number");
  };

  const changeIssuedOn = (issuedOn: string) => {
    setForm((f) => ({
      ...f,
      issuedOn,
      bookedOn: bookedFollows ? issuedOn : f.bookedOn,
      dueOn: typeof dueTerm === "number" && issuedOn ? addDays(issuedOn, dueTerm) : f.dueOn,
    }));
    clearError("issuedOn");
    clearError("bookedOn");
  };

  const changeOperationType = (operationType: PurchaseOperationType) => {
    const vat = purchaseCarriesVat(operationType);
    setForm((f) => ({
      ...f,
      operationType,
      // Invoices without VAT go at 0%; going back to one with VAT restores the general rate
      lines:
        vat === purchaseCarriesVat(f.operationType)
          ? f.lines
          : f.lines.map((l) => ({ ...l, vatRate: vat ? 0.21 : 0, surchargeRate: 0 })),
    }));
    clearError("customsDocument");
  };

  function validate(): Errors {
    const next: Errors = {};
    if (!form.supplierId) next.supplierId = "Elige el proveedor.";
    if (!form.number.trim()) next.number = "Indica el número que figura en la factura.";
    else if (
      form.supplierId &&
      form.issuedOn &&
      isDuplicatePurchase(
        { id: existing?.id, supplierId: form.supplierId, number: form.number, issuedOn: form.issuedOn },
        purchasesStore.all(),
      )
    )
      next.number = "Ya has registrado una factura de este proveedor con este número este año.";
    if (!form.issuedOn) next.issuedOn = "Indica la fecha de la factura.";
    if (!form.bookedOn) next.bookedOn = "Indica la fecha contable.";
    else if (form.issuedOn && !isValidBookingDate(form.issuedOn, form.bookedOn))
      next.bookedOn = "No puede ser anterior a la fecha de la factura.";
    else if (lockedQuarterOf(form.bookedOn)) next.bookedOn = lockedMessage(lockedQuarterOf(form.bookedOn)!);
    if (imputation === null) next.imputation = "Un número entero entre 0 y 100.";
    if (form.vatImputation.trim() !== "" && vatImputation === null)
      next.vatImputation = "Un número entero entre 0 y 100, o vacío.";
    if (form.operationType === "import" && totals.vat !== 0 && !form.customsDocument.trim())
      next.customsDocument = "Las importaciones con IVA necesitan el número del DUA o H7.";
    next.lines = linesError(form.lines);
    if (isAssetForm) next.asset = assetError;
    if (form.payments.some((p) => !p.date || parseEuros(p.amount) === null || parseEuros(p.amount) === 0))
      next.payments = "Cada pago necesita fecha e importe.";
    else if (Math.abs(sumCents(paymentAmounts)) > Math.abs(totals.total))
      next.payments = `Los pagos suman más que el total de la factura (${formatEUR(totals.total)}).`;
    return next;
  }

  function save(after: AfterSave = "list") {
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }

    const doc: PurchaseInvoice = {
      id: existing?.id ?? crypto.randomUUID(),
      supplierId: form.supplierId,
      number: form.number.trim(),
      issuedOn: form.issuedOn,
      bookedOn: form.bookedOn,
      dueOn: form.dueOn,
      expenseType: form.expenseType,
      imputation: imputation!,
      vatImputation,
      withholding: form.withholding,
      operationType: form.operationType,
      operationOn: form.operationOn || null,
      customsDocument: form.operationType === "import" ? form.customsDocument.trim() || undefined : undefined,
      cashBasis: form.cashBasis,
      rental: form.rental,
      rentalLocation: form.rental ? form.rentalLocation : undefined,
      cadastralRef: form.rental ? form.cadastralRef.trim() || undefined : undefined,
      rectifiesId: form.rectifiesId || undefined,
      lines: toLines(form.lines),
      payments: form.payments.map((p) => ({
        id: p.id,
        date: p.date,
        amount: parseEuros(p.amount)!,
        paymentMethodId: p.paymentMethodId,
      })),
      privateNotes: form.privateNotes.trim(),
      tags: form.tags.length ? form.tags : undefined,
      attachments: form.attachments.length ? form.attachments : undefined,
      asset: isAssetForm ? toAsset(form.asset) : undefined,
    };

    if (existing) purchasesStore.update(existing.id, doc);
    else purchasesStore.add(doc);

    if (after === "edit") navigate(`${copy.listPath}/${doc.id}`);
    else if (after === "another") {
      navigate(`${copy.newPath}?registrada=${doc.id}`);
      window.scrollTo({ top: 0 });
    } else navigate(`${copy.listPath}?periodo=${periodKeyOf(doc.bookedOn)}`);
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save();
  };

  const actions = (className?: string) => (
    <div className={cn("flex gap-2.5", className)}>
      {!existing ? (
        <div className="flex flex-1 lg:flex-none">
          <Button type="submit" className="flex-1 rounded-r-none lg:flex-none">
            {isCreditNote ? "Registrar abono" : isAssetForm ? "Registrar bien" : "Registrar factura"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Más formas de registrar"
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-l-none border-l border-primary-foreground/25 px-2.5",
              )}
            >
              <ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => save("edit")}>
                <FilePen aria-hidden="true" />
                Registrar e ir a la pantalla de editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => save("another")}>
                <FilePlus2 aria-hidden="true" />
                {isAssetForm ? "Registrar y añadir otro" : "Registrar y añadir otra"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <Button type="submit" className="flex-1 lg:flex-none">
          Guardar cambios
        </Button>
      )}
    </div>
  );

  const vatLabel = (line: ReturnType<typeof parseLine>) =>
    line ? formatEUR(applyRate(lineBase(line), line.vatRate)) : "—";

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5 px-5 pt-6 lg:gap-4 lg:px-8 lg:pt-6 lg:pb-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={copy.listPath}
              aria-label={copy.back}
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
                <DropdownMenuItem onSelect={() => navigate("/ayuda")}>
                  <CircleHelp aria-hidden="true" />
                  Ayuda
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {!locked && (
              <Button variant="secondary" className="hidden sm:inline-flex" onClick={() => setCreatingSupplier(true)}>
                Nuevo proveedor
              </Button>
            )}
            {!locked && actions("hidden lg:flex")}
          </div>
        </header>

        {locked && <LockedNotice period={locked} noun="Esta factura" />}

        {justSaved && !source && (
          <p role="status" className="m-0 rounded-lg bg-success-soft px-4 py-3 text-sm text-success">
            {isAssetForm ? "Bien de inversión" : "Factura"} {justSaved.number} de {supplierOf(justSaved).name}{" "}
            {isAssetForm ? "registrado" : "registrada"}. Ya puedes añadir{" "}
            {isAssetForm ? "el siguiente" : "la siguiente"}.
          </p>
        )}

        {source && !existing && (
          <p className="m-0 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">
            {creditNote
              ? `Abono de la factura ${source.number}. Las cantidades se han puesto en negativo; añade el número del abono que te ha enviado el proveedor.`
              : `Copiado de la factura ${source.number}. Añade el número de la nueva factura y revisa los datos.`}
          </p>
        )}

        <fieldset
          disabled={Boolean(locked)}
          className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0 lg:gap-6 disabled:[&_button:disabled]:opacity-60"
        >
          <ReceiptDrop attachments={form.attachments} onChange={(a) => set("attachments", a)} />

          <Section title="Información de la factura" index={1}>
            {supplier && <SupplierSummary supplier={supplier} />}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field
                label="Proveedor"
                required
                error={errors.supplierId}
                action={
                  <button
                    type="button"
                    onClick={() => setCreatingSupplier(true)}
                    className="cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Nuevo proveedor
                  </button>
                }
              >
                {(p) => (
                  <Select
                    value={form.supplierId}
                    // Radix fires "" when the options change (a supplier was just created); ignore it
                    onValueChange={(v) => v && changeSupplier(v)}
                  >
                    <SelectTrigger {...p} className="w-full font-normal aria-invalid:border-destructive">
                      <span className="min-w-0 flex-1 truncate text-left">
                        <SelectValue placeholder="Selecciona el proveedor" />
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...suppliers]
                        .sort((a, b) => a.name.localeCompare(b.name, "es"))
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} · <span className="font-mono text-sm">{s.taxId}</span>
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
                help="El número que figura en la factura del proveedor."
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

              {isCreditNote && (
                <Field label="Abona la factura" help="La factura del proveedor que este abono corrige.">
                  {(p) => (
                    <GroupedSelect
                      {...p}
                      value={form.rectifiesId || "none"}
                      onChange={(v) => set("rectifiesId", v === "none" ? "" : v)}
                      groups={[
                        {
                          options: [
                            { value: "none", label: "Sin factura asociada" },
                            ...creditable.map((d) => ({
                              value: d.id,
                              label: `${d.number} · ${supplierOf(d).name} · ${formatDate(d.issuedOn)}`,
                            })),
                          ],
                        },
                      ]}
                    />
                  )}
                </Field>
              )}

              <Field label="Fecha de la factura" required error={errors.issuedOn}>
                {(p) => (
                  <Input {...p} type="date" value={form.issuedOn} onChange={(e) => changeIssuedOn(e.target.value)} />
                )}
              </Field>

              <Field
                label="Fecha contable"
                required
                error={errors.bookedOn}
                help="Decide el trimestre en el que se deduce. Si una factura te llega tarde, puedes contabilizarla en un trimestre posterior."
                hint={
                  form.issuedOn && form.bookedOn && !errors.bookedOn && isBookedLate(form.issuedOn, form.bookedOn)
                    ? `Se contabiliza en el ${quarterName(form.bookedOn)}, no en el de la factura.`
                    : undefined
                }
              >
                {(p) => (
                  <Input
                    {...p}
                    type="date"
                    min={form.issuedOn || undefined}
                    value={form.bookedOn}
                    onChange={(e) => {
                      setBookedFollows(e.target.value === form.issuedOn);
                      set("bookedOn", e.target.value);
                    }}
                  />
                )}
              </Field>

              <Field
                label="Vencimiento"
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
                          className="h-7 cursor-pointer rounded-sm border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary"
                        >
                          {term === null ? "Sin fecha" : `${term} días`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Field>

              <Field
                label="Tipo de gasto"
                help="Cuenta del Plan General Contable (grupo 6) en la que se registra el gasto."
                hint={
                  isAssetForm
                    ? "Se propone según el tipo de bien de la amortización."
                    : prefill && lastExpenseType(form.supplierId, purchasesStore.all())
                      ? "Según la última factura de este proveedor."
                      : undefined
                }
              >
                {(p) => (
                  <GroupedSelect
                    {...p}
                    value={form.expenseType}
                    onChange={(v) => {
                      set("expenseType", v as ExpenseType);
                      setPrefill(false);
                    }}
                    groups={copy.expenseTypes}
                  />
                )}
              </Field>

              <Field
                label="Imputación"
                error={errors.imputation}
                help="Parte de la factura que cuenta como gasto deducible. Por ejemplo, si trabajas en casa y dedicas el 20 % de la vivienda a la actividad, de la luz puedes deducir el 30 % de ese 20 %: un 6 %."
              >
                {(p) => <PercentInput {...p} value={form.imputation} onChange={(v) => set("imputation", v)} />}
              </Field>

              <Field
                label="Retención"
                help="IRPF que retienes al proveedor (un profesional, un alquiler…) e ingresas tú a Hacienda con el modelo 111 o 115."
              >
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
            {!carriesVat && (
              <p className="m-0 text-sm text-muted-foreground">
                Con el tipo de operación «{PURCHASE_OPERATION_TYPES.find((o) => o.value === form.operationType)?.label}»
                el proveedor factura sin IVA. Cámbialo en Opciones avanzadas.
              </p>
            )}
            <LinesEditor
              pricing="cost"
              lines={form.lines}
              parsed={parsedLines}
              chargesVat={carriesVat}
              advanced={advanced}
              reordering={reordering}
              invalid={Boolean(errors.lines)}
              vatLabel={vatLabel}
              onChange={setLine}
              onRemove={(lineId) =>
                setLines((lines) =>
                  lines.length > 1 ? lines.filter((l) => l.id !== lineId) : [emptyLine(undefined, lineDiscount)],
                )
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
              onClick={() => set("lines", [...form.lines, emptyLine(carriesVat ? 0.21 : 0, lineDiscount)])}
            >
              <Plus strokeWidth={2} aria-hidden="true" />
              Añadir otro concepto
            </Button>
          </Section>

          <Totals totals={totals} withholding={form.withholding} advanced={advanced} />

          <DeductibleStrip
            base={isAssetForm ? (amortized?.value ?? cents(0)) : deductible.base}
            baseLabel={isAssetForm ? "Valor amortizable" : "Gasto"}
            vat={deductible.vat}
            imputation={imputation}
            vatImputation={vatImputation}
            invalid={imputation === null}
          />

          {isAssetForm && (
            <Section title="Información sobre la amortización" index={4}>
              <AssetSection
                draft={form.asset}
                error={errors.asset}
                asset={amortized}
                onChange={(asset) => {
                  // The kind of good decides the amortization account
                  const account = asset.category ? ASSET_CATEGORIES[asset.category].account : null;
                  setForm((f) => ({
                    ...f,
                    asset,
                    expenseType: account && asset.category !== f.asset.category ? account : f.expenseType,
                  }));
                  clearError("asset");
                }}
              />
            </Section>
          )}

          <div ref={paymentsRef} id="pagos" className="scroll-mt-4">
            <Section title="Pagos" index={4}>
              <Payments
                payments={form.payments}
                total={totals.total}
                pending={pending}
                status={paymentStatus(totals.total, paymentAmounts)}
                error={errors.payments}
                issuedOn={form.issuedOn}
                onChange={setPayments}
              />
            </Section>
          </div>

          <Section title="Notas" index={5}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Notas privadas" help="Solo las ves tú.">
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

          <Section title="Opciones avanzadas" index={6} defaultOpen={hasAdvancedOptions(form)}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Fecha de operación" hint="Solo si es distinta de la fecha de la factura.">
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
                  <Select
                    value={form.operationType}
                    onValueChange={(v) => changeOperationType(v as PurchaseOperationType)}
                  >
                    <SelectTrigger {...p} className="w-full font-normal">
                      <span className="min-w-0 flex-1 truncate text-left">
                        <SelectValue>
                          {PURCHASE_OPERATION_TYPES.find((o) => o.value === form.operationType)?.label}
                        </SelectValue>
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[min(36rem,calc(100vw-2rem))]">
                      {PURCHASE_OPERATION_TYPES.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="h-auto min-h-9 py-2">
                          {o.label}
                          <span className="block text-sm font-normal text-muted-foreground">{o.hint}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <Field
                label="Imputación a IVA"
                error={errors.vatImputation}
                hint="Vacío: la misma que la imputación."
                help="Parte del IVA que se deduce en los modelos de IVA, si es distinta de la del gasto. Por ejemplo, un coche: 0 % como gasto (se amortiza) y 50 % del IVA."
              >
                {(p) => (
                  <PercentInput
                    {...p}
                    value={form.vatImputation}
                    placeholder={form.imputation}
                    onChange={(v) => set("vatImputation", v)}
                  />
                )}
              </Field>
              {form.operationType === "import" && (
                <Field
                  label="Número DUA/H7"
                  required={totals.vat !== 0}
                  error={errors.customsDocument}
                  help="Documento de aduanas de la importación: DUA para bienes de más de 150 €, H7 para los de menos."
                >
                  {(p) => (
                    <Input
                      {...p}
                      value={form.customsDocument}
                      onChange={(e) => set("customsDocument", e.target.value)}
                      className="font-mono"
                    />
                  )}
                </Field>
              )}
            </div>
            <div className="flex flex-col gap-4">
              <CheckField
                label="Proveedor acogido al régimen de criterio de caja"
                help="El proveedor no ingresa el IVA hasta cobrarlo, y tú no puedes deducirlo hasta pagarlo."
                checked={form.cashBasis}
                onChange={(v) => set("cashBasis", v)}
              />
              <CheckField
                label="Operación de arrendamiento de inmuebles"
                help="Alquiler de un local u oficina. Se informa en los modelos 115, 180 y 347 con su situación y referencia catastral."
                checked={form.rental}
                onChange={(v) => {
                  set("rental", v);
                  // Rentals of premises carry the 19 % withholding
                  if (v && form.withholding === "none") set("withholding", "rental");
                }}
              />
              {form.rental && (
                <div className="grid gap-4 pl-7.5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <Field label="Situación">
                    {(p) => (
                      <GroupedSelect
                        {...p}
                        value={form.rentalLocation}
                        onChange={(v) => set("rentalLocation", v as RentalLocation)}
                        groups={[{ options: RENTAL_LOCATIONS }]}
                      />
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
            </div>
          </Section>
        </fieldset>

        {/* Mobile: actions at the end of the form */}
        {!locked && actions("lg:hidden")}
        <NewContactDialog
          role="supplier"
          open={creatingSupplier}
          onOpenChange={setCreatingSupplier}
          onCreated={(c) => {
            setForm((f) =>
              existing ? { ...f, supplierId: c.id } : withSupplierDefaults({ ...f, supplierId: c.id }, c),
            );
            clearError("supplierId");
          }}
        />
      </form>
    </TooltipProvider>
  );
}

const ERROR_KEYS: Record<ErrorKey, true> = {
  supplierId: true,
  number: true,
  issuedOn: true,
  bookedOn: true,
  imputation: true,
  vatImputation: true,
  customsDocument: true,
  lines: true,
  payments: true,
  asset: true,
};

function hasAdvancedOptions(form: FormState): boolean {
  return (
    form.operationType !== "national" ||
    form.vatImputation !== "" ||
    form.operationOn !== "" ||
    form.cashBasis ||
    form.rental
  );
}

/** "4.º trimestre 2026" */
function quarterName(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return periodLabel({ year: year!, quarter: quarterOfMonth(month! - 1) });
}

/** What the invoice lowers in the tax returns, after imputation. */
function DeductibleStrip({
  base,
  baseLabel,
  vat,
  imputation,
  vatImputation,
  invalid,
}: {
  base: Cents;
  baseLabel: string;
  vat: Cents;
  imputation: number | null;
  vatImputation: number | null;
  invalid: boolean;
}) {
  const vatShare = vatImputation ?? imputation;
  return (
    <div
      className="flex animate-rise-in flex-wrap items-center gap-x-6 gap-y-1 rounded-xl bg-muted px-4 py-3 text-sm"
      style={{ "--i": 3 } as CSSProperties}
    >
      <span className="font-semibold">Deducible</span>
      {invalid ? (
        <span className="text-muted-foreground">Revisa la imputación para calcularlo.</span>
      ) : (
        <>
          <span>
            <span className="text-muted-foreground">
              {baseLabel} ({imputation} %){" "}
            </span>
            <AnimatedAmount value={base} className="amount font-semibold" />
          </span>
          <span>
            <span className="text-muted-foreground">IVA soportado ({vatShare} %) </span>
            <AnimatedAmount value={vat} className="amount font-semibold" />
          </span>
        </>
      )}
    </div>
  );
}

/** Contact and address of the chosen supplier, as on its invoice. */
function SupplierSummary({ supplier }: { supplier: Contact }) {
  const row = (label: string, value: string | undefined) => (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 min-w-0 break-words">{value || "—"}</dd>
    </div>
  );
  const province = supplier.province !== supplier.city ? supplier.province : undefined;
  const city = [[supplier.postalCode, supplier.city].filter(Boolean).join(" "), province].filter(Boolean).join(", ");
  return (
    <div className="grid gap-4 rounded-lg bg-muted p-4 text-sm sm:grid-cols-2">
      <dl className="m-0 flex flex-col gap-1">
        {row("Proveedor", supplier.name)}
        {row("NIF", supplier.taxId)}
        {row("Email", supplier.email)}
      </dl>
      <dl className="m-0 flex flex-col gap-1">
        {row("Dirección", supplier.address)}
        {row("Población", city)}
        {row("País", supplier.country)}
      </dl>
    </div>
  );
}

/** Payments made to the supplier: one for the whole amount, or several partial ones. */
function Payments({
  payments,
  total,
  pending,
  status,
  error,
  issuedOn,
  onChange,
}: {
  payments: PaymentDraft[];
  total: Cents;
  pending: Cents;
  status: ReturnType<typeof paymentStatus>;
  error?: string;
  issuedOn: string;
  onChange: (update: (payments: PaymentDraft[]) => PaymentDraft[]) => void;
}) {
  const update = (id: string, changes: Partial<PaymentDraft>) =>
    onChange((list) => list.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  const addPayment = () =>
    onChange((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        // Today, unless the invoice is dated later
        date: [toIsoDate(new Date()), issuedOn].sort().at(-1)!,
        amount: formatEurosInput(pending),
        paymentMethodId: list.at(-1)?.paymentMethodId ?? "bank1",
      },
    ]);
  const summary =
    status === "paid"
      ? "Pagada por completo."
      : status === "partial"
        ? `Pago parcial: quedan ${formatEUR(pending)} de ${formatEUR(total)}.`
        : total === 0
          ? "Añade los conceptos para registrar el pago."
          : `Pendiente de pago: ${formatEUR(pending)}.`;
  return (
    <div className="flex flex-col gap-3">
      <p className={cn("m-0 text-sm", status === "paid" ? "text-success" : "text-muted-foreground")}>{summary}</p>
      {payments.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {payments.map((p, i) => (
            <li
              key={p.id}
              className="grid grid-cols-2 items-end gap-2 rounded-lg border border-border p-3 sm:grid-cols-[10rem_9rem_minmax(0,14rem)_auto] sm:border-0 sm:p-0"
            >
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Fecha de pago</span>
                <Input
                  type="date"
                  value={p.date}
                  aria-invalid={error && !p.date ? true : undefined}
                  onChange={(e) => update(p.id, { date: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Importe</span>
                <span className="relative flex items-center">
                  <Input
                    inputMode="decimal"
                    value={p.amount}
                    aria-invalid={error && !parseEuros(p.amount) ? true : undefined}
                    onChange={(e) => update(p.id, { amount: e.target.value })}
                    className="pr-7 text-right amount"
                  />
                  <span
                    className="pointer-events-none absolute right-3 text-sm text-muted-foreground"
                    aria-hidden="true"
                  >
                    €
                  </span>
                </span>
              </label>
              <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                <span className="text-xs font-medium text-muted-foreground" id={`${p.id}-method`}>
                  Método de pago
                </span>
                <GroupedSelect
                  id={`${p.id}-method-select`}
                  aria-labelledby={`${p.id}-method`}
                  value={p.paymentMethodId}
                  onChange={(v) => update(p.id, { paymentMethodId: v })}
                  groups={[{ options: paymentMethodOptions(p.paymentMethodId) }]}
                />
              </label>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Quitar pago ${i + 1}`}
                onClick={() => onChange((list) => list.filter((x) => x.id !== p.id))}
                className="col-span-2 size-10 justify-self-end px-0 text-muted-foreground hover:text-destructive sm:col-span-1"
              >
                <Trash2 strokeWidth={1.8} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="md" onClick={addPayment} disabled={status === "paid" || total === 0}>
          <Plus strokeWidth={2} aria-hidden="true" />
          {payments.length === 0 ? "Marcar como pagada" : "Registrar otro pago"}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="md" aria-disabled className="cursor-not-allowed opacity-50">
              <Landmark strokeWidth={1.8} aria-hidden="true" />
              Elegir movimiento bancario
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            Disponible cuando conectes tus cuentas bancarias: podrás enlazar el pago con un movimiento.
          </TooltipContent>
        </Tooltip>
        <Link
          to="/configuracion/metodos-de-pago"
          className="ml-auto text-sm font-medium text-primary no-underline hover:text-primary-hover"
        >
          Gestionar métodos de pago
        </Link>
      </div>
      {payments.length === 0 && total !== 0 && (
        <p className="m-0 text-xs text-muted-foreground">
          «Marcar como pagada» añade un pago por {formatEUR(pending)}; cambia el importe si solo has pagado una parte.
        </p>
      )}
    </div>
  );
}

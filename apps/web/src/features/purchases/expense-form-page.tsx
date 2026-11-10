import { useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ChevronDown, FilePen, FilePlus2, Landmark, Plus } from "lucide-react";
import {
  cents,
  deductibleExpense,
  isDuplicateExpense,
  isSupportedDate,
  newId,
  toIsoDate,
  type Cents,
} from "@cuentalibre/core";
import type { Attachment, Expense, ExpenseType, OtherPayee, RentalLocation } from "@cuentalibre/contracts";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@cuentalibre/ui/components/dropdown-menu";
import { Input, Textarea } from "@cuentalibre/ui/components/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { useDiscardOnLeave } from "@/data/files";
import { lockedMessage } from "@/features/closing/closing-model";
import { useLockedQuarter } from "@/features/closing/closing-store";
import { LockedNotice } from "@/features/closing/locked-notice";
import { AnimatedAmount } from "@/components/animated-amount";
import { BackLink, Notice, Page, PageHeader } from "@/components/page";
import { contactsStore, useContacts } from "@/features/contacts/contacts-store";
import { NewContactDialog } from "@/features/contacts/new-contact-dialog";
import { TagsField } from "@/features/sales/document-editor";
import { CheckField, Field, GroupedSelect, Section, SectionsAtAGlance } from "@/features/sales/form-fields";
import { RENTAL_LOCATIONS, periodKeyOf } from "@/features/sales/sales-model";
import { MONTHS, formatEurosInput, parseEuros } from "@/lib/format";
import { settingsStore } from "@/features/settings/settings-store";
import { SOCIAL_SECURITY } from "@/mocks/expenses";
import { MethodDialog } from "@/features/settings/method-dialog";
import { defaultPaymentMethodId, paymentMethodOptions } from "@/features/settings/settings-model";
import { EXPENSES_PATH, NEW_EXPENSE_PATH, expenseIdentity, payeeOf } from "./expenses-model";
import { expensesStore } from "./expenses-store";
import { PercentInput, ReceiptDrop, parseImputation } from "./form-parts";
import { EXPENSE_TYPE_GROUPS, NEW_PURCHASE_PATH } from "./purchases-model";

/** Values of the payee select besides the supplier ids. */
const NO_PAYEE = "none";
const OTHER_PAYEE = "other";
const DEFAULT_EXPENSE_TYPE: ExpenseType = "629";

interface Preset {
  label: string;
  expenseType: ExpenseType;
  concept: (date: string) => string;
  /** Read when the preset is applied, so it follows the settings. */
  amount?: () => Cents;
  payee?: OtherPayee;
}

/** The expenses a freelancer registers most often, one click away on a new expense. */
const PRESETS: Preset[] = [
  {
    label: "Cuota de autónomos",
    expenseType: "6422",
    concept: (date) => {
      const [year, month] = date.split("-").map(Number);
      return year ? `Cuota de autónomos · ${MONTHS[month! - 1]!.toLowerCase()} ${year}` : "Cuota de autónomos";
    },
    amount: () => settingsStore.get().tax.socialSecurityFee,
    payee: SOCIAL_SECURITY,
  },
  { label: "Comisión bancaria", expenseType: "626", concept: () => "Comisión bancaria" },
  { label: "Tasa o tributo", expenseType: "631", concept: () => "Tasa" },
  { label: "Parking o taxi", expenseType: "6292", concept: () => "Desplazamiento" },
];

interface FormState {
  date: string;
  number: string;
  concept: string;
  amount: string;
  expenseType: ExpenseType;
  imputation: string;
  /** A supplier id, NO_PAYEE or OTHER_PAYEE. */
  payee: string;
  otherName: string;
  otherTaxId: string;
  paid: boolean;
  paidOn: string;
  paymentMethodId: string;
  rental: boolean;
  rentalLocation: RentalLocation;
  cadastralRef: string;
  privateNotes: string;
  tags: string[];
  attachments: Attachment[];
}

type ErrorKey = "date" | "number" | "concept" | "amount" | "imputation" | "otherName" | "paidOn" | "paymentMethodId";
type Errors = Partial<Record<ErrorKey, string>>;

/** What happens after creating, from the create button's menu. */
type AfterSave = "list" | "edit" | "another";

/** A supplier's last expense proposes the type and imputation; its sheet, the payment method. */
function prefillFromPayee(f: FormState, supplierId: string): FormState {
  const last = expensesStore
    .all()
    .filter((e) => e.supplierId === supplierId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const method = contactsStore.get("supplier", supplierId)?.paymentMethodId;
  return {
    ...f,
    payee: supplierId,
    ...(last && { expenseType: last.expenseType, imputation: String(last.imputation) }),
    ...(method && { paymentMethodId: method }),
  };
}

/** The form starts from an existing expense (edit), one to copy, or blank. */
function initialState(base: Expense | undefined, isCopy: boolean): FormState {
  const today = toIsoDate(new Date());
  const date = isCopy || !base ? today : base.date;
  return {
    date,
    number: isCopy ? "" : (base?.number ?? ""),
    concept: base?.concept ?? "",
    amount: base ? formatEurosInput(base.amount) : "",
    expenseType: base?.expenseType ?? DEFAULT_EXPENSE_TYPE,
    imputation: String(base?.imputation ?? 100),
    payee: base?.supplierId ?? (base?.otherPayee ? OTHER_PAYEE : NO_PAYEE),
    otherName: base?.otherPayee?.name ?? "",
    otherTaxId: base?.otherPayee?.taxId ?? "",
    // Most expenses are paid on the spot
    paid: isCopy || !base ? true : base.payment !== null,
    paidOn: (!isCopy && base?.payment?.date) || date,
    paymentMethodId: base?.payment?.paymentMethodId ?? defaultPaymentMethodId(),
    rental: base?.rental ?? false,
    rentalLocation: base?.rentalLocation ?? "spain",
    cadastralRef: base?.cadastralRef ?? "",
    privateNotes: isCopy ? "" : (base?.privateNotes ?? ""),
    tags: base?.tags ?? [],
    attachments: isCopy ? [] : (base?.attachments ?? []),
  };
}

export function ExpenseFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const existing = id ? expensesStore.get(id) : undefined;

  if (id && !existing) {
    return (
      <Page>
        <PageHeader title="No encontrado" />
        <p className="m-0 text-muted-foreground">Este gasto no existe o se ha eliminado.</p>
        <Link to={EXPENSES_PATH} className={cn(buttonVariants({ variant: "secondary" }), "self-start")}>
          Volver a gastos
        </Link>
      </Page>
    );
  }

  const source = !existing ? expensesStore.get(params.get("desde") ?? "") : undefined;
  const justSaved = !existing ? expensesStore.get(params.get("registrado") ?? "") : undefined;
  return (
    <SectionsAtAGlance when={Boolean(existing)}>
      <ExpenseForm
        // A new ?desde= or ?registrado= starts over
        key={existing?.id ?? params.toString()}
        existing={existing}
        source={source}
        justSaved={justSaved}
        presetSupplierId={!existing && !source ? params.get("proveedor") : null}
      />
    </SectionsAtAGlance>
  );
}

function ExpenseForm({
  existing,
  source,
  justSaved,
  presetSupplierId,
}: {
  existing?: Expense;
  source?: Expense;
  /** From "Nuevo gasto" on a supplier's sheet. */
  presetSupplierId: string | null;
  /** The expense registered right before, with "Registrar y añadir otro". */
  justSaved?: Expense;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => {
    const initial = initialState(existing ?? source, !existing);
    return presetSupplierId && contactsStore.get("supplier", presetSupplierId)
      ? prefillFromPayee(initial, presetSupplierId)
      : initial;
  });
  // Files picked here are only stored if the form is saved
  useDiscardOnLeave(form.attachments);
  const suppliers = useContacts("supplier");
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [creatingMethod, setCreatingMethod] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const lockedQuarterOf = useLockedQuarter();
  const locked = existing ? lockedQuarterOf(existing.date) : null;
  // Whether the payment date follows the expense date, until it is changed by hand
  const [paidOnFollows, setPaidOnFollows] = useState(form.paidOn === form.date);
  // Prefill from the payee's last expense only on a blank form, until the user picks a type
  const [prefill, setPrefill] = useState(!existing && !source);

  const clearError = (key: ErrorKey) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in ERROR_KEYS) clearError(key as ErrorKey);
  };

  const amount = parseEuros(form.amount);
  const imputation = parseImputation(form.imputation);
  const deductible = amount !== null && imputation !== null ? deductibleExpense(amount, imputation) : null;
  const title = existing ? "Editar gasto" : "Nuevo gasto";

  const changeDate = (date: string) => {
    setForm((f) => ({ ...f, date, paidOn: paidOnFollows ? date : f.paidOn }));
    clearError("date");
    clearError("paidOn");
  };

  const changePayee = (payee: string) => {
    setForm((f) =>
      !prefill || payee === NO_PAYEE || payee === OTHER_PAYEE ? { ...f, payee } : prefillFromPayee(f, payee),
    );
    clearError("otherName");
  };

  const applyPreset = (preset: Preset) => {
    setForm((f) => ({
      ...f,
      expenseType: preset.expenseType,
      concept: preset.concept(f.date),
      amount: preset.amount ? formatEurosInput(preset.amount()) : f.amount,
      ...(preset.payee && { payee: OTHER_PAYEE, otherName: preset.payee.name, otherTaxId: preset.payee.taxId }),
    }));
    setPrefill(false);
    clearError("concept");
    clearError("amount");
    clearError("otherName");
  };

  function toExpense(): Expense {
    const other = form.payee === OTHER_PAYEE;
    const supplierId = form.payee === NO_PAYEE || other ? null : form.payee;
    return {
      id: existing?.id ?? newId(),
      date: form.date,
      number: form.number.trim(),
      concept: form.concept.trim(),
      amount: amount ?? cents(0),
      expenseType: form.expenseType,
      imputation: imputation ?? 0,
      supplierId,
      otherPayee: other ? { name: form.otherName.trim(), taxId: form.otherTaxId.trim().toUpperCase() } : undefined,
      payment: form.paid ? { date: form.paidOn, paymentMethodId: form.paymentMethodId } : null,
      rental: form.rental,
      rentalLocation: form.rental ? form.rentalLocation : undefined,
      cadastralRef: form.rental ? form.cadastralRef.trim() || undefined : undefined,
      privateNotes: form.privateNotes.trim(),
      tags: form.tags.length ? form.tags : undefined,
      attachments: form.attachments.length ? form.attachments : undefined,
    };
  }

  function validate(doc: Expense): Errors {
    const next: Errors = {};
    if (!form.date) next.date = "Indica la fecha del gasto.";
    else if (!isSupportedDate(form.date)) next.date = "Fecha no válida: revisa el año.";
    else if (lockedQuarterOf(form.date)) next.date = lockedMessage(lockedQuarterOf(form.date)!);
    if (!form.concept.trim()) next.concept = "Describe brevemente el gasto.";
    if (amount === null) next.amount = "Indica el importe pagado.";
    else if (amount <= 0) next.amount = "El importe tiene que ser mayor que cero.";
    if (imputation === null) next.imputation = "Un número entero entre 0 y 100.";
    if (form.payee === OTHER_PAYEE && !form.otherName.trim()) next.otherName = "Indica a quién has pagado.";
    if (form.paid && !form.paidOn) next.paidOn = "Indica cuándo lo pagaste.";
    else if (form.paid && !isSupportedDate(form.paidOn)) next.paidOn = "Fecha no válida: revisa el año.";
    if (form.paid && !form.paymentMethodId) next.paymentMethodId = "Elige el método con el que lo pagaste.";
    if (
      !next.date &&
      !next.concept &&
      !next.amount &&
      isDuplicateExpense(expenseIdentity(doc), expensesStore.all().map(expenseIdentity))
    ) {
      if (doc.number) next.number = "Ya has registrado un gasto de este proveedor con este número este año.";
      else next.amount = "Ya hay un gasto con la misma fecha, concepto, importe y proveedor.";
    }
    return next;
  }

  function save(after: AfterSave = "list") {
    const doc = toExpense();
    const found = validate(doc);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }

    if (existing) expensesStore.update(existing.id, doc);
    else expensesStore.add(doc);

    if (after === "edit") navigate(`${EXPENSES_PATH}/${doc.id}`);
    else if (after === "another") {
      navigate(`${NEW_EXPENSE_PATH}?registrado=${doc.id}`);
      window.scrollTo({ top: 0 });
    } else navigate(`${EXPENSES_PATH}?periodo=${periodKeyOf(doc.date)}`);
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
            Registrar gasto
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
                Registrar y añadir otro
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

  const payeeGroups = [
    {
      options: [
        { value: NO_PAYEE, label: "Sin proveedor" },
        { value: OTHER_PAYEE, label: "Otro, solo para este gasto" },
      ],
    },
    {
      label: "Proveedores",
      options: [...suppliers]
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
        .map((s) => ({ value: s.id, label: `${s.name} · ${s.taxId}` })),
    },
  ];

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-6 lg:px-8">
        <PageHeader
          back={<BackLink to={EXPENSES_PATH} label="Volver a gastos" />}
          title={title}
          actions={!locked && actions("hidden lg:flex")}
        />

        {locked && <LockedNotice period={locked} noun="Este gasto" />}

        {justSaved && !source && (
          <Notice role="status" tone="success">
            Gasto «{justSaved.concept}» de {formatEUR(justSaved.amount)} registrado. Ya puedes añadir el siguiente.
          </Notice>
        )}

        {source && !existing && (
          <Notice tone="info">
            Copiado del gasto «{source.concept}»{payeeOf(source) ? ` de ${payeeOf(source)!.name}` : ""}. Revisa la fecha
            y el importe.
          </Notice>
        )}

        <fieldset
          disabled={Boolean(locked)}
          className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0 lg:gap-6 disabled:[&_button:disabled]:opacity-60"
        >
          <ReceiptDrop
            attachments={form.attachments}
            onChange={(a) => set("attachments", a)}
            prompt="Arrastra aquí el ticket o el recibo"
            pickLabel="Adjuntar ticket o recibo"
          />

          <Section title="Datos del gasto" index={1}>
            {!existing && !source && (
              <div role="group" aria-label="Gastos frecuentes" className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-sm text-muted-foreground">Gastos frecuentes:</span>
                {PRESETS.map((preset) => (
                  <Button key={preset.label} variant="chip" onClick={() => applyPreset(preset)}>
                    {preset.label}
                  </Button>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Fecha" required error={errors.date} help="Decide el trimestre en el que se deduce.">
                {(p) => <Input {...p} type="date" value={form.date} onChange={(e) => changeDate(e.target.value)} />}
              </Field>

              <Field label="Concepto" required error={errors.concept} className="xl:col-span-2">
                {(p) => (
                  <Input
                    {...p}
                    value={form.concept}
                    placeholder="Por ejemplo: Cuota de autónomos de octubre"
                    onChange={(e) => set("concept", e.target.value)}
                  />
                )}
              </Field>

              <Field
                label="Importe"
                required
                error={errors.amount}
                help="Lo que has pagado, impuestos incluidos. Sin factura no se puede deducir el IVA, así que todo cuenta como gasto."
              >
                {(p) => (
                  <span className="relative flex w-40 items-center">
                    <Input
                      {...p}
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(e) => set("amount", e.target.value)}
                      className="pr-7 text-right amount"
                    />
                    <span
                      className="pointer-events-none absolute right-3 text-sm text-muted-foreground"
                      aria-hidden="true"
                    >
                      €
                    </span>
                  </span>
                )}
              </Field>

              <Field
                label="Tipo de gasto"
                help="Cuenta del Plan General Contable (grupo 6) en la que se registra el gasto."
                hint={
                  prefill && expensesStore.all().some((e) => e.supplierId === form.payee)
                    ? "Según el último gasto de este proveedor."
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
                    groups={[{ label: "Grupo 6: Compras y gastos", options: [] }, ...EXPENSE_TYPE_GROUPS]}
                  />
                )}
              </Field>

              <Field
                label="Imputación"
                error={errors.imputation}
                help="Parte del gasto que es deducible. Por ejemplo, si trabajas en casa y dedicas el 20 % de la vivienda a la actividad, de la luz puedes deducir el 30 % de ese 20 %: un 6 %."
              >
                {(p) => <PercentInput {...p} value={form.imputation} onChange={(v) => set("imputation", v)} />}
              </Field>
            </div>
          </Section>

          <Section title="Proveedor" index={2}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field
                label="Pagado a"
                action={
                  <Button variant="link" onClick={() => setCreatingSupplier(true)}>
                    Nuevo proveedor
                  </Button>
                }
              >
                {(p) => <GroupedSelect {...p} value={form.payee} onChange={changePayee} groups={payeeGroups} />}
              </Field>
              {form.payee === OTHER_PAYEE && (
                <>
                  <Field label="Nombre o razón social" required error={errors.otherName}>
                    {(p) => (
                      <Input
                        {...p}
                        value={form.otherName}
                        placeholder="Tesorería General de la Seguridad Social"
                        onChange={(e) => set("otherName", e.target.value)}
                      />
                    )}
                  </Field>
                  <Field label="NIF" hint="Si aparece en el justificante.">
                    {(p) => (
                      <Input
                        {...p}
                        value={form.otherTaxId}
                        onChange={(e) => set("otherTaxId", e.target.value)}
                        className="tabular-nums"
                      />
                    )}
                  </Field>
                </>
              )}
              <Field
                label="Número"
                error={errors.number}
                help="Número del recibo o justificante, si tiene. Evita registrar dos veces el mismo."
              >
                {(p) => (
                  <Input
                    {...p}
                    value={form.number}
                    onChange={(e) => set("number", e.target.value)}
                    className="tabular-nums"
                  />
                )}
              </Field>
            </div>
            <p className="m-0 text-sm text-muted-foreground">
              ¿El proveedor te ha dado una factura con IVA?{" "}
              <Link to={NEW_PURCHASE_PATH} className={buttonVariants({ variant: "link" })}>
                Regístrala como factura recibida
              </Link>{" "}
              para deducir también el IVA.
            </p>
          </Section>

          <DeductibleStrip amount={deductible} imputation={imputation} />

          <Section title="Pago" index={4}>
            <CheckField
              label="Pagado"
              hint={form.paid ? undefined : "Quedará como pendiente de pago."}
              checked={form.paid}
              onChange={(v) => set("paid", v)}
            />
            {form.paid && (
              <div className="grid gap-4 pl-7.5 sm:grid-cols-[10rem_minmax(0,16rem)]">
                <Field label="Fecha de pago" required error={errors.paidOn}>
                  {(p) => (
                    <Input
                      {...p}
                      type="date"
                      value={form.paidOn}
                      onChange={(e) => {
                        setPaidOnFollows(e.target.value === form.date);
                        set("paidOn", e.target.value);
                      }}
                    />
                  )}
                </Field>
                <Field label="Método de pago" required error={errors.paymentMethodId}>
                  {(p) => (
                    <GroupedSelect
                      {...p}
                      value={form.paymentMethodId}
                      onChange={(v) => set("paymentMethodId", v)}
                      groups={[{ options: paymentMethodOptions(form.paymentMethodId) }]}
                    />
                  )}
                </Field>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" aria-disabled className="cursor-not-allowed opacity-50">
                    <Landmark strokeWidth={1.8} aria-hidden="true" />
                    Elegir movimiento bancario
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  Disponible cuando conectes tus cuentas bancarias: podrás enlazar el pago con un movimiento.
                </TooltipContent>
              </Tooltip>
              <Button type="button" variant="secondary" className="ml-auto" onClick={() => setCreatingMethod(true)}>
                <Plus aria-hidden="true" />
                Nuevo método
              </Button>
            </div>
          </Section>

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

          <Section title="Opciones avanzadas" index={6} defaultOpen={form.rental}>
            <CheckField
              label="Operación de arrendamiento de inmuebles"
              help="Alquiler de un local u oficina. Se informa en los modelos 115, 180 y 347 con su situación y referencia catastral."
              checked={form.rental}
              onChange={(v) => set("rental", v)}
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
                      className="tabular-nums"
                    />
                  )}
                </Field>
              </div>
            )}
          </Section>
        </fieldset>

        {/* Mobile: actions at the end of the form */}
        {!locked && actions("lg:hidden")}
        <NewContactDialog
          role="supplier"
          open={creatingSupplier}
          onOpenChange={setCreatingSupplier}
          onCreated={(c) => {
            setForm((f) => prefillFromPayee(f, c.id));
            clearError("otherName");
          }}
        />
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

const ERROR_KEYS: Record<ErrorKey, true> = {
  date: true,
  number: true,
  concept: true,
  amount: true,
  imputation: true,
  otherName: true,
  paidOn: true,
  paymentMethodId: true,
};

/** What the expense lowers in the income tax, after imputation. No VAT: there is no invoice. */
function DeductibleStrip({ amount, imputation }: { amount: Cents | null; imputation: number | null }) {
  return (
    <div
      className="flex animate-rise-in flex-wrap items-center gap-x-6 gap-y-1 rounded-xl bg-muted px-4 py-3 text-sm"
      style={{ "--i": 3 } as CSSProperties}
    >
      <span className="font-semibold">Deducible</span>
      {amount === null ? (
        <span className="text-muted-foreground">Indica el importe y la imputación para calcularlo.</span>
      ) : (
        <>
          <span>
            <span className="text-muted-foreground">Gasto ({imputation} %) </span>
            <AnimatedAmount value={amount} className="amount font-semibold" />
          </span>
          <span className="text-muted-foreground">IVA: no deducible sin factura</span>
        </>
      )}
    </div>
  );
}

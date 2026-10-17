import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ChevronDown, FilePlus2, Plus, Star, Trash2 } from "lucide-react";
import { formatIban, isValidIban, normalizeTaxId } from "@fiscalia/core";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@fiscalia/ui/components/dropdown-menu";
import { Checkbox, Input, Textarea } from "@fiscalia/ui/components/input";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { PercentInput, ReceiptDrop } from "@/features/purchases/form-parts";
import { TagsField } from "@/features/sales/document-editor";
import { CLIENT_DEFAULT, Field, GroupedSelect, LocaleFields, Section } from "@/features/sales/form-fields";
import { defaultNumberFormat } from "@/features/sales/invoice-locale";
import { WITHHOLDING_GROUPS } from "@/features/sales/sales-model";
import type { BankAccount, Contact, ContactRole } from "@/mocks/contacts";
import { paymentMethodOptions } from "@/features/settings/settings-model";
import {
  NO_DEFAULT,
  fromDraft,
  hasErrors,
  toDraft,
  validateDraft,
  type ContactDraft,
  type DraftErrorKey,
  type DraftErrors,
} from "./contact-draft";
import { AddressFields, IdentityFields } from "./contact-fields";
import { CUSTOM_FIELD_LABELS, ROLES, contactPath } from "./contacts-model";
import { contactsStore } from "./contacts-store";

const ERROR_KEYS: Record<DraftErrorKey, true> = { taxId: true, name: true, email: true, discount: true };

export function ContactFormPage({ role }: { role: ContactRole }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const config = ROLES[role];
  const existing = id ? contactsStore.get(role, id) : undefined;

  if (id && !existing) return <ContactNotFound role={role} />;

  // "Crear por copia" copies from the same list; "Copiar como proveedor" from the other one
  const from = params.get("de") === "opuesto" ? config.opposite : role;
  const source = !existing ? contactsStore.get(from, params.get("desde") ?? "") : undefined;
  const justSaved = !existing ? contactsStore.get(role, params.get("creado") ?? "") : undefined;
  return (
    <ContactForm
      key={existing?.id ?? params.toString()}
      role={role}
      existing={existing}
      source={source}
      sourceRole={from}
      justSaved={justSaved}
    />
  );
}

export function ContactNotFound({ role }: { role: ContactRole }) {
  const config = ROLES[role];
  return (
    <div className="flex flex-col gap-3 px-5 pt-6 lg:px-8 lg:pt-6">
      <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">No encontrado</h1>
      <p className="m-0 text-muted-foreground">Este {config.singular.toLowerCase()} no existe o se ha eliminado.</p>
      <Link to={config.path} className="font-medium text-primary no-underline hover:text-primary-hover">
        Volver a {config.title.toLowerCase()}
      </Link>
    </div>
  );
}

type AfterSave = "sheet" | "another";

function ContactForm({
  role,
  existing,
  source,
  sourceRole,
  justSaved,
}: {
  role: ContactRole;
  existing?: Contact;
  source?: Contact;
  sourceRole: ContactRole;
  justSaved?: Contact;
}) {
  const navigate = useNavigate();
  const config = ROLES[role];
  const [draft, setDraft] = useState<ContactDraft>(() => {
    const base = toDraft(existing ?? source);
    // A copy keeps the data but not the files, which belong to the original
    return source ? { ...base, attachments: [] } : base;
  });
  const [errors, setErrors] = useState<DraftErrors>({});
  const isClient = role === "client";

  const set = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key in ERROR_KEYS) setErrors((e) => ({ ...e, [key]: undefined }));
    // The country decides how the tax ID is validated
    if (key === "country") setErrors((e) => ({ ...e, taxId: undefined }));
  };

  function save(after: AfterSave = "sheet") {
    const found = validateDraft(role, draft, existing?.id);
    setErrors(found);
    if (hasErrors(found)) {
      // Wait for the error to render so the field is marked invalid
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    const contact = fromDraft(role, draft, existing?.id ?? crypto.randomUUID());
    if (existing) contactsStore.update(role, existing.id, contact);
    else contactsStore.add(role, contact);

    if (after === "another") {
      navigate(`${config.newPath}?creado=${contact.id}`);
      window.scrollTo({ top: 0 });
    } else navigate(contactPath(role, contact.id));
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save();
  };

  const title = existing ? `Editar ${config.singular.toLowerCase()}` : `Nuevo ${config.singular.toLowerCase()}`;
  const back = existing ? contactPath(role, existing.id) : config.path;

  const actions = (className?: string) => (
    <div className={cn("flex gap-2.5", className)}>
      {existing ? (
        <Button type="submit" className="flex-1 lg:flex-none">
          Guardar cambios
        </Button>
      ) : (
        <div className="flex flex-1 lg:flex-none">
          <Button type="submit" className="flex-1 rounded-r-none lg:flex-none">
            Crear {config.singular.toLowerCase()}
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
              <DropdownMenuItem onSelect={() => save("another")}>
                <FilePlus2 aria-hidden="true" />
                Crear y añadir otro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5 px-5 pt-6 lg:gap-4 lg:px-8 lg:pt-6 lg:pb-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={back}
              aria-label={existing ? `Volver a la ficha de ${existing.name}` : `Volver a ${config.title.toLowerCase()}`}
              className={cn(buttonVariants({ variant: "secondary", size: "icon" }), "size-10 no-underline")}
            >
              <ArrowLeft strokeWidth={1.8} aria-hidden="true" />
            </Link>
            <div className="flex min-w-0 flex-col">
              <h1 className="m-0 truncate text-2xl font-semibold tracking-tight lg:text-3xl">{title}</h1>
              {existing && <span className="truncate text-sm text-muted-foreground">{existing.name}</span>}
            </div>
          </div>
          {actions("hidden lg:flex")}
        </header>

        {justSaved && !source && (
          <p role="status" className="m-0 rounded-lg bg-success-soft px-4 py-3 text-sm text-success">
            {config.singular} «{justSaved.name}» creado. Ya puedes añadir el siguiente.
          </p>
        )}

        {source && (
          <p className="m-0 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">
            {sourceRole === role
              ? `Copiado de «${source.name}». Cambia el NIF y el nombre antes de crearlo.`
              : `Datos copiados del ${ROLES[sourceRole].singular.toLowerCase()} «${source.name}». Revísalos y crea el ${config.singular.toLowerCase()}.`}
          </p>
        )}

        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          <Section title="Datos de facturación" index={1}>
            <IdentityFields role={role} draft={draft} errors={errors} set={set} autoFocus={!existing} />
          </Section>

          <Section title="Dirección" index={2}>
            <AddressFields draft={draft} set={set} />
          </Section>

          <Section title="Datos de contacto" index={3}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Email" error={errors.email} hint={isClient ? "Al que se envían las facturas." : undefined}>
                {(p) => (
                  <Input
                    {...p}
                    type="email"
                    autoComplete="email"
                    value={draft.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                )}
              </Field>
              <Field label="Teléfono">
                {(p) => <Input {...p} type="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} />}
              </Field>
              <Field label="Móvil">
                {(p) => (
                  <Input {...p} type="tel" value={draft.mobile} onChange={(e) => set("mobile", e.target.value)} />
                )}
              </Field>
              <Field label="Fax">
                {(p) => <Input {...p} type="tel" value={draft.fax} onChange={(e) => set("fax", e.target.value)} />}
              </Field>
              <Field label="Web">
                {(p) => (
                  <Input
                    {...p}
                    type="url"
                    inputMode="url"
                    placeholder="www.ejemplo.es"
                    value={draft.website}
                    onChange={(e) => set("website", e.target.value)}
                  />
                )}
              </Field>
            </div>
          </Section>

          <Section title="Condiciones por defecto" index={4}>
            <p className="m-0 text-sm text-muted-foreground">
              Se proponen al elegir {config.noun} en{" "}
              {isClient ? "una factura, presupuesto o albarán" : "una factura recibida o un gasto"}; puedes cambiarlas
              en cada documento.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
              <Field label="Descuento" error={errors.discount} help="Se aplica a cada concepto nuevo del documento.">
                {(p) => (
                  <PercentInput {...p} value={draft.discount} placeholder="0" onChange={(v) => set("discount", v)} />
                )}
              </Field>
              <Field
                label="Retención"
                help={
                  isClient
                    ? "IRPF que te retiene este cliente. Las empresas y autónomos retienen a los profesionales; los particulares no."
                    : "IRPF que retienes a este proveedor, por ejemplo a un profesional como tu gestor."
                }
              >
                {(p) => (
                  <GroupedSelect
                    {...p}
                    value={draft.withholding}
                    onChange={(v) => set("withholding", v)}
                    groups={[{ options: [{ value: NO_DEFAULT, label: "La del documento" }] }, ...WITHHOLDING_GROUPS]}
                  />
                )}
              </Field>
              <Field label={isClient ? "Método de cobro" : "Método de pago"}>
                {(p) => (
                  <GroupedSelect
                    {...p}
                    value={draft.paymentMethodId}
                    onChange={(v) => set("paymentMethodId", v)}
                    groups={[
                      {
                        options: [
                          { value: NO_DEFAULT, label: "El del documento" },
                          ...paymentMethodOptions(draft.paymentMethodId),
                        ],
                      },
                    ]}
                  />
                )}
              </Field>
            </div>
            {isClient && (
              <div className="flex flex-col gap-3 border-t border-divider pt-4">
                <h3 className="m-0 text-sm font-semibold">Idioma y formato numérico de sus documentos</h3>
                <LocaleFields
                  language={draft.language}
                  numberFormat={draft.numberFormat}
                  defaultLabels={{
                    language: "Idioma por defecto del documento",
                    format: "Formato por defecto del documento",
                    note: "Se usa el idioma y formato de la configuración de facturas.",
                  }}
                  onLanguageChange={(v) => {
                    const language = v === CLIENT_DEFAULT ? "" : v;
                    setDraft((d) => ({ ...d, language, numberFormat: defaultNumberFormat(language) }));
                  }}
                  onNumberFormatChange={(v) => set("numberFormat", v === CLIENT_DEFAULT ? "" : v)}
                />
              </div>
            )}
          </Section>

          <Section title="Datos bancarios" index={5} defaultOpen={draft.bankAccounts.length > 0}>
            <BankAccounts accounts={draft.bankAccounts} onChange={(a) => set("bankAccounts", a)} />
          </Section>

          <Section title="Otros" index={6}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={CUSTOM_FIELD_LABELS[0]}>
                {(p) => <Input {...p} value={draft.custom1} onChange={(e) => set("custom1", e.target.value)} />}
              </Field>
              <Field label={CUSTOM_FIELD_LABELS[1]}>
                {(p) => <Input {...p} value={draft.custom2} onChange={(e) => set("custom2", e.target.value)} />}
              </Field>
              <Field label="Notas" help="Solo las ves tú.">
                {(p) => <Textarea {...p} rows={3} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />}
              </Field>
              <TagsField tags={draft.tags} onChange={(tags) => set("tags", tags)} />
            </div>
          </Section>

          {isClient && (
            <Section title="Factura electrónica" index={7} defaultOpen={Object.values(draft.eInvoice).some(Boolean)}>
              <p className="m-0 text-sm text-muted-foreground">
                Solo para administraciones públicas: los códigos DIR3 que piden para recibir facturas por FACe.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {(
                  [
                    ["accountingOffice", "Oficina contable"],
                    ["managementBody", "Órgano gestor"],
                    ["processingUnit", "Unidad tramitadora"],
                    ["proposingBody", "Órgano proponente"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    {(p) => (
                      <Input
                        {...p}
                        value={draft.eInvoice[key]}
                        placeholder="L01280796"
                        onChange={(e) => set("eInvoice", { ...draft.eInvoice, [key]: e.target.value })}
                        className="font-mono uppercase"
                      />
                    )}
                  </Field>
                ))}
              </div>
            </Section>
          )}

          <Section title="Documentos adjuntos" index={8} defaultOpen={draft.attachments.length > 0}>
            <ReceiptDrop
              attachments={draft.attachments}
              onChange={(a) => set("attachments", a)}
              label="Documentos adjuntos"
              prompt="Arrastra aquí contratos, mandatos SEPA u otros documentos"
              note="Se guardan solo en esta sesión hasta que haya almacenamiento de archivos."
              accept=""
            />
          </Section>
        </div>

        {actions("lg:hidden")}
      </form>
    </TooltipProvider>
  );
}

const EMPTY_ACCOUNT = { iban: "", bic: "", notes: "", isDefault: false };

/** The contact's bank accounts: one is the default, used for direct debits. */
function BankAccounts({ accounts, onChange }: { accounts: BankAccount[]; onChange: (a: BankAccount[]) => void }) {
  const [adding, setAdding] = useState<typeof EMPTY_ACCOUNT | null>(null);
  const [error, setError] = useState<{ iban?: string; bic?: string }>({});

  const add = () => {
    if (!adding) return;
    const iban = normalizeTaxId(adding.iban);
    const bic = normalizeTaxId(adding.bic);
    const next: typeof error = {};
    if (!isValidIban(iban)) next.iban = "El IBAN no es correcto. Revisa los dígitos de control.";
    else if (accounts.some((a) => a.iban === iban)) next.iban = "Esta cuenta ya está añadida.";
    if (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) next.bic = "El BIC tiene 8 u 11 caracteres.";
    setError(next);
    if (next.iban || next.bic) return;
    const isDefault = adding.isDefault || accounts.length === 0;
    onChange([
      ...accounts.map((a) => (isDefault ? { ...a, isDefault: false } : a)),
      { id: crypto.randomUUID(), iban, bic: bic || undefined, notes: adding.notes.trim() || undefined, isDefault },
    ]);
    setAdding(null);
  };

  const makeDefault = (id: string) => onChange(accounts.map((a) => ({ ...a, isDefault: a.id === id })));
  const remove = (id: string) => {
    const rest = accounts.filter((a) => a.id !== id);
    // Keep a default while there are accounts left
    if (rest.length && !rest.some((a) => a.isDefault)) rest[0] = { ...rest[0]!, isDefault: true };
    onChange(rest);
  };

  return (
    <div className="flex flex-col gap-3">
      {accounts.length === 0 && !adding && (
        <p className="m-0 text-sm text-muted-foreground">No hay cuentas bancarias.</p>
      )}
      {accounts.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2"
            >
              <span className="font-mono text-sm">{formatIban(a.iban)}</span>
              {a.bic && <span className="font-mono text-xs text-muted-foreground">{a.bic}</span>}
              {a.notes && <span className="min-w-0 truncate text-sm text-muted-foreground">{a.notes}</span>}
              <span className="ml-auto flex items-center gap-1">
                {a.isDefault ? (
                  <span className="text-xs font-semibold text-primary">Por defecto</span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => makeDefault(a.id)}>
                    <Star strokeWidth={1.8} aria-hidden="true" />
                    Usar por defecto
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Quitar la cuenta ${formatIban(a.iban)}`}
                  onClick={() => remove(a.id)}
                  className="size-8 px-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 strokeWidth={1.8} aria-hidden="true" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <div
          // Enter adds the account instead of submitting the whole contact
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "checkbox") {
              e.preventDefault();
              add();
            }
          }}
          className="grid gap-4 rounded-lg bg-muted p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)]"
        >
          <Field label="IBAN" required error={error.iban}>
            {(p) => (
              <Input
                {...p}
                autoFocus
                value={adding.iban}
                placeholder="ES00 0000 0000 0000 0000 0000"
                onChange={(e) => {
                  setAdding({ ...adding, iban: e.target.value });
                  setError((x) => ({ ...x, iban: undefined }));
                }}
                className="font-mono uppercase"
              />
            )}
          </Field>
          <Field label="BIC" error={error.bic}>
            {(p) => (
              <Input
                {...p}
                value={adding.bic}
                onChange={(e) => {
                  setAdding({ ...adding, bic: e.target.value });
                  setError((x) => ({ ...x, bic: undefined }));
                }}
                className="font-mono uppercase"
              />
            )}
          </Field>
          <Field label="Notas" className="sm:col-span-2 xl:col-span-1">
            {(p) => (
              <Input {...p} value={adding.notes} onChange={(e) => setAdding({ ...adding, notes: e.target.value })} />
            )}
          </Field>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 xl:col-span-3">
            {accounts.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                <Checkbox
                  checked={adding.isDefault}
                  onChange={(e) => setAdding({ ...adding, isDefault: e.target.checked })}
                />
                Cuenta por defecto
              </label>
            )}
            <span className="ml-auto flex gap-2">
              <Button variant="ghost" size="md" onClick={() => setAdding(null)}>
                Cancelar
              </Button>
              <Button variant="secondary" size="md" onClick={add}>
                Añadir cuenta
              </Button>
            </span>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="md" className="self-start" onClick={() => setAdding(EMPTY_ACCOUNT)}>
          <Plus strokeWidth={2} aria-hidden="true" />
          Añadir cuenta bancaria
        </Button>
      )}
    </div>
  );
}

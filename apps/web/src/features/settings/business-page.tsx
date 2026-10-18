import { useState } from "react";
import { Link } from "react-router";
import { checkSpanishTaxId, isValidEmail, normalizeTaxId } from "@fiscalia/core";
import type { BusinessKind, BusinessProfile } from "@fiscalia/contracts";
import { Input } from "@fiscalia/ui/components/input";
import { SegmentedControl } from "@fiscalia/ui/components/segmented-control";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { AddressFields } from "@/features/contacts/contact-fields";
import { Field, Section } from "@/features/sales/form-fields";
import { SaveButton, SettingsHeader, useDraft } from "./settings-parts";
import { addressLine, businessName, fullName, INVOICE_SETTINGS_PATH } from "./settings-model";
import { settingsStore, useSettings } from "./settings-store";

type Errors = Partial<Record<keyof BusinessProfile, string>>;

const KIND_OPTIONS: { value: BusinessKind; label: string }[] = [
  { value: "selfEmployed", label: "Autónomo" },
  { value: "company", label: "Sociedad" },
];

/** A self-employed worker files with their NIF or NIE; a company with its CIF. */
function taxIdError(kind: BusinessKind, taxId: string): string | undefined {
  const check = checkSpanishTaxId(taxId);
  if (!check.valid) {
    if (check.reason === "empty") return "Introduce tu NIF.";
    if (check.reason === "checksum") return "La letra o el dígito de control no es correcto.";
    return "El formato no es correcto. Ejemplos: 12345678Z (NIF), X1234567L (NIE) o B12345674 (CIF).";
  }
  if (kind === "selfEmployed" && check.kind === "cif")
    return "Un CIF es de una sociedad. Cambia el tipo de empresa o revisa el NIF.";
  if (kind === "company" && check.kind !== "cif")
    return "Una sociedad se identifica con su CIF, no con un NIF personal.";
  return undefined;
}

function validate(p: BusinessProfile): Errors {
  const errors: Errors = {};
  const taxId = taxIdError(p.kind, p.taxId);
  if (taxId) errors.taxId = taxId;
  if (p.kind === "selfEmployed") {
    if (!p.firstName.trim()) errors.firstName = "Introduce tu nombre.";
    if (!p.lastName.trim()) errors.lastName = "Introduce tu primer apellido.";
  } else if (!p.legalName.trim()) errors.legalName = "Introduce la razón social.";
  if (p.email.trim() && !isValidEmail(p.email)) errors.email = "El email no es válido.";
  return errors;
}

/** How the issuer block of an invoice will look with the current draft. */
function InvoicePreview({ profile }: { profile: BusinessProfile }) {
  const lines = [
    profile.taxId.trim() && `NIF ${normalizeTaxId(profile.taxId)}`,
    addressLine(profile),
    profile.province.trim() && profile.province !== profile.city ? profile.province : "",
    [profile.email, profile.phone]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" · "),
    profile.website.trim(),
  ].filter(Boolean);
  return (
    <aside
      aria-label="Vista previa en la factura"
      className="flex animate-rise-in flex-col gap-3 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-6"
    >
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Así apareces en tus facturas
      </span>
      <div className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-3.5">
        <span className="text-2xs tracking-wide text-muted-foreground uppercase">Emisor</span>
        <span className="font-semibold">{businessName(profile) || "Sin nombre"}</span>
        {lines.map((line) => (
          <span key={line} className="text-sm text-muted-foreground">
            {line}
          </span>
        ))}
      </div>
      <p className="m-0 text-sm text-muted-foreground">
        El logotipo, la plantilla y el pie de las facturas se configuran en{" "}
        <Link to={INVOICE_SETTINGS_PATH} className="font-medium text-primary no-underline hover:text-primary-hover">
          Configuración de facturas
        </Link>
        .
      </p>
    </aside>
  );
}

export function BusinessPage() {
  const saved = useSettings().profile;
  const { draft, set, dirty, justSaved, markSaved } = useDraft(saved);
  const [showErrors, setShowErrors] = useState(false);
  const errors = validate(draft);
  const visible = showErrors ? errors : {};

  const save = () => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    settingsStore.updateProfile({ ...draft, taxId: normalizeTaxId(draft.taxId) });
    setShowErrors(false);
    markSaved();
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-6 lg:px-8">
        <SettingsHeader
          title="Datos de la empresa"
          description="Tus datos fiscales, tal y como aparecen en facturas e informes."
        >
          <SaveButton dirty={dirty} justSaved={justSaved} onSave={save} />
        </SettingsHeader>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
          <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
            <Section title="Datos fiscales" index={0}>
              <SegmentedControl
                label="Tipo de empresa"
                value={draft.kind}
                onChange={(kind) => set("kind", kind)}
                options={KIND_OPTIONS}
                className="self-start"
              />
              <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                <Field
                  label={draft.kind === "company" ? "CIF" : "NIF"}
                  required
                  error={visible.taxId}
                  help="Se comprueba la letra o el dígito de control. Es el que figura en tu alta censal (modelo 036 o 037)."
                >
                  {(p) => (
                    <Input
                      {...p}
                      value={draft.taxId}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(e) => set("taxId", e.target.value)}
                      className="font-mono uppercase"
                    />
                  )}
                </Field>
                {draft.kind === "company" && (
                  <Field label="Razón social" required error={visible.legalName}>
                    {(p) => (
                      <Input
                        {...p}
                        value={draft.legalName}
                        autoComplete="organization"
                        onChange={(e) => set("legalName", e.target.value)}
                      />
                    )}
                  </Field>
                )}
              </div>
              {draft.kind === "selfEmployed" && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Nombre" required error={visible.firstName}>
                    {(p) => (
                      <Input
                        {...p}
                        value={draft.firstName}
                        autoComplete="given-name"
                        onChange={(e) => set("firstName", e.target.value)}
                      />
                    )}
                  </Field>
                  <Field label="Primer apellido" required error={visible.lastName}>
                    {(p) => (
                      <Input
                        {...p}
                        value={draft.lastName}
                        autoComplete="family-name"
                        onChange={(e) => set("lastName", e.target.value)}
                      />
                    )}
                  </Field>
                  <Field label="Segundo apellido">
                    {(p) => (
                      <Input
                        {...p}
                        value={draft.secondLastName}
                        onChange={(e) => set("secondLastName", e.target.value)}
                      />
                    )}
                  </Field>
                </div>
              )}
              <Field
                label="Nombre a mostrar en las facturas"
                hint="Tu nombre comercial, si tienes. Vacío, se usa el nombre completo."
              >
                {(p) => (
                  <Input
                    {...p}
                    value={draft.tradeName}
                    placeholder={fullName(draft)}
                    onChange={(e) => set("tradeName", e.target.value)}
                  />
                )}
              </Field>
            </Section>

            <Section title="Dirección fiscal" index={1}>
              <AddressFields draft={draft} set={(key, value) => set(key, value)} />
            </Section>

            <Section title="Contacto" index={2}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Email" error={visible.email}>
                  {(p) => (
                    <Input
                      {...p}
                      type="email"
                      value={draft.email}
                      autoComplete="email"
                      onChange={(e) => set("email", e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Teléfono">
                  {(p) => (
                    <Input
                      {...p}
                      type="tel"
                      value={draft.phone}
                      autoComplete="tel"
                      onChange={(e) => set("phone", e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Web">
                  {(p) => (
                    <Input
                      {...p}
                      value={draft.website}
                      autoComplete="url"
                      inputMode="url"
                      onChange={(e) => set("website", e.target.value)}
                    />
                  )}
                </Field>
              </div>
            </Section>
          </div>

          <InvoicePreview profile={draft} />
        </div>
      </div>
    </TooltipProvider>
  );
}

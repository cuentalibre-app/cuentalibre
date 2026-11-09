import { useState, type FormEvent } from "react";
import { missingIssuerFields, normalizeTaxId } from "@cuentalibre/core";
import type { BusinessProfile } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { AddressFields } from "@/features/contacts/contact-fields";
import { missingIssuerData, profileErrors } from "@/features/settings/settings-model";
import { settingsStore } from "@/features/settings/settings-store";
import { Field } from "./form-fields";

const ADDRESS_FIELDS = ["address", "postalCode", "city"] as const;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Asks for what the business profile lacks to issue invoices, without leaving
 * the document: only the fields that are missing, saved to the profile before
 * `onSaved` goes on, issuing when `issues`. Needs a TooltipProvider above, as
 * the forms that open it have.
 */
export function IssuerDialog({
  open,
  issues,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  issues: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open && (
          <IssuerForm
            issues={issues}
            onCancel={() => onOpenChange(false)}
            onSaved={() => {
              onOpenChange(false);
              onSaved();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function IssuerForm({ issues, onCancel, onSaved }: { issues: boolean; onCancel: () => void; onSaved: () => void }) {
  const saved = settingsStore.get().profile;
  const [draft, setDraft] = useState(saved);
  const [submitted, setSubmitted] = useState(false);
  // The groups shown stay those missing on opening, so a field doesn't vanish while typed in
  const [asks] = useState(() => {
    const missing = missingIssuerFields(saved);
    return {
      identity: missing.some((field) => !(ADDRESS_FIELDS as readonly string[]).includes(field)),
      address: missing.some((field) => (ADDRESS_FIELDS as readonly string[]).includes(field)),
    };
  });
  const set = <K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const identityErrors = asks.identity ? profileErrors(draft) : {};
  const addressMissing = asks.address && ADDRESS_FIELDS.some((field) => !draft[field].trim());
  const errors = submitted ? identityErrors : {};

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(identityErrors).length > 0 || addressMissing) return;
    settingsStore.updateProfile({ ...draft, taxId: normalizeTaxId(draft.taxId) });
    onSaved();
  };

  const company = draft.kind === "company";
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <DialogTitle>Faltan datos de tu empresa</DialogTitle>
        <DialogDescription>
          Toda factura lleva el NIF, el nombre fiscal y la dirección de quien la emite. A tu empresa le{" "}
          {missingIssuerData(saved)}. Se guardará en Configuración › Datos de la empresa.
        </DialogDescription>
      </div>

      {asks.identity && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={company ? "CIF" : "NIF"} required error={errors.taxId}>
            {(p) => (
              <Input
                {...p}
                value={draft.taxId}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                onChange={(e) => set("taxId", e.target.value)}
                className="uppercase tabular-nums"
              />
            )}
          </Field>
          {company ? (
            <Field label="Razón social" required error={errors.legalName}>
              {(p) => (
                <Input
                  {...p}
                  value={draft.legalName}
                  autoComplete="organization"
                  onChange={(e) => set("legalName", e.target.value)}
                />
              )}
            </Field>
          ) : (
            <>
              <Field label="Nombre" required error={errors.firstName}>
                {(p) => (
                  <Input
                    {...p}
                    value={draft.firstName}
                    autoComplete="given-name"
                    onChange={(e) => set("firstName", e.target.value)}
                  />
                )}
              </Field>
              <Field label="Primer apellido" required error={errors.lastName}>
                {(p) => (
                  <Input
                    {...p}
                    value={draft.lastName}
                    autoComplete="family-name"
                    onChange={(e) => set("lastName", e.target.value)}
                  />
                )}
              </Field>
            </>
          )}
        </div>
      )}

      {asks.address && (
        <div className="flex flex-col gap-2">
          <AddressFields compact required draft={draft} set={set} />
          {submitted && addressMissing && (
            <p role="alert" className="m-0 text-xs text-destructive">
              {capitalize(missingIssuerData(draft) ?? "")}.
            </p>
          )}
        </div>
      )}

      <DialogFooter>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">{issues ? "Guardar y emitir" : "Guardar"}</Button>
      </DialogFooter>
    </form>
  );
}

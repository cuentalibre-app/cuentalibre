import { useState, type FormEvent } from "react";
import { newId } from "@cuentalibre/core";
import type { Contact, ContactRole } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { Field } from "@/features/sales/form-fields";
import { fromDraft, hasErrors, toDraft, validateDraft, type ContactDraft, type DraftErrors } from "./contact-draft";
import { AddressFields, IdentityFields } from "./contact-fields";
import { ROLES } from "./contacts-model";
import { contactsStore } from "./contacts-store";

/**
 * Creates a client or supplier without leaving the document being edited:
 * only what an invoice needs. The rest can be completed later in the sheet.
 * Needs a TooltipProvider above, as the forms that open it have.
 */
export function NewContactDialog({
  role,
  open,
  onOpenChange,
  onCreated,
}: {
  role: ContactRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (contact: Contact) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open && (
          <QuickForm
            role={role}
            onCreated={(c) => {
              onCreated(c);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuickForm({
  role,
  onCreated,
  onCancel,
}: {
  role: ContactRole;
  onCreated: (contact: Contact) => void;
  onCancel: () => void;
}) {
  const config = ROLES[role];
  const [draft, setDraft] = useState<ContactDraft>(() => toDraft(undefined));
  const [errors, setErrors] = useState<DraftErrors>({});
  const set = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key === "taxId" || key === "name" || key === "email" || key === "country")
      setErrors((e) => ({ ...e, [key === "country" ? "taxId" : key]: undefined }));
  };

  const submit = (e: FormEvent) => {
    // The dialog is portalled, but React still bubbles submit to the document form around it
    e.preventDefault();
    e.stopPropagation();
    const found = validateDraft(role, draft);
    setErrors(found);
    if (hasErrors(found)) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[role=dialog] [aria-invalid=true]")?.focus());
      return;
    }
    const contact = fromDraft(role, draft, newId());
    contactsStore.add(role, contact);
    onCreated(contact);
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <DialogTitle>Nuevo {config.singular.toLowerCase()}</DialogTitle>
        <DialogDescription>
          Los datos que aparecen en la factura. El resto puedes completarlo después en su ficha.
        </DialogDescription>
      </div>
      <IdentityFields role={role} draft={draft} errors={errors} set={set} autoFocus />
      <AddressFields draft={draft} set={set} />
      <Field label="Email" error={errors.email}>
        {(p) => <Input {...p} type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Crear {config.singular.toLowerCase()}</Button>
      </div>
    </form>
  );
}

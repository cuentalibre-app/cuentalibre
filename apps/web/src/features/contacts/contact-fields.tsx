import { Link } from "react-router";
import { UsersRound } from "lucide-react";
import {
  SPAIN,
  checkTaxId,
  countryFromVatPrefix,
  findDuplicateTaxId,
  isOtherEuCountry,
  provinceFromPostalCode,
} from "@cuentalibre/core";
import type { Contact, ContactRole } from "@cuentalibre/contracts";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { Input } from "@cuentalibre/ui/components/input";
import { cn } from "@cuentalibre/ui/lib/cn";
import { Notice } from "@/components/page";
import { CheckField, Field, GroupedSelect } from "@/features/sales/form-fields";
import { AddressMap } from "./address-map";
import { AddressSearchInput } from "./address-search";
import type { AddressSuggestion } from "./address-search-model";
import type { ContactDraft, DraftErrors } from "./contact-draft";
import { COUNTRIES, ROLES, contactPath, taxIdWarning } from "./contacts-model";
import { useContacts } from "./contacts-store";

/* Field groups shared by the contact page and the quick-create dialog. Help icons need a TooltipProvider above. */

export type SetDraft = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) => void;

const COUNTRY_GROUPS = COUNTRIES.map((g) => ({
  label: g.label,
  options: g.options.map((c) => ({ value: c, label: c })),
}));

const KIND_LABELS = { nif: "NIF de persona física", nie: "NIE", cif: "CIF de entidad", foreign: null } as const;

export function IdentityFields({
  role,
  contactId,
  draft,
  errors,
  set,
  autoFocus,
  onUseExisting,
}: {
  role: ContactRole;
  /** The contact being edited, which doesn't count as a duplicate of itself. */
  contactId?: string;
  draft: ContactDraft;
  errors: DraftErrors;
  set: SetDraft;
  autoFocus?: boolean;
  /** Offers picking the contact that already has this tax ID instead of linking to its sheet. */
  onUseExisting?: (contact: Contact) => void;
}) {
  const duplicate = findDuplicateTaxId({ id: contactId, taxId: draft.taxId }, useContacts(role));
  const check = checkTaxId(draft.taxId, draft.country);
  const hint = taxIdWarning(draft.taxId, draft.country) ?? (check.valid ? KIND_LABELS[check.kind] : null) ?? undefined;
  const eu = isOtherEuCountry(draft.country);
  const changeTaxId = (taxId: string) => {
    set("taxId", taxId);
    // An EU VAT number gives its country away; only while the country is still the default
    const country = countryFromVatPrefix(taxId);
    if (country && draft.country === SPAIN) set("country", country);
  };
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <Field
          label="NIF"
          required
          error={errors.taxId}
          hint={hint}
          help={
            draft.country === SPAIN
              ? "Se comprueba la letra o el dígito de control. Admite NIF, NIE y CIF, con o sin el prefijo ES."
              : "El número de identificación fiscal del país; en la UE, el NIF-IVA con el código del país delante."
          }
        >
          {(p) => (
            <Input
              {...p}
              autoFocus={autoFocus}
              value={draft.taxId}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => changeTaxId(e.target.value)}
              className="uppercase tabular-nums"
            />
          )}
        </Field>
        <Field label="Nombre o razón social" required error={errors.name}>
          {(p) => (
            <Input
              {...p}
              value={draft.name}
              autoComplete="organization"
              onChange={(e) => set("name", e.target.value)}
            />
          )}
        </Field>
      </div>
      {duplicate && !errors.taxId && (
        <DuplicateTaxIdNotice
          role={role}
          duplicate={duplicate}
          onUse={onUseExisting && (() => onUseExisting(duplicate))}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-end">
        <Field label="País" help="Decide cómo se valida el NIF y qué tipo de operación se propone en las facturas.">
          {(p) => (
            <GroupedSelect {...p} value={draft.country} onChange={(v) => set("country", v)} groups={COUNTRY_GROUPS} />
          )}
        </Field>
        {eu && (
          <div className="pb-2">
            <CheckField
              label="Inscrito en el VIES"
              help={`Si ${role === "client" ? "el cliente" : "el proveedor"} es empresa o autónomo con NIF-IVA válido en el censo europeo. Sus facturas se proponen como operaciones intracomunitarias, sin IVA.`}
              checked={draft.vies}
              onChange={(v) => set("vies", v)}
            />
          </div>
        )}
      </div>
    </>
  );
}

/**
 * A repeated tax ID is usually a mistake but not always (one company with
 * several billing addresses, or a public body with several DIR3 units), so it
 * warns without blocking the save.
 */
function DuplicateTaxIdNotice({
  role,
  duplicate,
  onUse,
}: {
  role: ContactRole;
  duplicate: Contact;
  onUse?: () => void;
}) {
  const noun = ROLES[role].noun.replace(/^el /, "");
  return (
    <Notice role="status" tone="warning" icon={UsersRound}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="m-0 min-w-0">
          Ya tienes un {noun} con este NIF:{" "}
          <strong className="font-semibold">{duplicate.name.replace(/\.$/, "")}</strong>.
        </p>
        {onUse ? (
          <Button variant="secondary" size="sm" className="self-start sm:self-auto" onClick={onUse}>
            Usar este {noun}
          </Button>
        ) : (
          <Link to={contactPath(role, duplicate.id)} className={buttonVariants({ variant: "link" })}>
            Abrir su ficha
          </Link>
        )}
      </div>
    </Notice>
  );
}

type AddressDraft = Pick<ContactDraft, "address" | "postalCode" | "city" | "province" | "country">;

/** Address, postal code, town and province. Also used by the business profile. */
export function AddressFields({
  draft,
  set,
  compact = false,
  required = false,
}: {
  draft: AddressDraft;
  set: <K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) => void;
  /** Two columns at most, for narrow forms such as onboarding. */
  compact?: boolean;
  /** Marks what an invoice needs of the address: all but the province. */
  required?: boolean;
}) {
  const changePostalCode = (postalCode: string) => {
    set("postalCode", postalCode);
    // Spanish postal codes give the province away; only fill it while empty or still the suggested one
    const province = draft.country === SPAIN ? provinceFromPostalCode(postalCode) : null;
    if (province && (!draft.province.trim() || draft.province === provinceFromPostalCode(draft.postalCode)))
      set("province", province);
  };
  const pickSuggestion = (s: AddressSuggestion) => {
    set("address", s.address);
    // A street across several postal codes leaves it to the number; a stale one from another town goes
    if (s.postalCode) set("postalCode", s.postalCode);
    else if (s.city && s.city !== draft.city) set("postalCode", "");
    if (s.city) set("city", s.city);
    if (s.province) set("province", s.province);
  };
  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "grid gap-4 sm:grid-cols-2",
          !compact && "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]",
        )}
      >
        <Field label="Dirección" required={required} className={cn("sm:col-span-2", !compact && "xl:col-span-1")}>
          {(p) =>
            draft.country === SPAIN ? (
              <AddressSearchInput
                {...p}
                value={draft.address}
                postalCode={draft.postalCode}
                onChange={(address) => set("address", address)}
                onPick={pickSuggestion}
              />
            ) : (
              <Input
                {...p}
                value={draft.address}
                autoComplete="street-address"
                onChange={(e) => set("address", e.target.value)}
              />
            )
          }
        </Field>
        <Field label="Código postal" required={required}>
          {(p) => (
            <Input
              {...p}
              value={draft.postalCode}
              autoComplete="postal-code"
              inputMode={draft.country === SPAIN ? "numeric" : undefined}
              onChange={(e) => changePostalCode(e.target.value)}
              className="tabular-nums"
            />
          )}
        </Field>
        <Field label="Población" required={required}>
          {(p) => <Input {...p} value={draft.city} onChange={(e) => set("city", e.target.value)} />}
        </Field>
        <Field label="Provincia" hint={draft.country === SPAIN ? "Se rellena con el código postal." : undefined}>
          {(p) => <Input {...p} value={draft.province} onChange={(e) => set("province", e.target.value)} />}
        </Field>
      </div>
      <AddressMap address={draft} />
    </div>
  );
}

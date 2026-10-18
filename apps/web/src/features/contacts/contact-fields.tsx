import { MapPin } from "lucide-react";
import { SPAIN, checkTaxId, countryFromVatPrefix, isOtherEuCountry, provinceFromPostalCode } from "@fiscalia/core";
import type { ContactRole } from "@fiscalia/contracts";
import { Input } from "@fiscalia/ui/components/input";
import { CheckField, Field, GroupedSelect } from "@/features/sales/form-fields";
import type { ContactDraft, DraftErrors } from "./contact-draft";
import { COUNTRIES, taxIdWarning } from "./contacts-model";

/* Field groups shared by the contact page and the quick-create dialog. Help icons need a TooltipProvider above. */

export type SetDraft = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) => void;

const COUNTRY_GROUPS = COUNTRIES.map((g) => ({
  label: g.label,
  options: g.options.map((c) => ({ value: c, label: c })),
}));

const KIND_LABELS = { nif: "NIF de persona física", nie: "NIE", cif: "CIF de entidad", foreign: null } as const;

export function IdentityFields({
  role,
  draft,
  errors,
  set,
  autoFocus,
}: {
  role: ContactRole;
  draft: ContactDraft;
  errors: DraftErrors;
  set: SetDraft;
  autoFocus?: boolean;
}) {
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
              className="font-mono uppercase"
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

type AddressDraft = Pick<ContactDraft, "address" | "postalCode" | "city" | "province" | "country">;

/** Address, postal code, town and province. Also used by the business profile. */
export function AddressFields({
  draft,
  set,
}: {
  draft: AddressDraft;
  set: <K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) => void;
}) {
  const query = [draft.address, draft.postalCode, draft.city, draft.province, draft.country]
    .filter((v) => v.trim())
    .join(", ");
  const changePostalCode = (postalCode: string) => {
    set("postalCode", postalCode);
    // Spanish postal codes give the province away; only fill it while empty or still the suggested one
    const province = draft.country === SPAIN ? provinceFromPostalCode(postalCode) : null;
    if (province && (!draft.province.trim() || draft.province === provinceFromPostalCode(draft.postalCode)))
      set("province", province);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field label="Dirección" className="sm:col-span-2 xl:col-span-1">
          {(p) => (
            <Input
              {...p}
              value={draft.address}
              autoComplete="street-address"
              onChange={(e) => set("address", e.target.value)}
            />
          )}
        </Field>
        <Field label="Código postal">
          {(p) => (
            <Input
              {...p}
              value={draft.postalCode}
              autoComplete="postal-code"
              inputMode={draft.country === SPAIN ? "numeric" : undefined}
              onChange={(e) => changePostalCode(e.target.value)}
              className="font-mono"
            />
          )}
        </Field>
        <Field label="Población">
          {(p) => <Input {...p} value={draft.city} onChange={(e) => set("city", e.target.value)} />}
        </Field>
        <Field label="Provincia" hint={draft.country === SPAIN ? "Se rellena con el código postal." : undefined}>
          {(p) => <Input {...p} value={draft.province} onChange={(e) => set("province", e.target.value)} />}
        </Field>
      </div>
      {(draft.address.trim() || draft.city.trim()) && (
        <a
          href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 self-start text-sm font-medium text-primary no-underline hover:text-primary-hover"
        >
          <MapPin className="size-4" strokeWidth={1.8} aria-hidden="true" />
          Ver la dirección en el mapa
        </a>
      )}
    </div>
  );
}

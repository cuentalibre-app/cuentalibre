import { SPAIN, isOtherEuCountry, isValidEmail, storedTaxId, type WithholdingKind } from "@cuentalibre/core";
import type { Attachment, BankAccount, Contact, ContactRole, EInvoiceCodes } from "@cuentalibre/contracts";
import { formatDecimalInput, parseDecimal } from "@/lib/format";
import { countryOf, taxIdError } from "./contacts-model";

/** Radix Select can't hold an empty value: this stands for "no default". */
export const NO_DEFAULT = "default";

/** What the contact form edits: text as typed, parsed on save. */
export interface ContactDraft {
  taxId: string;
  name: string;
  country: string;
  vies: boolean;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  email: string;
  phone: string;
  mobile: string;
  fax: string;
  website: string;
  discount: string;
  /** A withholding kind or NO_DEFAULT. */
  withholding: string;
  /** A payment method id or NO_DEFAULT. */
  paymentMethodId: string;
  language: string;
  numberFormat: string;
  bankAccounts: BankAccount[];
  eInvoice: Required<EInvoiceCodes>;
  custom1: string;
  custom2: string;
  notes: string;
  tags: string[];
  attachments: Attachment[];
}

export type DraftErrorKey = "taxId" | "name" | "email" | "discount";
export type DraftErrors = Partial<Record<DraftErrorKey, string>>;

export function toDraft(contact: Contact | undefined): ContactDraft {
  return {
    taxId: contact?.taxId ?? "",
    name: contact?.name ?? "",
    country: contact ? countryOf(contact) : SPAIN,
    vies: contact?.vies ?? false,
    address: contact?.address ?? "",
    postalCode: contact?.postalCode ?? "",
    city: contact?.city ?? "",
    province: contact?.province ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    mobile: contact?.mobile ?? "",
    fax: contact?.fax ?? "",
    website: contact?.website ?? "",
    discount: contact?.discount ? formatDecimalInput(contact.discount) : "",
    withholding: contact?.withholding ?? NO_DEFAULT,
    paymentMethodId: contact?.paymentMethodId ?? NO_DEFAULT,
    language: contact?.language ?? "",
    numberFormat: contact?.numberFormat ?? "",
    bankAccounts: contact?.bankAccounts ?? [],
    eInvoice: {
      accountingOffice: contact?.eInvoice?.accountingOffice ?? "",
      managementBody: contact?.eInvoice?.managementBody ?? "",
      processingUnit: contact?.eInvoice?.processingUnit ?? "",
      proposingBody: contact?.eInvoice?.proposingBody ?? "",
    },
    custom1: contact?.custom1 ?? "",
    custom2: contact?.custom2 ?? "",
    notes: contact?.notes ?? "",
    tags: contact?.tags ?? [],
    attachments: contact?.attachments ?? [],
  };
}

/** Trimmed text, or undefined so empty fields don't clutter the record. */
const opt = (value: string) => value.trim() || undefined;

export function fromDraft(role: ContactRole, draft: ContactDraft, id: string): Contact {
  const discount = parseDecimal(draft.discount);
  const eInvoice = Object.fromEntries(
    Object.entries(draft.eInvoice)
      .map(([k, v]) => [k, v.trim().toUpperCase()])
      .filter(([, v]) => v),
  ) as EInvoiceCodes;
  return {
    id,
    taxId: storedTaxId(draft.taxId, draft.country),
    name: draft.name.trim(),
    country: draft.country,
    vies: isOtherEuCountry(draft.country) && draft.vies ? true : undefined,
    address: opt(draft.address),
    postalCode: opt(draft.postalCode),
    city: opt(draft.city),
    province: opt(draft.province),
    email: opt(draft.email),
    phone: opt(draft.phone),
    mobile: opt(draft.mobile),
    fax: opt(draft.fax),
    website: opt(draft.website),
    discount: discount ? discount : undefined,
    withholding: draft.withholding === NO_DEFAULT ? undefined : (draft.withholding as WithholdingKind),
    paymentMethodId: draft.paymentMethodId === NO_DEFAULT ? undefined : draft.paymentMethodId,
    // Document language and e-invoice codes only apply to what you issue
    language: role === "client" ? opt(draft.language) : undefined,
    numberFormat: role === "client" && draft.language ? opt(draft.numberFormat) : undefined,
    eInvoice: role === "client" && Object.keys(eInvoice).length ? eInvoice : undefined,
    bankAccounts: draft.bankAccounts.length ? draft.bankAccounts : undefined,
    custom1: opt(draft.custom1),
    custom2: opt(draft.custom2),
    notes: opt(draft.notes),
    tags: draft.tags.length ? draft.tags : undefined,
    attachments: draft.attachments.length ? draft.attachments : undefined,
  };
}

/** A repeated tax ID is not an error: the form warns about it instead (see DuplicateTaxIdNotice). */
export function validateDraft(draft: ContactDraft): DraftErrors {
  const errors: DraftErrors = {};
  errors.taxId = taxIdError(draft.taxId, draft.country);
  if (!draft.name.trim()) errors.name = "Introduce un nombre.";
  if (draft.email.trim() && !isValidEmail(draft.email)) errors.email = "El email no es correcto.";
  if (draft.discount.trim()) {
    const discount = parseDecimal(draft.discount);
    if (discount === null || discount < 0 || discount > 100)
      errors.discount = "El valor tiene que estar entre 0 y 100.";
  }
  return errors;
}

export const hasErrors = (errors: DraftErrors) => Object.values(errors).some(Boolean);

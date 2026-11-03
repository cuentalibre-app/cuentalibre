import {
  checkSpanishTaxId,
  formatIban,
  isValidEmail,
  isValidIban,
  missingIssuerFields,
  type IssuerField,
} from "@cuentalibre/core";
import type {
  BusinessKind,
  BusinessProfile,
  FiscalRegion,
  IncomeTaxMethod,
  PaymentMethod,
  PaymentMethodType,
  TaxSetup,
  VatRegime,
} from "@cuentalibre/contracts";
import type { BadgeProps } from "@cuentalibre/ui/components/badge";
import type { Option } from "@/features/sales/sales-model";
import { settingsStore, useSettings } from "./settings-store";

export const SETTINGS_PATH = "/configuracion";
export const BUSINESS_PATH = "/configuracion/empresa";
export const TAX_SETTINGS_PATH = "/configuracion/impuestos";
export const PAYMENT_METHODS_PATH = "/configuracion/formas-de-cobro-y-pago";
/** Old addresses of the payment methods, from when they hung from treasury accounts. */
export const OLD_PAYMENT_METHODS_PATHS = ["/configuracion/cuentas", "/configuracion/metodos-de-pago"];
export const INVOICE_SETTINGS_PATH = "/configuracion/facturas";
export const PROFILE_PATH = "/configuracion/datos-personales";
export const ACCESS_PATH = "/configuracion/credenciales";
export const DRAFT_SETTINGS_PATH = "/configuracion/facturas-borrador";
export const QUOTE_SETTINGS_PATH = "/configuracion/presupuestos";
export const DELIVERY_NOTE_SETTINGS_PATH = "/configuracion/albaranes";
export const LEDGER_ACCOUNTS_PATH = "/configuracion/cuentas-contables";
export const CONTACT_SETTINGS_PATH = "/configuracion/clientes-proveedores";
export const USERS_PATH = "/configuracion/usuarios";
export const TAGS_PATH = "/configuracion/etiquetas";
export const PREFERENCES_PATH = "/configuracion/ordenacion-y-filtrado";
export const EMAIL_TEMPLATES_PATH = "/configuracion/plantillas-correo";
export const API_KEYS_PATH = "/configuracion/api";
/** Where Stripe sends people back to, after paying or managing their subscription. */
export const BILLING_PATH = "/configuracion/plan";

/* ───────────────────────────── Business profile ───────────────────────────── */

export const BUSINESS_KINDS: Option<BusinessKind>[] = [
  { value: "selfEmployed", label: "Autónomo" },
  { value: "company", label: "Sociedad" },
];

export type ProfileErrors = Partial<Record<keyof BusinessProfile, string>>;

/** A self-employed worker files with their NIF or NIE; a company with its CIF. */
export function taxIdError(kind: BusinessKind, taxId: string): string | undefined {
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

/** What stops the profile from being saved: the tax ID, the name and a well-formed email. */
export function profileErrors(p: BusinessProfile): ProfileErrors {
  const errors: ProfileErrors = {};
  const taxId = taxIdError(p.kind, p.taxId);
  if (taxId) errors.taxId = taxId;
  if (p.kind === "selfEmployed") {
    if (!p.firstName.trim()) errors.firstName = "Introduce tu nombre.";
    if (!p.lastName.trim()) errors.lastName = "Introduce tu primer apellido.";
  } else if (!p.legalName.trim()) errors.legalName = "Introduce la razón social.";
  if (p.email.trim() && !isValidEmail(p.email)) errors.email = "El email no es válido.";
  return errors;
}

const ISSUER_FIELD_LABELS: Record<IssuerField, string> = {
  taxId: "el NIF",
  firstName: "el nombre",
  lastName: "el primer apellido",
  legalName: "la razón social",
  address: "la dirección",
  postalCode: "el código postal",
  city: "la población",
};

/**
 * What the profile lacks to issue invoices, with its verb, as in "falta el NIF"
 * or "faltan la dirección y el código postal"; null when it has it all.
 */
export function missingIssuerData(profile: BusinessProfile): string | null {
  const labels = missingIssuerFields(profile).map((field) => ISSUER_FIELD_LABELS[field]);
  if (labels.length === 0) return null;
  const list = new Intl.ListFormat("es", { type: "conjunction" }).format(labels);
  return `${labels.length === 1 ? "falta" : "faltan"} ${list}`;
}

/** Full name of a self-employed worker, or the company's legal name. */
export function fullName(profile: BusinessProfile): string {
  if (profile.kind === "company") return profile.legalName.trim();
  return [profile.firstName, profile.lastName, profile.secondLastName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
}

/** The name printed on invoices and reports. */
export const businessName = (profile: BusinessProfile) => profile.tradeName.trim() || fullName(profile);

/** The name on the account menu: the business name, or the email until the profile is filled in. */
export const accountName = (profile: BusinessProfile) => businessName(profile) || profile.email.trim();

/** "Calle del Pez 12, 3º B · 28004 Madrid", for the invoice header. */
export function addressLine(profile: BusinessProfile): string {
  const town = [profile.postalCode, profile.city]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
  return [profile.address.trim(), town].filter(Boolean).join(" · ");
}

export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

/* ───────────────────────────────── Taxes ───────────────────────────────── */

export const REGIONS: Option<FiscalRegion>[] = [
  { value: "peninsula", label: "España - Península y Baleares" },
  { value: "canarias", label: "España - Canarias" },
  { value: "ceutaMelilla", label: "España - Ceuta y Melilla" },
  { value: "navarra", label: "España - Navarra" },
  { value: "alava", label: "España - Álava" },
  { value: "vizcaya", label: "España - Vizcaya" },
  { value: "guipuzcoa", label: "España - Guipúzcoa" },
];

export const INCOME_TAX_METHODS: Option<IncomeTaxMethod>[] = [
  { value: "simplified", label: "Estimación directa simplificada" },
  { value: "normal", label: "Estimación directa normal" },
  { value: "modules", label: "Estimación objetiva (módulos)" },
];

export const VAT_REGIMES: Option<VatRegime>[] = [
  { value: "general", label: "Régimen general" },
  { value: "cashBasis", label: "Régimen especial del criterio de caja" },
  { value: "simplified", label: "Régimen simplificado (módulos)" },
  { value: "surcharge", label: "Régimen especial del recargo de equivalencia" },
];

const label = <T extends string>(options: Option<T>[], value: T) =>
  options.find((o) => o.value === value)?.label ?? value;
export const regionLabel = (region: FiscalRegion) => label(REGIONS, region);
export const incomeTaxMethodLabel = (method: IncomeTaxMethod) => label(INCOME_TAX_METHODS, method);
export const vatRegimeLabel = (regime: VatRegime) => label(VAT_REGIMES, regime);

/**
 * What the tax pages can't compute for this setup. cuentalibre prepares forms 303 and 130 of the
 * common territory, general VAT regime and direct estimation; anything else is flagged.
 */
export function unsupportedSetup(tax: Pick<TaxSetup, "region" | "incomeTaxMethod" | "vatRegime">): string[] {
  const notes: string[] = [];
  if (tax.region === "canarias") notes.push("En Canarias se aplica el IGIC en lugar del IVA (modelo 420).");
  if (tax.region === "ceutaMelilla") notes.push("En Ceuta y Melilla se aplica el IPSI en lugar del IVA.");
  if (["navarra", "alava", "vizcaya", "guipuzcoa"].includes(tax.region))
    notes.push("Los territorios forales tienen sus propios modelos y plazos de IVA e IRPF.");
  if (tax.incomeTaxMethod === "modules")
    notes.push("En módulos el pago fraccionado (modelo 131) no depende de tus ingresos y gastos.");
  if (tax.vatRegime === "simplified") notes.push("En el régimen simplificado la cuota de IVA se calcula por módulos.");
  if (tax.vatRegime === "surcharge")
    notes.push("En el recargo de equivalencia no se presenta el modelo 303: el IVA lo ingresa tu proveedor.");
  if (tax.vatRegime === "cashBasis")
    notes.push("Con criterio de caja el IVA se declara al cobrar y pagar; cuentalibre lo calcula todavía por devengo.");
  return notes;
}

/** Activity types of forms 036/037. Their epígrafes live in the lazily loaded IAE catalog. */
export const ACTIVITY_TYPES: { group: string; options: Option[] }[] = [
  {
    group: "Actividades incluidas en el IAE",
    options: [
      { value: "A01", label: "A01 - Arrendadores de bienes inmuebles" },
      { value: "A02", label: "A02 - Ganadería independiente" },
      { value: "A03", label: "A03 - Resto de actividades empresariales" },
      { value: "A04", label: "A04 - Actividades profesionales de carácter artístico o deportivo" },
      { value: "A05", label: "A05 - Resto de actividades profesionales" },
    ],
  },
  {
    group: "Actividades no incluidas en el IAE",
    options: [
      { value: "B01", label: "B01 - Actividad agrícola" },
      { value: "B02", label: "B02 - Actividad ganadera dependiente" },
      { value: "B03", label: "B03 - Actividad forestal" },
      { value: "B04", label: "B04 - Producción de mejillón en batea" },
      { value: "B05", label: "B05 - Actividad pesquera" },
      { value: "B06", label: "B06 - Otras actividades no sujetas al IAE" },
    ],
  },
  { group: "Otras", options: [{ value: "C", label: "C - Actividades no iniciadas" }] },
];

/** The options in effect for forms 130 and 100. */
export const taxOptions = () => ({ simplified: settingsStore.get().tax.incomeTaxMethod !== "normal" });

/* ───────────────────────────── Payment methods ───────────────────────────── */

export const METHOD_TYPES: Option<PaymentMethodType>[] = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Ingreso/Transferencia" },
  { value: "directDebit", label: "Recibo bancario" },
  { value: "promissory", label: "Pagaré/Cheque" },
  { value: "paypal", label: "PayPal" },
];

export const methodTypeLabel = (type: PaymentMethodType) => label(METHOD_TYPES, type);

export const ACTIVE_STATUS: Record<"active" | "inactive", { label: string; tone: BadgeProps["tone"] }> = {
  active: { label: "Activo", tone: "success" },
  inactive: { label: "Inactivo", tone: "neutral" },
};

/** Methods that go through a bank account, and so may name its IBAN. */
export const isBankMethod = (type: PaymentMethodType) =>
  type === "transfer" || type === "directDebit" || type === "promissory";

/** What the method's number holds; cash has none. */
export function numberLabel(type: PaymentMethodType): string | null {
  if (type === "cash") return null;
  if (type === "paypal") return "Email de PayPal";
  if (type === "card") return "Número de tarjeta";
  return "IBAN";
}

/** IBANs grouped in fours; card numbers masked; anything else as typed. */
export function displayNumber(method: Pick<PaymentMethod, "type" | "number">): string {
  if (isBankMethod(method.type) && isValidIban(method.number)) return formatIban(method.number);
  return method.type === "card" ? maskNumber(method.number) : method.number;
}

/** Masks all but the last four digits: "•••• 4821". Short numbers are shown whole. */
export function maskNumber(number: string): string {
  const digits = number.replace(/\s+/g, "");
  if (digits.length <= 4 || digits.includes("@")) return number;
  return `•••• ${digits.slice(-4)}`;
}

const sortDefaultFirst = (methods: PaymentMethod[], defaultId: string) =>
  [...methods].sort((a, b) => Number(b.id === defaultId) - Number(a.id === defaultId));

/** Every payment method, the default first. */
export function usePaymentMethods(): PaymentMethod[] {
  const { paymentMethods, defaultPaymentMethodId } = useSettings();
  return sortDefaultFirst(paymentMethods, defaultPaymentMethodId);
}

/*
 * Forms and lists read the methods when they render rather than subscribing: they only change
 * on the settings page, and every page renders afresh when it opens.
 */

/** Options for a payment method select: the active methods, default first, plus `currentId` if it was deactivated. */
export function paymentMethodOptions(currentId?: string): Option[] {
  const { paymentMethods, defaultPaymentMethodId } = settingsStore.get();
  return sortDefaultFirst(paymentMethods, defaultPaymentMethodId)
    .filter((m) => m.active || m.id === currentId)
    .map((m) => ({ value: m.id, label: m.active ? m.name : `${m.name} (inactivo)` }));
}

/** The method proposed on new documents: the default one while it's active. */
export function defaultPaymentMethodId(): string {
  const { paymentMethods, defaultPaymentMethodId: id } = settingsStore.get();
  return paymentMethods.find((m) => m.id === id && m.active)?.id ?? paymentMethods.find((m) => m.active)?.id ?? "";
}

export function paymentMethodName(id: string): string | undefined {
  return settingsStore.get().paymentMethods.find((m) => m.id === id)?.name;
}

/** Tax ID, bank account and email checks for clients and suppliers. */

/** EU member states by the Spanish name used in contact addresses, with their VAT number prefix. */
export const EU_VAT_PREFIXES: Record<string, string> = {
  Alemania: "DE",
  Austria: "AT",
  Bélgica: "BE",
  Bulgaria: "BG",
  Chipre: "CY",
  Croacia: "HR",
  Dinamarca: "DK",
  Eslovaquia: "SK",
  Eslovenia: "SI",
  España: "ES",
  Estonia: "EE",
  Finlandia: "FI",
  Francia: "FR",
  Grecia: "EL",
  Hungría: "HU",
  Irlanda: "IE",
  Italia: "IT",
  Letonia: "LV",
  Lituania: "LT",
  Luxemburgo: "LU",
  Malta: "MT",
  "Países Bajos": "NL",
  Polonia: "PL",
  Portugal: "PT",
  "República Checa": "CZ",
  Rumanía: "RO",
  Suecia: "SE",
};

export const SPAIN = "España";

/** Whether the country is an EU member state other than Spain. */
export function isOtherEuCountry(country: string): boolean {
  return country !== SPAIN && country in EU_VAT_PREFIXES;
}

/** Upper case, without the spaces, dots and hyphens people type in tax IDs and IBANs. */
export function normalizeTaxId(value: string): string {
  return value.toUpperCase().replace(/[\s.\-/]/g, "");
}

export type SpanishTaxIdKind = "nif" | "nie" | "cif";

export type TaxIdCheck =
  | { valid: true; kind: SpanishTaxIdKind | "foreign" }
  /** "format": not shaped like any Spanish tax ID; "checksum": the control character is wrong. */
  | { valid: false; reason: "empty" | "format" | "checksum" };

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
const CIF_LETTERS = "JABCDEFGHI";

/** Control letter of a DNI/NIE number. */
function dniLetter(digits: string): string {
  return DNI_LETTERS[Number(digits) % 23]!;
}

/** Control digit (0-9) of the seven digits of a CIF. */
function cifDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const n = Number(digits[i]);
    // Odd positions (1st, 3rd…) are doubled and their digits added
    if (i % 2 === 0) sum += Math.floor((n * 2) / 10) + ((n * 2) % 10);
    else sum += n;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Checks a Spanish NIF (DNI or K/L/M), NIE or company CIF, with or without the
 * "ES" prefix of the intra-EU VAT number. Validates the control character, so
 * typos are caught before they reach an invoice.
 */
export function checkSpanishTaxId(value: string): TaxIdCheck {
  const id = normalizeTaxId(value).replace(/^ES(?=[0-9A-Z]{9}$)/, "");
  if (!id) return { valid: false, reason: "empty" };

  let match = /^(\d{8})([A-Z])$/.exec(id);
  if (match) return match[2] === dniLetter(match[1]!) ? { valid: true, kind: "nif" } : checksum();

  // Special NIFs (minors, foreigners without NIE) use the DNI algorithm on seven digits
  match = /^[KLM](\d{7})([A-Z])$/.exec(id);
  if (match) return match[2] === dniLetter(match[1]!) ? { valid: true, kind: "nif" } : checksum();

  match = /^([XYZ])(\d{7})([A-Z])$/.exec(id);
  if (match) {
    const digits = String("XYZ".indexOf(match[1]!)) + match[2];
    return match[3] === dniLetter(digits) ? { valid: true, kind: "nie" } : checksum();
  }

  match = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(id);
  if (match) {
    const [, type, digits, control] = match;
    const digit = cifDigit(digits!);
    // Some entity types always use a letter, others always a digit; the rest accept both
    const asLetter = CIF_LETTERS[digit]!;
    const ok = "KPQRSNW".includes(type!)
      ? control === asLetter
      : "ABEH".includes(type!)
        ? control === String(digit)
        : control === asLetter || control === String(digit);
    return ok ? { valid: true, kind: "cif" } : checksum();
  }

  return { valid: false, reason: "format" };
}

function checksum(): TaxIdCheck {
  return { valid: false, reason: "checksum" };
}

/**
 * Checks a contact's tax ID for its country. Spanish ones are validated in
 * full; foreign ones only need to be letters and digits, since each country
 * has its own format.
 */
export function checkTaxId(value: string, country: string): TaxIdCheck {
  if (country === SPAIN) return checkSpanishTaxId(value);
  const id = normalizeTaxId(value);
  if (!id) return { valid: false, reason: "empty" };
  return /^[0-9A-Z]{2,20}$/.test(id) ? { valid: true, kind: "foreign" } : { valid: false, reason: "format" };
}

/**
 * Whether a foreign EU tax ID starts with its country's VAT prefix (DE…, FR…),
 * as an intra-EU invoice requires. Null outside the EU.
 */
export function hasEuVatPrefix(value: string, country: string): boolean | null {
  const prefix = EU_VAT_PREFIXES[country];
  if (!prefix || country === SPAIN) return null;
  return normalizeTaxId(value).startsWith(prefix);
}

/** "FR40303265045" → "Francia": the EU country a VAT number belongs to, by its prefix. Null for Spain or unknown. */
export function countryFromVatPrefix(value: string): string | null {
  const id = normalizeTaxId(value);
  if (!/^[A-Z]{2}[0-9A-Z]{2,}$/.test(id)) return null;
  const entry = Object.entries(EU_VAT_PREFIXES).find(([country, prefix]) => country !== SPAIN && id.startsWith(prefix));
  return entry ? entry[0] : null;
}

/** IBAN without spaces, validated with its ISO 7064 mod-97 check digits. */
export function isValidIban(value: string): boolean {
  const iban = normalizeTaxId(value);
  if (!/^[A-Z]{2}\d{2}[0-9A-Z]{10,30}$/.test(iban)) return false;
  if (iban.startsWith("ES") && iban.length !== 24) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const n = char >= "A" ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of n) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** "ES9121000418450200051332" → "ES91 2100 0418 4502 0005 1332". */
export function formatIban(value: string): string {
  return normalizeTaxId(value).replace(/(.{4})(?=.)/g, "$1 ");
}

/** A pragmatic check: something@domain.tld, without spaces. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export interface ContactIdentity {
  id?: string;
  taxId: string;
}

/** Whether another contact of the same list already has this tax ID. */
export function isDuplicateTaxId(contact: ContactIdentity, existing: ContactIdentity[]): boolean {
  const id = normalizeTaxId(contact.taxId).replace(/^ES/, "");
  if (!id) return false;
  return existing.some((c) => c.id !== contact.id && normalizeTaxId(c.taxId).replace(/^ES/, "") === id);
}

/** Spanish provinces by the first two digits of the postal code (INE order). */
const PROVINCES = [
  "Álava",
  "Albacete",
  "Alicante",
  "Almería",
  "Ávila",
  "Badajoz",
  "Illes Balears",
  "Barcelona",
  "Burgos",
  "Cáceres",
  "Cádiz",
  "Castellón",
  "Ciudad Real",
  "Córdoba",
  "A Coruña",
  "Cuenca",
  "Girona",
  "Granada",
  "Guadalajara",
  "Gipuzkoa",
  "Huelva",
  "Huesca",
  "Jaén",
  "León",
  "Lleida",
  "La Rioja",
  "Lugo",
  "Madrid",
  "Málaga",
  "Murcia",
  "Navarra",
  "Ourense",
  "Asturias",
  "Palencia",
  "Las Palmas",
  "Pontevedra",
  "Salamanca",
  "Santa Cruz de Tenerife",
  "Cantabria",
  "Segovia",
  "Sevilla",
  "Soria",
  "Tarragona",
  "Teruel",
  "Toledo",
  "Valencia",
  "Valladolid",
  "Bizkaia",
  "Zamora",
  "Zaragoza",
  "Ceuta",
  "Melilla",
];

/** "28012" → "Madrid". Null when it isn't a Spanish postal code. */
export function provinceFromPostalCode(postalCode: string): string | null {
  const match = /^(\d{2})\d{3}$/.exec(postalCode.trim());
  if (!match) return null;
  return PROVINCES[Number(match[1]) - 1] ?? null;
}

import { isValidIban, normalizeTaxId } from "./contacts";

/** Banks the app recognises from an IBAN, to show their logo. */
export type BankId =
  | "bbva"
  | "santander"
  | "caixabank"
  | "sabadell"
  | "bankinter"
  | "unicaja"
  | "kutxabank"
  | "ibercaja"
  | "revolut"
  | "n26"
  | "wise";

/** Spanish IBANs carry the Banco de España entity code in positions 5–8. */
const SPANISH_ENTITIES: Record<string, BankId> = {
  "0182": "bbva",
  "0049": "santander",
  "2100": "caixabank",
  "2038": "caixabank", // Bankia, merged into CaixaBank
  "0081": "sabadell",
  "0128": "bankinter",
  "2103": "unicaja",
  "2048": "unicaja", // Liberbank, merged into Unicaja
  "2095": "kutxabank",
  "2085": "ibercaja",
  "1583": "revolut",
};

/** Foreign IBANs common among Spanish freelancers: country code and the bank code that follows the check digits. */
const FOREIGN_BANKS: { country: string; code: string; bank: BankId }[] = [
  { country: "LT", code: "32500", bank: "revolut" },
  { country: "DE", code: "10011001", bank: "n26" },
  { country: "BE", code: "967", bank: "wise" },
];

/** The bank behind a full IBAN, or null when it isn't one or the bank isn't recognised. */
export function bankFromIban(value: string): BankId | null {
  if (!isValidIban(value)) return null;
  const iban = normalizeTaxId(value);
  const country = iban.slice(0, 2);
  const bban = iban.slice(4);
  if (country === "ES") return SPANISH_ENTITIES[bban.slice(0, 4)] ?? null;
  return FOREIGN_BANKS.find((b) => b.country === country && bban.startsWith(b.code))?.bank ?? null;
}

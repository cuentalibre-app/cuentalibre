import { eurosToCents, type Cents, type WithholdingKind } from "@fiscalia/core";

/** Sample business profile, tax setup, accounts and payment methods until there is a backend. Made up. */

export type BusinessKind = "selfEmployed" | "company";

export interface BusinessProfile {
  kind: BusinessKind;
  taxId: string;
  /** Self-employed: first name and surnames. Companies use `legalName` instead. */
  firstName: string;
  lastName: string;
  secondLastName: string;
  legalName: string;
  /** Name printed on invoices; empty falls back to the full name or legal name. */
  tradeName: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
  email: string;
  phone: string;
  website: string;
}

export type FiscalRegion = "peninsula" | "canarias" | "ceutaMelilla" | "navarra" | "alava" | "vizcaya" | "guipuzcoa";
export type IncomeTaxMethod = "simplified" | "normal" | "modules";
export type VatRegime = "general" | "cashBasis" | "simplified" | "surcharge";

export interface EconomicActivity {
  id: string;
  /** Activity type of forms 036/037: A01…A05, B01…B06 or C. */
  type: string;
  /** IAE epígrafe ("763"); empty for activities outside the IAE. */
  code: string;
  name: string;
}

export interface TaxSetup {
  region: FiscalRegion;
  incomeTaxMethod: IncomeTaxMethod;
  vatRegime: VatRegime;
  /** Ordered by volume: the first one is the main activity. */
  activities: EconomicActivity[];
  /** VAT rate proposed on new invoice lines, as a fraction. */
  defaultVatRate: number;
  /** IRPF withholding proposed on new invoices; a client's own default wins. */
  defaultWithholding: WithholdingKind;
  /** Monthly self-employed fee (RETA). */
  socialSecurityFee: Cents;
  /** Client that groups sales to unidentified customers ("Clientes varios"). */
  variousClientsId: string | null;
}

export type AccountKind = "bank" | "cash" | "paypal" | "card";

export interface TreasuryAccount {
  id: string;
  kind: AccountKind;
  name: string;
  /** IBAN, card number (often its last digits) or PayPal email. */
  number: string;
  active: boolean;
}

export type PaymentMethodType = "cash" | "card" | "transfer" | "directDebit" | "promissory" | "paypal";

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  name: string;
  /** Account or card number the money goes through; may hold only the last four digits. */
  number: string;
  /** Treasury account it books into, if any. */
  accountId: string | null;
  active: boolean;
}

export const initialProfile: BusinessProfile = {
  kind: "selfEmployed",
  taxId: "50123456Q",
  firstName: "Lucía",
  lastName: "Martín",
  secondLastName: "Ortega",
  legalName: "",
  tradeName: "Lucía Martín",
  address: "Calle del Pez 12, 3º B",
  postalCode: "28004",
  city: "Madrid",
  province: "Madrid",
  country: "España",
  email: "hola@luciamartin.es",
  phone: "612 345 678",
  website: "luciamartin.es",
};

export const initialTaxSetup: TaxSetup = {
  region: "peninsula",
  incomeTaxMethod: "simplified",
  vatRegime: "general",
  activities: [
    { id: "act1", type: "A05", code: "751", name: "Profesionales de la Publicidad, relaciones publicas y similares." },
  ],
  defaultVatRate: 0.21,
  defaultWithholding: "professional",
  socialSecurityFee: eurosToCents(294),
  variousClientsId: null,
};

export const initialAccounts: TreasuryAccount[] = [
  { id: "acc-main", kind: "bank", name: "Cuenta principal", number: "ES91 2100 0418 4502 0005 1332", active: true },
  { id: "acc-cash", kind: "cash", name: "Efectivo / Caja", number: "", active: true },
  { id: "acc-card", kind: "card", name: "Tarjeta de empresa", number: "4821", active: true },
];

/** The ids are referenced by the sample documents and contacts. */
export const initialPaymentMethods: PaymentMethod[] = [
  {
    id: "transfer",
    type: "transfer",
    name: "Ingreso/Transferencia",
    number: "ES91 2100 0418 4502 0005 1332",
    accountId: "acc-main",
    active: true,
  },
  { id: "bank1", type: "directDebit", name: "Cuenta principal", number: "1332", accountId: "acc-main", active: true },
  { id: "card", type: "card", name: "Tarjeta", number: "4821", accountId: "acc-card", active: true },
  { id: "cash", type: "cash", name: "Efectivo", number: "", accountId: "acc-cash", active: true },
];

export const initialDefaultPaymentMethodId = "transfer";

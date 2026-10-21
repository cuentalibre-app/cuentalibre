import { eurosToCents } from "@cuentalibre/core";
import type { BusinessProfile, PaymentMethod, TaxSetup, TreasuryAccount } from "@cuentalibre/contracts";

/** Sample business profile, tax setup, accounts and payment methods until there is a backend. Made up. */

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

import type { WithholdingKind } from "@fiscalia/core";
import type { Attachment } from "./sales";

/** Sample clients and suppliers until there is a backend. Names, tax IDs and figures are made up. */

export type ContactRole = "client" | "supplier";

export interface BankAccount {
  id: string;
  /** Without spaces. */
  iban: string;
  bic?: string;
  notes?: string;
  /** The account used for direct debits and printed on documents. */
  isDefault: boolean;
}

/** Codes of the public body that receives an electronic invoice through FACe (DIR3). */
export interface EInvoiceCodes {
  accountingOffice?: string;
  managementBody?: string;
  processingUnit?: string;
  proposingBody?: string;
}

export interface Contact {
  id: string;
  /** Name or company name. */
  name: string;
  /** NIF, or VAT number for EU contacts. */
  taxId: string;
  address?: string;
  postalCode?: string;
  /** Town (población). */
  city?: string;
  province?: string;
  /** Spanish name of the country, as in COUNTRIES; Spain when missing. */
  country?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  website?: string;
  /** Registered in the EU VAT information exchange system (VIES), for intra-EU operations. */
  vies?: boolean;
  /** Default discount on document lines, as a whole percentage. */
  discount?: number;
  /** Income-tax withholding applied by default on their documents. */
  withholding?: WithholdingKind;
  paymentMethodId?: string;
  /** Clients only: default language and number format of documents; empty uses the document's own. */
  language?: string;
  numberFormat?: string;
  bankAccounts?: BankAccount[];
  eInvoice?: EInvoiceCodes;
  /** Free fields, named in the contacts settings. */
  custom1?: string;
  custom2?: string;
  notes?: string;
  tags?: string[];
  attachments?: Attachment[];
}

export const initialClients: Contact[] = [
  {
    id: "c1",
    name: "Estudio Norte S.L.",
    taxId: "B12345674",
    email: "facturas@estudionorte.es",
    phone: "944 123 456",
    website: "estudionorte.es",
    address: "Gran Vía 45, 2º",
    city: "Bilbao",
    province: "Bizkaia",
    postalCode: "48011",
    country: "España",
    withholding: "professional",
    paymentMethodId: "transfer",
    bankAccounts: [{ id: "b1", iban: "ES9121000418450200051332", bic: "CAIXESBBXXX", isDefault: true }],
    tags: ["Recurrente"],
    notes: "Facturar el día 1 de cada mes. Contacto: Iker Etxeberria.",
  },
  {
    id: "c2",
    name: "Agencia Brisa S.L.",
    taxId: "B87654323",
    email: "admin@agenciabrisa.com",
    address: "Calle Colón 8",
    city: "Valencia",
    province: "Valencia",
    postalCode: "46004",
    country: "España",
    withholding: "professional",
    discount: 5,
  },
  {
    id: "c3",
    name: "Talleres Ruiz S.C.",
    taxId: "J11223344",
    phone: "976 555 010",
    mobile: "650 120 340",
    address: "Polígono Malpica, nave 14",
    city: "Zaragoza",
    province: "Zaragoza",
    postalCode: "50016",
    country: "España",
    withholding: "professional",
  },
  {
    id: "c4",
    name: "Lumen Software S.A.",
    taxId: "A55667786",
    email: "accounts@lumensoftware.es",
    address: "Calle Serrano 90",
    city: "Madrid",
    province: "Madrid",
    postalCode: "28006",
    country: "España",
    withholding: "professional",
    tags: ["Recurrente"],
  },
  {
    id: "c5",
    name: "Marta Gil Oliva",
    taxId: "12345678Z",
    email: "marta.gil@correo.es",
    mobile: "611 222 333",
    country: "España",
    notes: "Particular: sin retención.",
  },
  {
    id: "c6",
    name: "Nordlicht GmbH",
    taxId: "DE123456789",
    email: "billing@nordlicht.de",
    address: "Torstraße 120",
    city: "Berlin",
    province: "Berlin",
    postalCode: "10119",
    country: "Alemania",
    vies: true,
    language: "en",
    numberFormat: "GB",
  },
];

export const initialSuppliers: Contact[] = [
  {
    id: "s1",
    name: "Coworking La Nave S.L.",
    taxId: "B86543212",
    email: "facturacion@lanave.es",
    address: "Calle Embajadores 52",
    city: "Madrid",
    province: "Madrid",
    postalCode: "28012",
    country: "España",
    paymentMethodId: "bank1",
  },
  {
    id: "s2",
    name: "Ana Arce Molina (Gestoría Arce)",
    taxId: "02345678T",
    email: "ana@gestoriaarce.es",
    phone: "915 554 320",
    address: "Calle Atocha 30, 1º",
    city: "Madrid",
    province: "Madrid",
    postalCode: "28012",
    country: "España",
    withholding: "professional",
    tags: ["Asesoría"],
  },
  {
    id: "s3",
    name: "Telefonía Meseta S.A.",
    taxId: "A28765436",
    address: "Ronda de la Comunicación s/n",
    city: "Madrid",
    province: "Madrid",
    postalCode: "28050",
    country: "España",
    paymentMethodId: "bank1",
  },
  {
    id: "s4",
    name: "Adobe Systems Software Ireland Ltd",
    taxId: "IE6364992H",
    address: "4-6 Riverwalk, Citywest",
    city: "Dublin",
    postalCode: "D24",
    country: "Irlanda",
    vies: true,
    paymentMethodId: "card",
  },
  {
    id: "s5",
    name: "Amazon Web Services EMEA SARL",
    taxId: "LU26888617",
    address: "38 Avenue John F. Kennedy",
    city: "Luxembourg",
    postalCode: "L-1855",
    country: "Luxemburgo",
    vies: true,
    paymentMethodId: "card",
  },
  {
    id: "s6",
    name: "Estación de Servicio Los Pinos S.L.",
    taxId: "B45123981",
    address: "Carretera de Toledo km 12",
    city: "Leganés",
    province: "Madrid",
    postalCode: "28914",
    country: "España",
  },
  {
    id: "s7",
    name: "Papelería Central",
    taxId: "50987654N",
    address: "Calle Mayor 14",
    city: "Madrid",
    province: "Madrid",
    postalCode: "28013",
    country: "España",
  },
  {
    id: "s8",
    name: "Seguros Atlántico S.A.",
    taxId: "A15234560",
    email: "clientes@segurosatlantico.es",
    city: "A Coruña",
    province: "A Coruña",
    postalCode: "15003",
    country: "España",
  },
  {
    id: "s9",
    name: "Tecnoplaza Informática S.L.",
    taxId: "B30456784",
    city: "Murcia",
    province: "Murcia",
    postalCode: "30008",
    country: "España",
  },
  {
    id: "s10",
    name: "Transitarios del Sur S.L.",
    taxId: "B11223450",
    city: "Algeciras",
    province: "Cádiz",
    postalCode: "11207",
    country: "España",
  },
  {
    id: "s11",
    name: "Luis Ortega Prado",
    taxId: "51234567C",
    address: "Calle de Embajadores 140",
    city: "Madrid",
    province: "Madrid",
    postalCode: "28045",
    country: "España",
    withholding: "rental",
    notes: "Alquiler del almacén donde guardo el material de fotografía.",
  },
];

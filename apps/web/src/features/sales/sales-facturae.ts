import { SPAIN, WITHHOLDING_RATES, facturaeXml, type FacturaeAddress } from "@fiscalia/core";
import type { PaymentMethodType, SalesDocument } from "@fiscalia/contracts";
import { businessName } from "@/features/settings/settings-model";
import { settingsStore } from "@/features/settings/settings-store";
import { salesStore } from "./sales-store";
import { clientOf, documentFileName } from "./sales-model";

/* Facturae export of an issued invoice, built in core; this file only maps the app's data. */

/** ISO 3166-1 alpha-3 of the countries offered in contact addresses. */
const ALPHA3: Record<string, string> = {
  [SPAIN]: "ESP",
  Alemania: "DEU",
  Austria: "AUT",
  Bélgica: "BEL",
  Bulgaria: "BGR",
  Chipre: "CYP",
  Croacia: "HRV",
  Dinamarca: "DNK",
  Eslovaquia: "SVK",
  Eslovenia: "SVN",
  Estonia: "EST",
  Finlandia: "FIN",
  Francia: "FRA",
  Grecia: "GRC",
  Hungría: "HUN",
  Irlanda: "IRL",
  Italia: "ITA",
  Letonia: "LVA",
  Lituania: "LTU",
  Luxemburgo: "LUX",
  Malta: "MLT",
  "Países Bajos": "NLD",
  Polonia: "POL",
  Portugal: "PRT",
  "República Checa": "CZE",
  Rumanía: "ROU",
  Suecia: "SWE",
  Andorra: "AND",
  "Arabia Saudí": "SAU",
  Argentina: "ARG",
  Australia: "AUS",
  Bolivia: "BOL",
  Brasil: "BRA",
  Canadá: "CAN",
  Chile: "CHL",
  China: "CHN",
  Colombia: "COL",
  "Corea del Sur": "KOR",
  "Costa Rica": "CRI",
  Cuba: "CUB",
  Ecuador: "ECU",
  Egipto: "EGY",
  "Emiratos Árabes Unidos": "ARE",
  "Estados Unidos": "USA",
  Filipinas: "PHL",
  Gibraltar: "GIB",
  Guatemala: "GTM",
  Honduras: "HND",
  "Hong Kong": "HKG",
  India: "IND",
  Indonesia: "IDN",
  Islandia: "ISL",
  Israel: "ISR",
  Japón: "JPN",
  Liechtenstein: "LIE",
  Marruecos: "MAR",
  México: "MEX",
  Mónaco: "MCO",
  Nicaragua: "NIC",
  Noruega: "NOR",
  "Nueva Zelanda": "NZL",
  Panamá: "PAN",
  Paraguay: "PRY",
  Perú: "PER",
  "Puerto Rico": "PRI",
  "Reino Unido": "GBR",
  "República Dominicana": "DOM",
  "San Marino": "SMR",
  Singapur: "SGP",
  Sudáfrica: "ZAF",
  Suiza: "CHE",
  Tailandia: "THA",
  Túnez: "TUN",
  Turquía: "TUR",
  Ucrania: "UKR",
  Uruguay: "URY",
  Venezuela: "VEN",
};

const PAYMENT_MEANS: Record<PaymentMethodType, string> = {
  cash: "01",
  directDebit: "02",
  transfer: "04",
  promissory: "11",
  card: "19",
  paypal: "13",
};

function address(a: {
  address?: string;
  postalCode?: string;
  city?: string;
  province?: string;
  country?: string;
}): FacturaeAddress {
  return {
    address: a.address?.trim() ?? "",
    postCode: a.postalCode?.trim() ?? "",
    town: a.city?.trim() ?? "",
    province: a.province?.trim() ?? "",
    countryCode: ALPHA3[a.country || SPAIN] ?? "ESP",
  };
}

/** What Facturae needs that the invoice doesn't have, so the file would be rejected. */
export function facturaeProblems(doc: SalesDocument): string[] {
  const { profile } = settingsStore.get();
  const client = clientOf(doc);
  const problems: string[] = [];
  if (!profile.address.trim() || !profile.postalCode.trim() || !profile.city.trim())
    problems.push("tu dirección completa (Configuración › Empresa)");
  if (!client.address?.trim() || !client.postalCode?.trim() || !client.city?.trim())
    problems.push(`la dirección completa de ${client.name}`);
  return problems;
}

export function downloadFacturae(doc: SalesDocument) {
  const { profile, paymentMethods } = settingsStore.get();
  const client = clientOf(doc);
  const method = paymentMethods.find((m) => m.id === (doc.payments?.at(-1)?.paymentMethodId ?? client.paymentMethodId));
  const corrected = doc.rectifiesId ? salesStore.all().find((d) => d.id === doc.rectifiesId) : undefined;

  const xml = facturaeXml({
    number: doc.number ?? "",
    issueDate: doc.issuedOn,
    operationDate: doc.operationOn,
    dueDate: doc.dueOn,
    seller: {
      taxId: profile.taxId,
      name: businessName(profile),
      individual:
        profile.kind === "selfEmployed"
          ? { name: profile.firstName, firstSurname: profile.lastName, secondSurname: profile.secondLastName }
          : undefined,
      tradeName: profile.tradeName || undefined,
      address: address(profile),
      email: profile.email || undefined,
    },
    buyer: {
      taxId: client.taxId,
      name: client.name,
      address: address(client),
      email: client.email,
      centres: client.eInvoice,
    },
    lines: doc.lines.map((l) => ({
      ...l,
      description: [l.concept, l.detail].filter(Boolean).join("\n"),
      periodFrom: l.serviceFrom,
      periodTo: l.serviceTo,
    })),
    withholdingRate: WITHHOLDING_RATES[doc.withholding],
    supplies: doc.supplies,
    paymentMeans: method ? PAYMENT_MEANS[method.type] : undefined,
    corrects: corrected?.number ? { number: corrected.number, issueDate: corrected.issuedOn } : undefined,
    notes: doc.publicNotes,
  });

  const url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
  Object.assign(document.createElement("a"), { href: url, download: documentFileName(doc, "xml") }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

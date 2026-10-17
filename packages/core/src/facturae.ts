import { lineBase, roundCents, type InvoiceLine } from "./invoices";

/*
 * Facturae 3.2.2: the XML electronic invoice the Spanish public administration
 * receives through FACe. The file comes out unsigned; it has to be signed
 * (XAdES, for example with AutoFirma) before it is uploaded.
 */

export const FACTURAE_NAMESPACE = "http://www.facturae.gob.es/formato/Versiones/Facturaev3_2_2.xml";

/** EU member states other than Spain, as ISO 3166-1 alpha-3 codes. */
const EU_ALPHA3 = new Set([
  "AUT", "BEL", "BGR", "CYP", "CZE", "DEU", "DNK", "EST", "FIN", "FRA", "GRC", "HRV", "HUN", "IRL",
  "ITA", "LTU", "LUX", "LVA", "MLT", "NLD", "POL", "PRT", "ROU", "SVK", "SVN", "SWE",
]); // prettier-ignore

export interface FacturaeAddress {
  address: string;
  postCode: string;
  town: string;
  province: string;
  /** ISO 3166-1 alpha-3: "ESP", "FRA"… */
  countryCode: string;
}

/** Role of a public body's administrative centre (DIR3) in FACe. */
export type FacturaeCentreRole = "accountingOffice" | "managementBody" | "processingUnit" | "proposingBody";

const CENTRE_ROLE_CODES: Record<FacturaeCentreRole, string> = {
  accountingOffice: "01",
  managementBody: "02",
  processingUnit: "03",
  proposingBody: "04",
};

export interface FacturaeParty {
  taxId: string;
  /** Full name of a person, or company name. */
  name: string;
  /** Self-employed seller: name and surnames as separate fields. */
  individual?: { name: string; firstSurname: string; secondSurname?: string };
  tradeName?: string;
  address: FacturaeAddress;
  email?: string;
  /** DIR3 codes of a public body; FACe needs at least the first three roles. */
  centres?: Partial<Record<FacturaeCentreRole, string>>;
}

export interface FacturaeLine extends InvoiceLine {
  description: string;
  /** Service period, ISO dates. */
  periodFrom?: string;
  periodTo?: string;
}

export interface FacturaeInvoice {
  number: string;
  /** ISO dates. */
  issueDate: string;
  operationDate?: string | null;
  dueDate?: string | null;
  seller: FacturaeParty;
  buyer: FacturaeParty;
  lines: FacturaeLine[];
  /** IRPF withholding as a fraction of the taxable base. */
  withholdingRate: number;
  /** Expenses paid on the client's behalf (suplidos), outside the taxable base. */
  supplies?: number;
  /** Payment means code of Facturae: 04 transfer, 02 direct debit, 01 cash, 19 card… */
  paymentMeans?: string;
  /** The invoice this one corrects, for rectifying invoices. */
  corrects?: { number: string; issueDate: string };
  notes?: string;
}

/**
 * Person type from a Spanish tax ID: NIF and NIE belong to people (F), CIF to
 * legal entities (J). Foreign IDs are taken as legal entities.
 */
export function facturaePersonType(taxId: string, countryCode = "ESP"): "F" | "J" {
  if (countryCode !== "ESP") return "J";
  return /^[0-9KLMXYZ]/i.test(taxId.trim()) ? "F" : "J";
}

/** Resident in Spain (R), in another EU state (U) or elsewhere (E). */
export function facturaeResidence(countryCode: string): "R" | "U" | "E" {
  if (countryCode === "ESP") return "R";
  return EU_ALPHA3.has(countryCode) ? "U" : "E";
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Facturae decimals use a dot and a fixed number of places. */
const fixed = (value: number, places = 2) => (Math.abs(value) < 1e-9 ? 0 : value).toFixed(places);
const ratePercent = (rate: number) => fixed(rate * 100);

/** Element with escaped text; empty values are left out. */
function el(name: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "";
  return `<${name}>${escape(String(value))}</${name}>`;
}

/** Only children that produced output. */
const wrap = (name: string, ...children: string[]) => {
  const body = children.join("");
  return body ? `<${name}>${body}</${name}>` : "";
};

function addressXml(a: FacturaeAddress): string {
  return a.countryCode === "ESP"
    ? wrap(
        "AddressInSpain",
        el("Address", a.address),
        el("PostCode", a.postCode),
        el("Town", a.town),
        el("Province", a.province || a.town),
        el("CountryCode", "ESP"),
      )
    : wrap(
        "OverseasAddress",
        el("Address", a.address),
        el("PostCodeAndTown", [a.postCode, a.town].filter(Boolean).join(" ")),
        el("Province", a.province || a.town),
        el("CountryCode", a.countryCode),
      );
}

function partyXml(party: FacturaeParty): string {
  const personType = party.individual ? "F" : facturaePersonType(party.taxId, party.address.countryCode);
  const contact = party.email ? wrap("ContactDetails", el("ElectronicMail", party.email)) : "";

  const centres = Object.entries(party.centres ?? {})
    .filter(([, code]) => code?.trim())
    .map(([role, code]) =>
      wrap(
        "AdministrativeCentre",
        el("CentreCode", code!.trim()),
        el("RoleTypeCode", CENTRE_ROLE_CODES[role as FacturaeCentreRole]),
        addressXml(party.address),
      ),
    )
    .join("");

  let entity: string;
  if (personType === "F") {
    // People without separate surnames: the first word is the name, the rest the surnames
    const [first = "", second = "", ...rest] = party.name.trim().split(/\s+/);
    const person = party.individual ?? { name: first, firstSurname: second, secondSurname: rest.join(" ") };
    entity = wrap(
      "Individual",
      el("Name", person.name),
      el("FirstSurname", person.firstSurname || person.name),
      el("SecondSurname", person.secondSurname),
      addressXml(party.address),
      contact,
    );
  } else {
    entity = wrap(
      "LegalEntity",
      el("CorporateName", party.name),
      el("TradeName", party.tradeName !== party.name ? party.tradeName : undefined),
      addressXml(party.address),
      contact,
    );
  }

  return (
    wrap(
      "TaxIdentification",
      el("PersonTypeCode", personType),
      el("ResidenceTypeCode", facturaeResidence(party.address.countryCode)),
      el("TaxIdentificationNumber", party.taxId.trim().toUpperCase()),
    ) +
    wrap("AdministrativeCentres", centres) +
    entity
  );
}

interface TaxGroup {
  vatRate: number;
  surchargeRate: number;
  base: number;
}

/** Bases grouped by VAT and surcharge rate, highest VAT first, as the invoice shows them. */
function taxGroups(lines: FacturaeLine[]): (TaxGroup & { vat: number; surcharge: number })[] {
  const groups = new Map<string, TaxGroup>();
  for (const line of lines) {
    const surchargeRate = line.surchargeRate ?? 0;
    const key = `${line.vatRate}|${surchargeRate}`;
    const group = groups.get(key) ?? { vatRate: line.vatRate, surchargeRate, base: 0 };
    group.base += lineBase(line);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => b.vatRate - a.vatRate || b.surchargeRate - a.surchargeRate)
    .map((g) => {
      const base = roundCents(g.base);
      return { ...g, base, vat: roundCents(base * g.vatRate), surcharge: roundCents(base * g.surchargeRate) };
    });
}

function outputTax(vatRate: number, base: number, vat: number, surchargeRate = 0, surcharge = 0): string {
  return wrap(
    "Tax",
    el("TaxTypeCode", "01"),
    el("TaxRate", ratePercent(vatRate)),
    wrap("TaxableBase", el("TotalAmount", fixed(base))),
    wrap("TaxAmount", el("TotalAmount", fixed(vat))),
    surchargeRate ? el("EquivalenceSurcharge", ratePercent(surchargeRate)) : "",
    surchargeRate ? wrap("EquivalenceSurchargeAmount", el("TotalAmount", fixed(surcharge))) : "",
  );
}

function withheldTax(rate: number, base: number, amount: number): string {
  return wrap(
    "Tax",
    el("TaxTypeCode", "04"),
    el("TaxRate", ratePercent(rate)),
    wrap("TaxableBase", el("TotalAmount", fixed(base))),
    wrap("TaxAmount", el("TotalAmount", fixed(amount))),
  );
}

function lineXml(line: FacturaeLine, withholdingRate: number): string {
  const totalCost = roundCents(line.unitPrice * line.quantity);
  const gross = lineBase(line);
  const discount = roundCents(totalCost - gross);
  const surchargeRate = line.surchargeRate ?? 0;
  return wrap(
    "InvoiceLine",
    el("ItemDescription", line.description),
    el("Quantity", fixed(line.quantity, 2)),
    el("UnitPriceWithoutTax", fixed(line.unitPrice, 6)),
    el("TotalCost", fixed(totalCost)),
    line.discount
      ? wrap(
          "DiscountsAndRebates",
          wrap(
            "Discount",
            el("DiscountReason", "Descuento"),
            el("DiscountRate", fixed(line.discount * 100, 4)),
            el("DiscountAmount", fixed(discount)),
          ),
        )
      : "",
    el("GrossAmount", fixed(gross)),
    withholdingRate
      ? wrap("TaxesWithheld", withheldTax(withholdingRate, gross, roundCents(gross * withholdingRate)))
      : "",
    wrap(
      "TaxesOutputs",
      outputTax(
        line.vatRate,
        gross,
        roundCents(gross * line.vatRate),
        surchargeRate,
        roundCents(gross * surchargeRate),
      ),
    ),
    line.periodFrom && line.periodTo
      ? wrap("LineItemPeriod", el("StartDate", line.periodFrom), el("EndDate", line.periodTo))
      : "",
  );
}

/** The Facturae 3.2.2 XML of one invoice, as a single batch (modality I) issued by the seller (EM). */
export function facturaeXml(invoice: FacturaeInvoice): string {
  const groups = taxGroups(invoice.lines);
  const base = roundCents(groups.reduce((acc, g) => acc + g.base, 0));
  const taxOutputs = roundCents(groups.reduce((acc, g) => acc + g.vat + g.surcharge, 0));
  const withheld = roundCents(base * invoice.withholdingRate);
  const invoiceTotal = roundCents(base + taxOutputs - withheld);
  const supplies = roundCents(invoice.supplies ?? 0);
  const outstanding = roundCents(invoiceTotal + supplies);

  const header = wrap(
    "InvoiceHeader",
    el("InvoiceNumber", invoice.number),
    el("InvoiceDocumentType", "FC"),
    el("InvoiceClass", invoice.corrects ? "OR" : "OO"),
    invoice.corrects
      ? wrap(
          "Corrective",
          el("InvoiceNumber", invoice.corrects.number),
          el("ReasonCode", "01"),
          el("ReasonDescription", "Número de la factura"),
          wrap("TaxPeriod", el("StartDate", invoice.corrects.issueDate), el("EndDate", invoice.corrects.issueDate)),
          el("CorrectionMethod", "01"),
          el("CorrectionMethodDescription", "Rectificación íntegra"),
        )
      : "",
  );

  const totals = wrap(
    "InvoiceTotals",
    el("TotalGrossAmount", fixed(base)),
    el("TotalGrossAmountBeforeTaxes", fixed(base)),
    el("TotalTaxOutputs", fixed(taxOutputs)),
    el("TotalTaxesWithheld", fixed(withheld)),
    el("InvoiceTotal", fixed(invoiceTotal)),
    supplies
      ? wrap("ReimbursableExpenses", wrap("ReimbursableExpenses", el("ReimbursableExpensesAmount", fixed(supplies))))
      : "",
    el("TotalOutstandingAmount", fixed(outstanding)),
    el("TotalExecutableAmount", fixed(outstanding)),
    supplies ? el("TotalReimbursableExpenses", fixed(supplies)) : "",
  );

  const body = wrap(
    "Invoice",
    header,
    wrap(
      "InvoiceIssueData",
      el("IssueDate", invoice.issueDate),
      invoice.operationDate && invoice.operationDate !== invoice.issueDate
        ? el("OperationDate", invoice.operationDate)
        : "",
      el("InvoiceCurrencyCode", "EUR"),
      el("TaxCurrencyCode", "EUR"),
      el("LanguageName", "es"),
    ),
    wrap("TaxesOutputs", ...groups.map((g) => outputTax(g.vatRate, g.base, g.vat, g.surchargeRate, g.surcharge))),
    invoice.withholdingRate ? wrap("TaxesWithheld", withheldTax(invoice.withholdingRate, base, withheld)) : "",
    totals,
    wrap("Items", ...invoice.lines.map((l) => lineXml(l, invoice.withholdingRate))),
    invoice.dueDate
      ? wrap(
          "PaymentDetails",
          wrap(
            "Installment",
            el("InstallmentDueDate", invoice.dueDate),
            el("InstallmentAmount", fixed(outstanding)),
            el("PaymentMeans", invoice.paymentMeans ?? "04"),
          ),
        )
      : "",
    invoice.notes?.trim() ? wrap("AdditionalData", el("InvoiceAdditionalInformation", invoice.notes.trim())) : "",
  );

  const batch = wrap(
    "Batch",
    el("BatchIdentifier", `${invoice.seller.taxId.trim().toUpperCase()}${invoice.number}`),
    el("InvoicesCount", 1),
    wrap("TotalInvoicesAmount", el("TotalAmount", fixed(invoiceTotal))),
    wrap("TotalOutstandingAmount", el("TotalAmount", fixed(outstanding))),
    wrap("TotalExecutableAmount", el("TotalAmount", fixed(outstanding))),
    el("InvoiceCurrencyCode", "EUR"),
  );

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<fe:Facturae xmlns:fe="${FACTURAE_NAMESPACE}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
    wrap("FileHeader", el("SchemaVersion", "3.2.2"), el("Modality", "I"), el("InvoiceIssuerType", "EM"), batch) +
    wrap("Parties", wrap("SellerParty", partyXml(invoice.seller)), wrap("BuyerParty", partyXml(invoice.buyer))) +
    wrap("Invoices", body) +
    `</fe:Facturae>\n`
  );
}

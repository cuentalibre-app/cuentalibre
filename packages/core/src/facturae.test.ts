import { describe, expect, it } from "vitest";
import { facturaePersonType, facturaeResidence, facturaeXml, type FacturaeInvoice } from "./facturae";
import { eurosToCents } from "./money";

const eur = eurosToCents;

const invoice: FacturaeInvoice = {
  number: "2026-0009",
  issueDate: "2026-10-01",
  dueDate: "2026-10-31",
  seller: {
    taxId: "50123456Q",
    name: "Lucía Martín Gómez",
    individual: { name: "Lucía", firstSurname: "Martín", secondSurname: "Gómez" },
    address: { address: "Calle del Pez 12", postCode: "28004", town: "Madrid", province: "Madrid", countryCode: "ESP" },
  },
  buyer: {
    taxId: "P2807900B",
    name: "Ayuntamiento de Madrid & Co",
    address: {
      address: "Calle Montalbán 1",
      postCode: "28014",
      town: "Madrid",
      province: "Madrid",
      countryCode: "ESP",
    },
    centres: { accountingOffice: "L01280796", managementBody: "L01280796", processingUnit: "LA0002001" },
  },
  lines: [
    { description: "Consultoría", unitPrice: 65, quantity: 10, discount: 0.1, vatRate: 0.21 },
    { description: "Libro", unitPrice: 20, quantity: 1, discount: 0, vatRate: 0.04 },
  ],
  withholdingRate: 0.15,
};

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1];

describe("facturaeXml", () => {
  const xml = facturaeXml(invoice);

  it("adds up base, taxes and withholding", () => {
    // 585 + 20 base; 122,85 + 0,80 VAT; 90,75 withheld
    expect(tag(xml, "TotalGrossAmountBeforeTaxes")).toBe("605.00");
    expect(tag(xml, "TotalTaxOutputs")).toBe("123.65");
    expect(tag(xml, "TotalTaxesWithheld")).toBe("90.75");
    expect(tag(xml, "InvoiceTotal")).toBe("637.90");
    expect(tag(xml, "InstallmentAmount")).toBe("637.90");
  });

  it("describes the line discount", () => {
    expect(xml).toContain("<TotalCost>650.00</TotalCost>");
    expect(xml).toContain("<DiscountRate>10.0000</DiscountRate><DiscountAmount>65.00</DiscountAmount>");
    expect(xml).toContain("<GrossAmount>585.00</GrossAmount>");
  });

  it("writes the parties with their DIR3 centres and escapes text", () => {
    expect(xml).toContain("<PersonTypeCode>F</PersonTypeCode>");
    expect(xml).toContain("<FirstSurname>Martín</FirstSurname>");
    expect(xml).toContain("<CorporateName>Ayuntamiento de Madrid &amp; Co</CorporateName>");
    expect(xml).toContain("<CentreCode>LA0002001</CentreCode><RoleTypeCode>03</RoleTypeCode>");
  });

  it("marks rectifying invoices and the invoice they correct", () => {
    const corrective = facturaeXml({ ...invoice, corrects: { number: "2026-0008", issueDate: "2026-09-01" } });
    expect(tag(corrective, "InvoiceClass")).toBe("OR");
    expect(corrective).toContain("<Corrective><InvoiceNumber>2026-0008</InvoiceNumber>");
    // Facturae 3.2.2, CorrectionMethodType: 01 rectificación íntegra, 02 por diferencias
    expect(tag(corrective, "CorrectionMethod")).toBe("02");
    const substitution = facturaeXml({
      ...invoice,
      corrects: { number: "2026-0008", issueDate: "2026-09-01", method: "substitution" },
    });
    expect(tag(substitution, "CorrectionMethod")).toBe("01");
  });

  it("adds supplies outside the taxable base", () => {
    const withSupplies = facturaeXml({ ...invoice, withholdingRate: 0, supplies: eur(30) });
    expect(tag(withSupplies, "InvoiceTotal")).toBe("728.65");
    expect(tag(withSupplies, "TotalOutstandingAmount")).toBe("758.65");
    expect(tag(withSupplies, "TotalReimbursableExpenses")).toBe("30.00");
  });
});

describe("facturaePersonType", () => {
  it("tells people from companies by the Spanish tax ID", () => {
    expect(facturaePersonType("12345678Z")).toBe("F");
    expect(facturaePersonType("X1234567L")).toBe("F");
    expect(facturaePersonType("B12345674")).toBe("J");
    expect(facturaePersonType("FR12345678901", "FRA")).toBe("J");
  });
});

describe("facturaeResidence", () => {
  it("separates Spain, the EU and the rest", () => {
    expect(facturaeResidence("ESP")).toBe("R");
    expect(facturaeResidence("FRA")).toBe("U");
    expect(facturaeResidence("USA")).toBe("E");
  });
});

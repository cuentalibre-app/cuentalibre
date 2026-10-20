import { describe, expect, it } from "vitest";
import {
  addDays,
  formatSeriesNumber,
  invoiceTotals,
  isOverdue,
  isSupportedDate,
  laterInvoiceInSeries,
  lineBase,
  nextDocumentNumber,
  nextInvoiceNumber,
  operationChargesVat,
  parseSeriesNumber,
  sameSeriesFormat,
  seriesMaskProblem,
  type InvoiceLine,
} from "./invoices";
import { cents } from "./money";

const line = (unitPrice: number, quantity = 1, vatRate = 0.21, discount = 0): InvoiceLine => ({
  unitPrice,
  quantity,
  discount,
  vatRate,
});

describe("lineBase", () => {
  it("multiplies price by quantity and applies the discount", () => {
    expect(lineBase(line(120, 3, 0.21, 0.1))).toBe(32_400);
  });

  it("rounds sub-cent unit prices to cents once, on the line", () => {
    expect(lineBase(line(0.065, 1_234))).toBe(8_021);
    expect(lineBase(line(1.005))).toBe(101);
  });
});

describe("invoiceTotals", () => {
  it("adds VAT and subtracts the withholding", () => {
    const totals = invoiceTotals([line(1_000), line(500)], 0.15);
    expect(totals).toMatchObject({ base: 150_000, vat: 31_500, withholding: 22_500, total: 159_000 });
  });

  it("groups VAT by rate, highest first", () => {
    const totals = invoiceTotals([line(100, 1, 0.1), line(200), line(50, 2, 0.1), line(30, 1, 0)]);
    expect(totals.vatBreakdown).toEqual([
      { rate: 0.21, base: 20_000, vat: 4_200 },
      { rate: 0.1, base: 20_000, vat: 2_000 },
      { rate: 0, base: 3_000, vat: 0 },
    ]);
    expect(totals.vat).toBe(6_200);
    expect(totals.total).toBe(49_200);
  });

  it("computes VAT on the summed base, not line by line", () => {
    // Line by line it would be 3 cents (three times 1.05 → 1); on 15 cents it is 3.15 → 3
    expect(invoiceTotals([line(0.05), line(0.05), line(0.05)]).vat).toBe(3);
    // 0.25 € at 21 % is 5.25 cents per line → 5 each, 15 in all; on the 75-cent base it is 15.75 → 16
    expect(invoiceTotals([line(0.25), line(0.25), line(0.25)]).vat).toBe(16);
  });

  it("is zero for an empty invoice", () => {
    expect(invoiceTotals([])).toEqual({
      base: 0,
      vat: 0,
      surcharge: 0,
      withholding: 0,
      supplies: 0,
      total: 0,
      vatBreakdown: [],
    });
  });

  it("adds the equivalence surcharge per rate on top of VAT", () => {
    const totals = invoiceTotals([
      { ...line(1_000), surchargeRate: 0.052 },
      { ...line(200, 1, 0.1), surchargeRate: 0.014 },
    ]);
    expect(totals).toMatchObject({ base: 120_000, vat: 23_000, surcharge: 5_480, total: 148_480 });
  });

  it("adds supplies to the total outside the taxable base", () => {
    const totals = invoiceTotals([line(1_000)], 0.15, cents(8_050));
    expect(totals).toMatchObject({ base: 100_000, vat: 21_000, withholding: 15_000, supplies: 8_050, total: 114_050 });
  });
});

describe("addDays", () => {
  it("crosses months and years", () => {
    expect(addDays("2026-10-15", 30)).toBe("2026-11-14");
    expect(addDays("2026-12-15", 30)).toBe("2027-01-14");
  });
});

describe("isOverdue", () => {
  const today = new Date(2026, 9, 15);
  it("is overdue only after the due date and while unpaid", () => {
    expect(isOverdue("2026-10-14", false, today)).toBe(true);
    expect(isOverdue("2026-10-15", false, today)).toBe(false);
    expect(isOverdue("2026-10-14", true, today)).toBe(false);
    expect(isOverdue(null, false, today)).toBe(false);
  });
});

describe("nextDocumentNumber", () => {
  it("continues the series of the same year", () => {
    expect(nextDocumentNumber("", 2026, ["2026-0046", "2026-0047", "2025-0090"])).toBe("2026-0048");
  });

  it("starts again in a new year and ignores other series", () => {
    expect(nextDocumentNumber("", 2027, ["2026-0047"])).toBe("2027-0001");
    expect(nextDocumentNumber("R-", 2026, ["2026-0047", "R-2026-0002"])).toBe("R-2026-0003");
  });
});

describe("seriesMaskProblem", () => {
  it("accepts the year once, one counter and letters or separators", () => {
    expect(seriesMaskProblem("AAAA-####")).toBeNull();
    expect(seriesMaskProblem("FRA/AAAA/B-###")).toBeNull();
    expect(seriesMaskProblem("A-AAAA-####")).toBeNull();
  });

  it("names what is wrong", () => {
    expect(seriesMaskProblem("B-####")).toBe("year");
    expect(seriesMaskProblem("AAAAA-####")).toBe("year");
    expect(seriesMaskProblem("AAAA-AAAA-####")).toBe("year");
    expect(seriesMaskProblem("AAAA-B")).toBe("counter");
    expect(seriesMaskProblem("AAAA-##-##")).toBe("counter");
    expect(seriesMaskProblem("AAAA-2-####")).toBe("characters");
    expect(seriesMaskProblem("AAAA B ####")).toBe("characters");
  });
});

describe("series numbers", () => {
  it("writes and reads numbers with the mask", () => {
    expect(formatSeriesNumber("AAAA-B-####", 2026, 1)).toBe("2026-B-0001");
    expect(formatSeriesNumber("R-AAAA-##", 2026, 123)).toBe("R-2026-123");
    expect(parseSeriesNumber("AAAA-B-####", "2026-B-0012")).toEqual({ year: 2026, counter: 12 });
    expect(parseSeriesNumber("AAAA####", "202600012")).toEqual({ year: 2026, counter: 12 });
    expect(parseSeriesNumber("AAAA-####", "2026-B-0012")).toBeNull();
    expect(parseSeriesNumber("AAAA-####", "R-2026-0012")).toBeNull();
  });

  it("tells masks that number the same invoices", () => {
    expect(sameSeriesFormat("AAAA-B-####", "AAAA-B-##")).toBe(true);
    expect(sameSeriesFormat("AAAA-B-####", "AAAA-####")).toBe(false);
  });
});

describe("nextInvoiceNumber", () => {
  const issued = [
    { number: "2026-0046", issuedOn: "2026-10-02" },
    { number: "R-2026-0001", issuedOn: "2026-10-05" },
    { number: "2026-B-0003", issuedOn: "2026-10-06" },
  ];

  it("numbers each series apart, by the year of the date", () => {
    expect(nextInvoiceNumber("AAAA-####", "2026-10-18", issued)).toBe("2026-0047");
    expect(nextInvoiceNumber("R-AAAA-####", "2026-10-18", issued)).toBe("R-2026-0002");
    expect(nextInvoiceNumber("AAAA-####", "2027-01-02", issued)).toBe("2027-0001");
  });

  it("goes on from the invoices already written with the mask", () => {
    expect(nextInvoiceNumber("AAAA-B-####", "2026-10-18", issued)).toBe("2026-B-0004");
    expect(nextInvoiceNumber("AAAA-C-##", "2026-10-18", issued)).toBe("2026-C-01");
  });
});

describe("laterInvoiceInSeries", () => {
  const issued = [
    { number: "2026-0046", issuedOn: "2026-10-02" },
    { number: "2026-0047", issuedOn: "2026-10-09" },
    { number: "R-2026-0001", issuedOn: "2026-10-20" },
  ];

  it("finds the latest invoice of the series dated after the new one", () => {
    expect(laterInvoiceInSeries("AAAA-####", "2026-10-01", issued)?.number).toBe("2026-0047");
  });

  it("allows the same date or a later one, and ignores other series and years", () => {
    expect(laterInvoiceInSeries("AAAA-####", "2026-10-09", issued)).toBeUndefined();
    expect(laterInvoiceInSeries("R-AAAA-####", "2026-10-25", issued)).toBeUndefined();
    expect(laterInvoiceInSeries("AAAA-B-####", "2026-10-01", issued)).toBeUndefined();
    expect(laterInvoiceInSeries("AAAA-####", "2025-12-31", issued)).toBeUndefined();
  });
});

describe("operationChargesVat", () => {
  it("charges VAT only on national operations", () => {
    expect(operationChargesVat("national")).toBe(true);
    expect(operationChargesVat("intraEu")).toBe(false);
    expect(operationChargesVat("export")).toBe(false);
  });
});

describe("isSupportedDate", () => {
  it("accepts real dates between 1900 and 2100", () => {
    expect(isSupportedDate("2026-01-21")).toBe(true);
    expect(isSupportedDate("2028-02-29")).toBe(true);
  });

  it("rejects five-digit years, out-of-range years and impossible days", () => {
    expect(isSupportedDate("20269-01-21")).toBe(false);
    expect(isSupportedDate("0026-01-21")).toBe(false);
    expect(isSupportedDate("2101-01-01")).toBe(false);
    expect(isSupportedDate("2026-02-30")).toBe(false);
    expect(isSupportedDate("")).toBe(false);
  });
});

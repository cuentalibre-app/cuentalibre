import { describe, expect, it } from "vitest";
import {
  addDays,
  invoiceTotals,
  isOverdue,
  lineBase,
  nextDocumentNumber,
  operationChargesVat,
  roundCents,
  type InvoiceLine,
} from "./invoices";

const line = (unitPrice: number, quantity = 1, vatRate = 0.21, discount = 0): InvoiceLine => ({
  unitPrice,
  quantity,
  discount,
  vatRate,
});

describe("roundCents", () => {
  it("rounds half away from zero", () => {
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(-1.005)).toBe(-1.01);
    expect(roundCents(2.344)).toBe(2.34);
  });
});

describe("lineBase", () => {
  it("multiplies price by quantity and applies the discount", () => {
    expect(lineBase(line(120, 3, 0.21, 0.1))).toBe(324);
  });
});

describe("invoiceTotals", () => {
  it("adds VAT and subtracts the withholding", () => {
    const totals = invoiceTotals([line(1_000), line(500)], 0.15);
    expect(totals).toMatchObject({ base: 1_500, vat: 315, withholding: 225, total: 1_590 });
  });

  it("groups VAT by rate, highest first", () => {
    const totals = invoiceTotals([line(100, 1, 0.1), line(200), line(50, 2, 0.1), line(30, 1, 0)]);
    expect(totals.vatBreakdown).toEqual([
      { rate: 0.21, base: 200, vat: 42 },
      { rate: 0.1, base: 200, vat: 20 },
      { rate: 0, base: 30, vat: 0 },
    ]);
    expect(totals.vat).toBe(62);
    expect(totals.total).toBe(492);
  });

  it("computes VAT on the summed base, not line by line", () => {
    // Line by line it would be 3 × 0.21 × 0.05 = 0.03 (three times 0.0105 → 0.01)
    expect(invoiceTotals([line(0.05), line(0.05), line(0.05)]).vat).toBe(0.03);
  });

  it("is zero for an empty invoice", () => {
    expect(invoiceTotals([])).toEqual({ base: 0, vat: 0, withholding: 0, total: 0, vatBreakdown: [] });
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

describe("operationChargesVat", () => {
  it("charges VAT only on national operations", () => {
    expect(operationChargesVat("national")).toBe(true);
    expect(operationChargesVat("intraEu")).toBe(false);
    expect(operationChargesVat("export")).toBe(false);
  });
});

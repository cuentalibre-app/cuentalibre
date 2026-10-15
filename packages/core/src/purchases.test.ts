import { describe, expect, it } from "vitest";
import {
  amountOutstanding,
  deductibleAmounts,
  isBookedLate,
  isDuplicatePurchase,
  isValidBookingDate,
  isValidImputation,
  paymentStatus,
  purchaseCarriesVat,
} from "./purchases";

describe("purchaseCarriesVat", () => {
  it("is true only for national purchases and imports", () => {
    expect(purchaseCarriesVat("national")).toBe(true);
    expect(purchaseCarriesVat("import")).toBe(true);
    for (const type of ["exempt", "notSubject", "reverseCharge", "intraEu"] as const) {
      expect(purchaseCarriesVat(type)).toBe(false);
    }
  });
});

describe("isValidImputation", () => {
  it("accepts whole percentages from 0 to 100", () => {
    expect(isValidImputation(0)).toBe(true);
    expect(isValidImputation(100)).toBe(true);
    expect(isValidImputation(30)).toBe(true);
  });

  it("rejects fractions and out-of-range values", () => {
    expect(isValidImputation(12.5)).toBe(false);
    expect(isValidImputation(-1)).toBe(false);
    expect(isValidImputation(101)).toBe(false);
  });
});

describe("deductibleAmounts", () => {
  it("applies the same share to base and VAT by default", () => {
    expect(deductibleAmounts({ base: 100, vat: 21 }, 30)).toEqual({ base: 30, vat: 6.3 });
  });

  it("uses a separate VAT share when given", () => {
    expect(deductibleAmounts({ base: 20_000, vat: 4_200 }, 0, 50)).toEqual({ base: 0, vat: 2_100 });
  });

  it("rounds to cents", () => {
    expect(deductibleAmounts({ base: 33.33, vat: 7 }, 50)).toEqual({ base: 16.67, vat: 3.5 });
  });
});

describe("paymentStatus", () => {
  it("is pending without payments", () => {
    expect(paymentStatus(121, [])).toBe("pending");
  });

  it("is partial while payments fall short", () => {
    expect(paymentStatus(121, [50, 21])).toBe("partial");
  });

  it("is paid when payments cover the total, ignoring float noise", () => {
    expect(paymentStatus(0.3, [0.1, 0.2])).toBe("paid");
    expect(paymentStatus(121, [150])).toBe("paid");
  });

  it("handles credit notes with negative totals", () => {
    expect(paymentStatus(-50, [-50])).toBe("paid");
    expect(paymentStatus(-50, [-20])).toBe("partial");
  });
});

describe("amountOutstanding", () => {
  it("subtracts the payments from the total", () => {
    expect(amountOutstanding(121, [21])).toBe(100);
  });

  it("is zero once paid or overpaid", () => {
    expect(amountOutstanding(121, [121])).toBe(0);
    expect(amountOutstanding(121, [200])).toBe(0);
  });
});

describe("booking date", () => {
  it("can't be earlier than the issue date", () => {
    expect(isValidBookingDate("2026-09-28", "2026-10-02")).toBe(true);
    expect(isValidBookingDate("2026-09-28", "2026-09-28")).toBe(true);
    expect(isValidBookingDate("2026-09-28", "2026-09-27")).toBe(false);
  });

  it("is late when it falls in another quarter", () => {
    expect(isBookedLate("2026-09-28", "2026-10-02")).toBe(true);
    expect(isBookedLate("2026-07-01", "2026-09-30")).toBe(false);
  });
});

describe("isDuplicatePurchase", () => {
  const existing = [{ id: "a", supplierId: "s1", number: "F-001", issuedOn: "2026-03-10" }];

  it("flags the same number from the same supplier in the same year", () => {
    expect(isDuplicatePurchase({ supplierId: "s1", number: " f-001 ", issuedOn: "2026-11-01" }, existing)).toBe(true);
  });

  it("allows it from another supplier or another year", () => {
    expect(isDuplicatePurchase({ supplierId: "s2", number: "F-001", issuedOn: "2026-03-10" }, existing)).toBe(false);
    expect(isDuplicatePurchase({ supplierId: "s1", number: "F-001", issuedOn: "2025-03-10" }, existing)).toBe(false);
  });

  it("ignores the invoice being edited", () => {
    expect(isDuplicatePurchase({ id: "a", supplierId: "s1", number: "F-001", issuedOn: "2026-03-10" }, existing)).toBe(
      false,
    );
  });
});

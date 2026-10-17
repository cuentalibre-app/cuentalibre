import { describe, expect, it } from "vitest";
import {
  excelSerialToIso,
  formatSpanishDate,
  groupRows,
  parseAmount,
  parseDate,
  parsePercent,
  surchargeRateFromPercent,
  vatRateFromPercent,
  withholdingFromPercent,
} from "./transfer";

describe("parseAmount", () => {
  it("reads euro amounts written the Spanish way", () => {
    expect(parseAmount("1250€")).toBe(1250);
    expect(parseAmount("2251,2 €")).toBe(2251.2);
    expect(parseAmount("1.250,50")).toBe(1250.5);
    expect(parseAmount("-2100€")).toBe(-2100);
    expect(parseAmount("1.250")).toBe(1250);
  });

  it("reads English and plain numbers", () => {
    expect(parseAmount("1,250.50")).toBe(1250.5);
    expect(parseAmount("1250.5")).toBe(1250.5);
    expect(parseAmount("0.75")).toBe(0.75);
    expect(parseAmount("1,250,000")).toBe(1_250_000);
    expect(parseAmount("(30,00)")).toBe(-30);
  });

  it("returns null for empty or non-numeric text", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("12a")).toBeNull();
  });
});

describe("parsePercent", () => {
  it("accepts a percent sign and decimal commas", () => {
    expect(parsePercent("21")).toBe(21);
    expect(parsePercent("100%")).toBe(100);
    expect(parsePercent("5,2")).toBe(5.2);
  });
});

describe("parseDate", () => {
  it("reads day-first dates and ISO dates", () => {
    expect(parseDate("31/03/2026")).toBe("2026-03-31");
    expect(parseDate("1/2/26")).toBe("2026-02-01");
    expect(parseDate("01.02.2026")).toBe("2026-02-01");
    expect(parseDate("2026-03-31")).toBe("2026-03-31");
  });

  it("rejects impossible dates", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("2026-13-01")).toBeNull();
    expect(parseDate("mañana")).toBeNull();
  });
});

describe("excelSerialToIso", () => {
  it("counts from the Excel epoch", () => {
    expect(excelSerialToIso(46022)).toBe("2025-12-31");
    expect(excelSerialToIso(45658)).toBe("2025-01-01");
  });
});

describe("formatSpanishDate", () => {
  it("writes day, month and year", () => {
    expect(formatSpanishDate("2026-03-01")).toBe("01/03/2026");
  });
});

describe("rates from percentages", () => {
  it("matches the VAT rates an invoice can carry", () => {
    expect(vatRateFromPercent(21)).toBe(0.21);
    expect(vatRateFromPercent(7.5)).toBe(0.075);
    expect(vatRateFromPercent(0)).toBe(0);
    expect(vatRateFromPercent(13)).toBeNull();
  });

  it("matches equivalence surcharge rates", () => {
    expect(surchargeRateFromPercent(5.2)).toBe(0.052);
    expect(surchargeRateFromPercent(3)).toBeNull();
  });

  it("prefers current withholding rates over historical ones", () => {
    expect(withholdingFromPercent(15)).toBe("professional");
    expect(withholdingFromPercent(19)).toBe("rental");
    expect(withholdingFromPercent(0)).toBe("none");
    expect(withholdingFromPercent(21)).toBe("legacyProfessional2014");
    expect(withholdingFromPercent(16)).toBeNull();
  });
});

describe("groupRows", () => {
  it("starts a document on each new key and appends rows with the same or an empty key", () => {
    const rows = ["A", "A", "", "B", "", "C"];
    expect(groupRows(rows, (r) => r)).toEqual([["A", "A", ""], ["B", ""], ["C"]]);
  });

  it("drops leading rows without a key", () => {
    expect(groupRows(["", "A"], (r) => r)).toEqual([["A"]]);
  });
});

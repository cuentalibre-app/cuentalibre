import { cents } from "@fiscalia/core";
import { describe, expect, it } from "vitest";
import { documentLocale, hexToRgb, mix, PDF_LABELS, pdfFormat, pdfLabels } from "./pdf-look";

const look = { language: "es", numberFormat: "ES" };

describe("documentLocale", () => {
  it("prefers the document, then the client, then the template", () => {
    expect(documentLocale({ language: "fr", numberFormat: "BE" }, { language: "en" }, look)).toEqual({
      language: "fr",
      region: "BE",
    });
    expect(documentLocale({}, { language: "en", numberFormat: "GB" }, look)).toEqual({
      language: "en",
      region: "GB",
    });
    expect(documentLocale({ language: "" }, {}, look)).toEqual({ language: "es", region: "ES" });
  });
});

describe("pdfFormat", () => {
  it("formats amounts, percentages and dates for the region, in WinAnsi characters", () => {
    const es = pdfFormat({ language: "es", region: "ES" });
    expect(es.money(cents(487_600))).toBe("4.876,00 €");
    expect(es.money(cents(-1_050))).toBe("-10,50 €");
    expect(es.percent(0.21)).toBe("21 %");
    expect(es.quantity(1.5)).toBe("1,5");
    expect(es.date("2026-03-05")).toBe("05/03/2026");

    const en = pdfFormat({ language: "en", region: "GB" });
    expect(en.money(cents(487_600))).toBe("€4,876.00");
    expect(en.date("2026-03-05")).toBe("05/03/2026");
    expect(pdfFormat({ language: "en", region: "US" }).date("2026-03-05")).toBe("03/05/2026");
  });

  it("falls back to Spanish formats with an unreadable locale", () => {
    expect(pdfFormat({ language: "??", region: "" }).money(cents(100))).toBe("1,00 €");
  });
});

describe("colors", () => {
  it("reads hex colors, short or long", () => {
    expect(hexToRgb("#1a2B3c")).toEqual([26, 43, 60]);
    expect(hexToRgb("fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("nope")).toEqual([0, 0, 0]);
  });

  it("mixes towards another color", () => {
    expect(mix([0, 0, 0], [255, 255, 255], 0.5)).toEqual([128, 128, 128]);
  });
});

describe("pdfLabels", () => {
  it("has the same labels in every language", () => {
    const keys = Object.keys(PDF_LABELS.es!).sort();
    for (const labels of Object.values(PDF_LABELS)) expect(Object.keys(labels).sort()).toEqual(keys);
  });

  it("falls back to Spanish", () => {
    expect(pdfLabels("xx").kinds.invoice).toBe("Factura");
  });
});

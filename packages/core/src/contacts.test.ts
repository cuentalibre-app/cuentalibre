import { describe, expect, it } from "vitest";
import {
  censusEntry,
  checkSpanishTaxId,
  checkTaxId,
  countryFromVatPrefix,
  formatIban,
  hasEuVatPrefix,
  findDuplicateTaxId,
  sameTaxId,
  isOtherEuCountry,
  isValidEmail,
  isValidIban,
  normalizeTaxId,
  storedTaxId,
  provinceFromPostalCode,
} from "./contacts";

describe("checkSpanishTaxId", () => {
  it("accepts DNI-based NIFs with the right letter", () => {
    expect(checkSpanishTaxId("12345678Z")).toEqual({ valid: true, kind: "nif" });
    expect(checkSpanishTaxId("12345678z")).toEqual({ valid: true, kind: "nif" });
    expect(checkSpanishTaxId("12.345.678-Z")).toEqual({ valid: true, kind: "nif" });
  });

  it("rejects a wrong control letter", () => {
    expect(checkSpanishTaxId("12345678A")).toEqual({ valid: false, reason: "checksum" });
  });

  it("accepts NIEs and special NIFs", () => {
    expect(checkSpanishTaxId("X1234567L")).toEqual({ valid: true, kind: "nie" });
    expect(checkSpanishTaxId("Y1234567X")).toEqual({ valid: true, kind: "nie" });
    expect(checkSpanishTaxId("X1234567A")).toEqual({ valid: false, reason: "checksum" });
    expect(checkSpanishTaxId("K1234567L")).toEqual({ valid: true, kind: "nif" });
  });

  it("checks the control digit or letter of company CIFs", () => {
    expect(checkSpanishTaxId("B12345674")).toEqual({ valid: true, kind: "cif" });
    expect(checkSpanishTaxId("B12345675")).toEqual({ valid: false, reason: "checksum" });
    // Public bodies (Q) always end in a letter
    expect(checkSpanishTaxId("Q2826000H")).toEqual({ valid: true, kind: "cif" });
    expect(checkSpanishTaxId("Q28260008")).toEqual({ valid: false, reason: "checksum" });
    // Associations (G) accept either
    expect(checkSpanishTaxId("G12345674")).toEqual({ valid: true, kind: "cif" });
    expect(checkSpanishTaxId("G1234567D")).toEqual({ valid: true, kind: "cif" });
  });

  it("accepts the ES prefix of the intra-EU VAT number", () => {
    expect(checkSpanishTaxId("ESB12345674")).toEqual({ valid: true, kind: "cif" });
    expect(checkSpanishTaxId("ES 12345678Z")).toEqual({ valid: true, kind: "nif" });
  });

  it("rejects anything not shaped like a Spanish tax ID", () => {
    expect(checkSpanishTaxId("")).toEqual({ valid: false, reason: "empty" });
    expect(checkSpanishTaxId("1234")).toEqual({ valid: false, reason: "format" });
    expect(checkSpanishTaxId("DE123456789")).toEqual({ valid: false, reason: "format" });
  });
});

describe("checkTaxId", () => {
  it("validates Spanish contacts in full", () => {
    expect(checkTaxId("12345678A", "España")).toEqual({ valid: false, reason: "checksum" });
  });

  it("only checks the characters of foreign tax IDs", () => {
    expect(checkTaxId("DE123456789", "Alemania")).toEqual({ valid: true, kind: "foreign" });
    expect(checkTaxId("86-1696045", "Estados Unidos")).toEqual({ valid: true, kind: "foreign" });
    expect(checkTaxId("ñ", "Francia")).toEqual({ valid: false, reason: "format" });
    expect(checkTaxId(" ", "Francia")).toEqual({ valid: false, reason: "empty" });
  });
});

describe("EU helpers", () => {
  it("knows which countries are in the EU besides Spain", () => {
    expect(isOtherEuCountry("Irlanda")).toBe(true);
    expect(isOtherEuCountry("España")).toBe(false);
    expect(isOtherEuCountry("Reino Unido")).toBe(false);
  });

  it("checks the VAT prefix of EU tax IDs", () => {
    expect(hasEuVatPrefix("IE6364992H", "Irlanda")).toBe(true);
    expect(hasEuVatPrefix("6364992H", "Irlanda")).toBe(false);
    expect(hasEuVatPrefix("EL123456789", "Grecia")).toBe(true);
    expect(hasEuVatPrefix("B12345674", "España")).toBeNull();
    expect(hasEuVatPrefix("123", "Suiza")).toBeNull();
  });
});

describe("countryFromVatPrefix", () => {
  it("recognises EU VAT numbers by their prefix", () => {
    expect(countryFromVatPrefix("FR40303265045")).toBe("Francia");
    expect(countryFromVatPrefix("el123456789")).toBe("Grecia");
  });

  it("ignores Spanish and non-EU tax IDs", () => {
    expect(countryFromVatPrefix("ESB12345674")).toBeNull();
    expect(countryFromVatPrefix("B12345674")).toBeNull();
    expect(countryFromVatPrefix("GB123456789")).toBeNull();
    expect(countryFromVatPrefix("FR")).toBeNull();
  });
});

describe("IBAN", () => {
  it("validates the check digits", () => {
    expect(isValidIban("ES9121000418450200051332")).toBe(true);
    expect(isValidIban("es91 2100 0418 4502 0005 1332")).toBe(true);
    expect(isValidIban("DE89370400440532013000")).toBe(true);
    expect(isValidIban("ES9121000418450200051333")).toBe(false);
    expect(isValidIban("ES91210004184502000513")).toBe(false);
    expect(isValidIban("1234")).toBe(false);
  });

  it("formats in groups of four", () => {
    expect(formatIban("es9121000418450200051332")).toBe("ES91 2100 0418 4502 0005 1332");
  });
});

describe("isValidEmail", () => {
  it("accepts usual addresses and rejects malformed ones", () => {
    expect(isValidEmail("facturas@estudionorte.es")).toBe(true);
    expect(isValidEmail(" ana+fiscal@correo.com ")).toBe(true);
    expect(isValidEmail("ana@correo")).toBe(false);
    expect(isValidEmail("ana correo@x.es")).toBe(false);
  });
});

describe("sameTaxId", () => {
  it("compares tax IDs however they are typed", () => {
    expect(sameTaxId("B12345674", "b-12.345.674")).toBe(true);
    expect(sameTaxId("12345678Z", "ES 12345678Z")).toBe(true);
    expect(sameTaxId("B12345674", "B12345675")).toBe(false);
  });

  it("never matches empty tax IDs", () => {
    expect(sameTaxId("", "")).toBe(false);
    expect(sameTaxId(" - ", "")).toBe(false);
  });
});

describe("findDuplicateTaxId", () => {
  const existing = [
    { id: "c1", taxId: "B12345674" },
    { id: "c2", taxId: "12345678Z" },
    { id: "c3", taxId: "" },
  ];

  it("finds the contact with the same tax ID however it is typed", () => {
    expect(findDuplicateTaxId({ taxId: "b-12345674" }, existing)?.id).toBe("c1");
    expect(findDuplicateTaxId({ taxId: "ES12345678Z" }, existing)?.id).toBe("c2");
  });

  it("ignores the contact itself and empty IDs", () => {
    expect(findDuplicateTaxId({ id: "c1", taxId: "B12345674" }, existing)).toBeUndefined();
    expect(findDuplicateTaxId({ taxId: "" }, existing)).toBeUndefined();
  });
});

describe("normalizeTaxId", () => {
  it("drops separators and upper-cases", () => {
    expect(normalizeTaxId(" b-12.345 674 ")).toBe("B12345674");
  });
});

describe("storedTaxId", () => {
  it("drops separators from Spanish and EU VAT numbers", () => {
    expect(storedTaxId(" b-12.345 674 ", "España")).toBe("B12345674");
    expect(storedTaxId("fr 40 303265045", "Francia")).toBe("FR40303265045");
  });

  it("keeps the separators of other countries' IDs", () => {
    expect(storedTaxId(" 86-1696045 ", "Estados Unidos")).toBe("86-1696045");
    expect(storedTaxId("gb  123 4567 89", "Reino Unido")).toBe("GB 123 4567 89");
  });
});

describe("provinceFromPostalCode", () => {
  it("maps the first two digits to the province", () => {
    expect(provinceFromPostalCode("28012")).toBe("Madrid");
    expect(provinceFromPostalCode("48011")).toBe("Bizkaia");
    expect(provinceFromPostalCode("01001")).toBe("Álava");
    expect(provinceFromPostalCode("52001")).toBe("Melilla");
  });

  it("ignores anything that isn't a Spanish postal code", () => {
    expect(provinceFromPostalCode("53001")).toBeNull();
    expect(provinceFromPostalCode("00001")).toBeNull();
    expect(provinceFromPostalCode("2801")).toBeNull();
    expect(provinceFromPostalCode("D24")).toBeNull();
  });
});

describe("censusEntry", () => {
  it("asks about Spanish NIFs as VERI*FACTU names them", () => {
    expect(censusEntry({ taxId: "b-1234567.4", name: "  Pérez   Hijos SL ", country: "España" })).toEqual({
      taxId: "B12345674",
      name: "Pérez Hijos SL",
    });
    expect(censusEntry({ taxId: "12345678Z", name: "Ana" })).toEqual({ taxId: "12345678Z", name: "Ana" });
  });

  it("skips foreign contacts and NIFs that aren't well formed", () => {
    expect(censusEntry({ taxId: "FR40303265045", name: "Société", country: "Francia" })).toBeNull();
    expect(censusEntry({ taxId: "12345678A", name: "Ana" })).toBeNull();
    expect(censusEntry({ taxId: "ESB12345674", name: "Empresa SL" })).toBeNull();
    expect(censusEntry({ taxId: "12345678Z", name: " " })).toBeNull();
  });
});

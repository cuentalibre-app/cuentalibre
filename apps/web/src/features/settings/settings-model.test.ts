import { describe, expect, it } from "vitest";
import { DEFAULT_ORGANIZATION_SETTINGS } from "@cuentalibre/contracts";
import { aeatValidation, missingIssuerData } from "./settings-model";

const profile = {
  ...DEFAULT_ORGANIZATION_SETTINGS.businessProfile,
  taxId: "50123456Q",
  firstName: "Lucía",
  lastName: "Martín",
  address: "Calle del Pez 12",
  postalCode: "28004",
  city: "Madrid",
};

describe("missingIssuerData", () => {
  it("is null once the profile names the issuer", () => {
    expect(missingIssuerData(profile)).toBeNull();
  });

  it("lists what is missing as a sentence", () => {
    expect(missingIssuerData({ ...profile, city: "" })).toBe("falta la población");
    expect(missingIssuerData({ ...profile, taxId: "", postalCode: "" })).toBe("faltan el NIF y el código postal");
    expect(missingIssuerData({ ...profile, kind: "company", address: "", city: "" })).toBe(
      "faltan la razón social, la dirección y la población",
    );
  });
});

describe("aeatValidation", () => {
  const check = {
    taxId: "50123456Q",
    name: "Lucía Martín",
    result: "identified" as const,
    censusName: "MARTIN LUCIA",
    checkedAt: "2026-11-01T10:00:00.000Z",
  };

  it("takes the census's answer about the current NIF and name", () => {
    expect(aeatValidation(profile, check, false)).toEqual({ state: "yes" });
    expect(aeatValidation(profile, { ...check, result: "notIdentified" }, true)).toEqual({
      state: "no",
      reason: "La AEAT no encuentra este NIF con este nombre en su censo.",
    });
    expect(aeatValidation(profile, { ...check, result: "similar", censusName: "MARTIN SANZ LUCIA" }, false)).toEqual({
      state: "no",
      reason: "La AEAT tiene este NIF a nombre de MARTIN SANZ LUCIA.",
    });
  });

  it("is pending until the census answers about them, unless an accepted record proves them", () => {
    const unchecked = DEFAULT_ORGANIZATION_SETTINGS.verifactuCheck;
    expect(aeatValidation(profile, unchecked, false)).toEqual({ state: "pending" });
    expect(aeatValidation(profile, unchecked, true)).toEqual({ state: "yes" });
    // A check of the NIF before it changed doesn't count
    expect(aeatValidation({ ...profile, taxId: "12345678Z" }, { ...check, result: "notIdentified" }, false)).toEqual({
      state: "pending",
    });
  });
});

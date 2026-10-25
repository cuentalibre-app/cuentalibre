import { describe, expect, it } from "vitest";
import { DEFAULT_ORGANIZATION_SETTINGS } from "@cuentalibre/contracts";
import { missingIssuerData } from "./settings-model";

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

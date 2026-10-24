import { describe, expect, it } from "vitest";
import {
  newSetup,
  onboardingSteps,
  organizationName,
  setupCommands,
  skipStep,
  stepErrors,
  type Setup,
} from "./onboarding-model";

const withProfile = (changes: Partial<Setup["profile"]>): Setup => {
  const setup = newSetup();
  return { ...setup, profile: { ...setup.profile, ...changes } };
};

describe("onboardingSteps", () => {
  it("asks to confirm the email first, only when it needs verifying", () => {
    expect(onboardingSteps(true).map((s) => s.key)).toEqual([
      "email",
      "regime",
      "identity",
      "address",
      "activity",
      "verifactu",
    ]);
    expect(onboardingSteps(false).map((s) => s.key)).toEqual([
      "regime",
      "identity",
      "address",
      "activity",
      "verifactu",
    ]);
  });
});

describe("newSetup", () => {
  it("leaves VERI*FACTU off, from the day the business is created", () => {
    expect(newSetup("2026-10-24").verifactu).toMatchObject({ system: "exempt", startDate: "2026-10-24" });
  });
});

describe("skipStep", () => {
  it("leaves the business exempt from VERI*FACTU when its step is skipped, even if it was chosen", () => {
    const setup = newSetup();
    const chosen = { ...setup, verifactu: { ...setup.verifactu, system: "verifactu" as const } };
    expect(skipStep("verifactu", chosen).verifactu.system).toBe("exempt");
  });

  it("drops the activity when its step is skipped, and keeps what was typed elsewhere", () => {
    const setup = newSetup();
    const activity = { id: "a1", type: "A03", code: "763", name: "Programadores" };
    const chosen = { ...setup, tax: { ...setup.tax, activities: [activity] } };
    expect(skipStep("activity", chosen).tax.activities).toEqual([]);
    const address = withProfile({ address: "Calle Mayor 1" });
    expect(skipStep("address", address)).toBe(address);
  });
});

describe("stepErrors", () => {
  it("lets the tax setup, address and activity through as they are", () => {
    expect(stepErrors("regime", newSetup())).toEqual({});
    expect(stepErrors("address", newSetup())).toEqual({});
    expect(stepErrors("activity", newSetup())).toEqual({});
  });

  it("asks a self-employed worker for a valid NIF, name and first surname", () => {
    expect(Object.keys(stepErrors("identity", newSetup())).sort()).toEqual(["firstName", "lastName", "taxId"]);
    expect(stepErrors("identity", withProfile({ taxId: "12345678Z", firstName: "Ana", lastName: "Gil" }))).toEqual({});
    expect(
      stepErrors("identity", withProfile({ taxId: "12345678A", firstName: "Ana", lastName: "Gil" })).taxId,
    ).toMatch(/letra/);
  });

  it("asks a company for its CIF and legal name", () => {
    const company = withProfile({ kind: "company", taxId: "12345678Z", legalName: "" });
    expect(Object.keys(stepErrors("identity", company)).sort()).toEqual(["legalName", "taxId"]);
    expect(
      stepErrors("identity", withProfile({ kind: "company", taxId: "B12345674", legalName: "Peña S.L." })),
    ).toEqual({});
  });
});

describe("organizationName", () => {
  it("is the name on invoices, or the full name without one", () => {
    expect(organizationName(withProfile({ firstName: "Ana", lastName: "Gil", secondLastName: "Ruiz" }))).toBe(
      "Ana Gil Ruiz",
    );
    expect(organizationName(withProfile({ firstName: "Ana", lastName: "Gil", tradeName: "Estudio Gil" }))).toBe(
      "Estudio Gil",
    );
  });
});

describe("setupCommands", () => {
  it("saves the profile, with the tax ID normalized, the tax setup and the invoicing system", () => {
    const setup = withProfile({ taxId: " 12.345.678-z " });
    const [profile, tax, verifactu] = setupCommands(setup);
    expect(profile).toEqual({
      type: "saveSettings",
      section: "businessProfile",
      data: { ...setup.profile, taxId: "12345678Z" },
    });
    expect(tax).toEqual({ type: "saveSettings", section: "taxSetup", data: setup.tax });
    expect(verifactu).toEqual({ type: "saveSettings", section: "verifactu", data: setup.verifactu });
  });
});

import { describe, expect, it } from "vitest";
import type { Billing } from "@cuentalibre/contracts";
import {
  newSetup,
  onboardingSteps,
  organizationName,
  resumesAtPlan,
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
    expect(onboardingSteps(true).map((s) => s.key)).toEqual(["email", "regime", "identity", "address", "activity"]);
    expect(onboardingSteps(false).map((s) => s.key)).toEqual(["regime", "identity", "address", "activity"]);
  });

  it("ends with the plan, only where the instance charges for one", () => {
    expect(onboardingSteps(false, true).at(-1)!.key).toBe("plan");
    expect(onboardingSteps(true, false).map((s) => s.key)).not.toContain("plan");
  });
});

describe("skipStep", () => {
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
  it("saves the profile, with the tax ID normalized, and the tax setup", () => {
    const setup = withProfile({ taxId: " 12.345.678-z " });
    const [profile, tax] = setupCommands(setup);
    expect(profile).toEqual({
      type: "saveSettings",
      section: "businessProfile",
      data: { ...setup.profile, taxId: "12345678Z" },
    });
    expect(tax).toEqual({ type: "saveSettings", section: "taxSetup", data: setup.tax });
  });
});

describe("resumesAtPlan", () => {
  const trial: Billing = {
    plan: { status: "trial", canWrite: true, trialEndsAt: "2026-11-24T10:00:00.000Z" },
    subscription: null,
  };

  it("offers the plan again while the trial runs without a subscription", () => {
    expect(resumesAtPlan(trial)).toBe(true);
  });

  it("goes to the app once it has subscribed, the trial is over, or nothing is charged", () => {
    const subscribed: Billing = {
      ...trial,
      subscription: { period: "monthly", status: "trialing", currentPeriodEnd: null, cancelAtPeriodEnd: false },
    };
    expect(resumesAtPlan(subscribed)).toBe(false);
    expect(resumesAtPlan({ ...trial, plan: { ...trial.plan, status: "readOnly", canWrite: false } })).toBe(false);
    expect(resumesAtPlan(null)).toBe(false);
  });
});

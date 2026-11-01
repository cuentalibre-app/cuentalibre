import { DEFAULT_ORGANIZATION_SETTINGS } from "@cuentalibre/contracts";
import { describe, expect, it } from "vitest";
import { withDefaults } from "./settings";

describe("withDefaults", () => {
  it("fills settings added after a section was saved", () => {
    const { showPaymentMethod: _, ...saved } = { ...DEFAULT_ORGANIZATION_SETTINGS.invoiceSettings, footer: "Registro" };
    expect(withDefaults("invoiceSettings", saved)).toEqual({
      ...DEFAULT_ORGANIZATION_SETTINGS.invoiceSettings,
      footer: "Registro",
      showPaymentMethod: true,
    });
  });

  it("keeps what was saved over the defaults", () => {
    const saved = { ...DEFAULT_ORGANIZATION_SETTINGS.invoiceSettings, showPaymentMethod: false };
    expect(withDefaults("invoiceSettings", saved)).toEqual(saved);
  });

  it("leaves sections that aren't objects alone", () => {
    expect(withDefaults("defaultPaymentMethod", "pm-1")).toBe("pm-1");
  });
});

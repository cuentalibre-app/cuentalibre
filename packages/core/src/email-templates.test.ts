import { describe, expect, it } from "vitest";
import { fillPlaceholders, unknownPlaceholders } from "./email-templates";

describe("fillPlaceholders", () => {
  const values = { numero: "2026-0012", total: "1.060,00 €", cliente: "Estudio Norte S.L." };

  it("fills every placeholder, ignoring case and inner spaces", () => {
    expect(fillPlaceholders("Factura {{numero}} de {{ Cliente }}: {{TOTAL}}", values)).toBe(
      "Factura 2026-0012 de Estudio Norte S.L.: 1.060,00 €",
    );
  });

  it("fills a placeholder each time it appears", () => {
    expect(fillPlaceholders("{{numero}} / {{numero}}", values)).toBe("2026-0012 / 2026-0012");
  });

  it("leaves unknown placeholders as written", () => {
    expect(fillPlaceholders("Factura {{nmero}}", values)).toBe("Factura {{nmero}}");
  });

  it("fills empty values with nothing", () => {
    expect(fillPlaceholders("Vence {{vencimiento}}.", { vencimiento: "" })).toBe("Vence .");
  });

  it("leaves text that isn't a placeholder alone", () => {
    expect(fillPlaceholders("{numero} {{ }} {{a b}}", values)).toBe("{numero} {{ }} {{a b}}");
  });

  it("accepts accented names", () => {
    expect(fillPlaceholders("{{número}}", { número: "7" })).toBe("7");
  });
});

describe("unknownPlaceholders", () => {
  it("lists the unknown names once, as written", () => {
    expect(unknownPlaceholders("{{numero}} {{Nmero}} {{nmero}} {{fecha}}", ["numero", "fecha"])).toEqual(["Nmero"]);
  });

  it("is empty when every name is known", () => {
    expect(unknownPlaceholders("Hola {{CLIENTE}}", ["cliente"])).toEqual([]);
  });
});

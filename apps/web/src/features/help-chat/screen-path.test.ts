import { describe, expect, it } from "vitest";
import { screenPath } from "./screen-path";

describe("screenPath", () => {
  it("keeps a page's path", () => {
    expect(screenPath("/ventas/facturas", "")).toBe("/ventas/facturas");
    expect(screenPath("/ventas/facturas/nueva", "?cliente=abc")).toBe("/ventas/facturas/nueva");
  });

  it("names a record's page without its id", () => {
    expect(screenPath("/ventas/facturas/3f2a9c1e-8b7d-4e6f-a1b2-c3d4e5f60718", "")).toBe("/ventas/facturas/:id");
    expect(screenPath("/compras/gastos/42/editar", "")).toBe("/compras/gastos/:id/editar");
  });

  it("names the period by its kind, not by its year", () => {
    expect(screenPath("/impuestos/iva", "?periodo=2026-T4")).toBe("/impuestos/iva?periodo=trimestre");
    expect(screenPath("/impuestos/iva", "?periodo=2027")).toBe("/impuestos/iva?periodo=año");
  });
});

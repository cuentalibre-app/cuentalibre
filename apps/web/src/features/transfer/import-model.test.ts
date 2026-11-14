import { describe, expect, it } from "vitest";
import { previewImport } from "./import-model";

const ctx = { isLocked: () => null };
const HEADER = [
  "Número",
  "Fecha factura",
  "Concepto - Base imponible unitaria",
  "Cliente - NIF",
  "Cliente - Nombre o Razón Social",
  "Cliente - País",
];
const sale = (number: string, taxId: string, name: string, country = "") => [
  number,
  "15/01/2026",
  "100",
  taxId,
  name,
  country,
];

describe("previewImport", () => {
  it("only creates contacts with a valid tax ID", () => {
    const preview = previewImport(
      "sales",
      [
        HEADER,
        sale("IMP-1", "", "Sin NIF S.L."),
        sale("IMP-2", "B12345675", "Letra Mal S.L."),
        sale("IMP-3", "b-22.222.228", "Bien S.L."),
        sale("IMP-4", "FR40303265045", "Paris SARL", "Francia"),
      ],
      ctx,
    );
    const errors = Object.fromEntries(preview.items.map((i) => [i.number, i.errors]));
    expect(errors["IMP-1"]).toContain("Falta el NIF del cliente «Sin NIF S.L.».");
    expect(errors["IMP-2"]).toContain("El NIF B12345675 del cliente «Letra Mal S.L.» no es válido.");
    expect(errors["IMP-3"]).not.toContainEqual(expect.stringContaining("NIF"));
    expect(errors["IMP-4"]).not.toContainEqual(expect.stringContaining("NIF"));
    expect(preview.newContacts.find((c) => c.name === "Bien S.L.")?.taxId).toBe("B22222228");
  });
});

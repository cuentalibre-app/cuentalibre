import { describe, expect, it } from "vitest";
import { correctedLines, reversedLine, substitutionLines } from "./rectifying";
import { verifactuInvoiceType, verifactuRectificationType } from "./verifactu";

const line = (unitPrice: number, quantity = 1, vatRate = 0.21) => ({ unitPrice, quantity, discount: 0, vatRate });

describe("verifactuInvoiceType", () => {
  // SuministroInformacion.xsd, ClaveTipoFacturaType: R1 to R4 by cause
  it("names a rectifying invoice by its cause", () => {
    expect(verifactuInvoiceType("normal")).toBe("F1");
    expect(verifactuInvoiceType("rectifying", { reason: "R3", method: "differences" })).toBe("R3");
  });

  it("takes R1 when the cause wasn't given", () => {
    expect(verifactuInvoiceType("rectifying")).toBe("R1");
  });
});

describe("verifactuRectificationType", () => {
  // SuministroInformacion.xsd, ClaveTipoRectificativaType: S sustitutiva, I incremental
  it("is S by substitution and I by differences", () => {
    expect(verifactuRectificationType("substitution")).toBe("S");
    expect(verifactuRectificationType("differences")).toBe("I");
  });
});

describe("substitution lines", () => {
  const original = [line(100, 2), line(50, 1, 0.1)];
  const corrected = [line(90, 2)];

  it("reverse the original, then carry the corrected invoice", () => {
    expect(substitutionLines(original, corrected)).toEqual([line(100, -2), line(50, -1, 0.1), line(90, 2)]);
  });

  it("give back the corrected lines", () => {
    expect(correctedLines(substitutionLines(original, corrected), original)).toEqual(corrected);
  });

  it("aren't a substitution unless every original line is reversed first", () => {
    expect(correctedLines([line(100, -2), line(90, 2)], original)).toBeNull();
    expect(correctedLines([reversedLine(original[1]!), reversedLine(original[0]!)], original)).toBeNull();
    expect(correctedLines([line(100, -1), line(50, -1, 0.1)], original)).toBeNull();
  });

  it("treat a missing surcharge as none", () => {
    expect(correctedLines([{ ...line(10, -1), surchargeRate: 0 }], [line(10)])).toEqual([]);
  });
});

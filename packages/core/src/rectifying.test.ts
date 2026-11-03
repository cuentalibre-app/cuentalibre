import { describe, expect, it } from "vitest";
import {
  correctedLines,
  fullyRectified,
  rectifiedPastZero,
  reversedLine,
  substitutionLines,
  unrectifiedLines,
} from "./rectifying";

const line = (unitPrice: number, quantity = 1, vatRate = 0.21) => ({ unitPrice, quantity, discount: 0, vatRate });

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

describe("repeated rectifications", () => {
  const item = (concept: string, unitPrice: number, quantity = 1, vatRate = 0.21) => ({
    ...line(unitPrice, quantity, vatRate),
    concept,
  });
  const original = [item("Consultoría", 100, 10), item("Libro", 20, 2, 0.04)];
  const reversed = (lines: typeof original) => lines.map(reversedLine);

  it("leave nothing after a full rectification, and reject a second one", () => {
    const full = reversed(original);
    expect(unrectifiedLines(original, [full])).toEqual([]);
    expect(fullyRectified(original, [full])).toBe(true);
    expect(rectifiedPastZero(original, [full])).toBe(false);
    expect(rectifiedPastZero(original, [full, full])).toBe(true);
    // Twice rectified before the guard: nothing is left either
    expect(fullyRectified(original, [full, full])).toBe(true);
  });

  it("add partial rectifications up to the total", () => {
    const march = [item("Consultoría", 100, -4)];
    const may = [item("Consultoría", 100, -6), item("Libro", 20, -2, 0.04)];
    expect(unrectifiedLines(original, [march])).toEqual([item("Consultoría", 100, 6), original[1]]);
    expect(fullyRectified(original, [march])).toBe(false);
    expect(fullyRectified(original, [march, may])).toBe(true);
    expect(rectifiedPastZero(original, [march, may])).toBe(false);
  });

  it("check every VAT rate on its own", () => {
    // 1.000 € off the 21 % base is more than it has, even if the 4 % base could take it
    expect(rectifiedPastZero(original, [[item("Consultoría", 100, -11)]])).toBe(true);
    expect(rectifiedPastZero(original, [[item("Libro", 20, -3, 0.04)]])).toBe(true);
  });

  it("net a reversed price like a reversed quantity", () => {
    expect(unrectifiedLines(original, [[item("Consultoría", -100, 4)]])).toEqual([
      item("Consultoría", 100, 6),
      original[1],
    ]);
  });

  it("keep lines that don't match an original one, like a later discount", () => {
    const discount = [item("Descuento", -50)];
    expect(unrectifiedLines(original, [discount])).toEqual([...original, item("Descuento", 50, -1)]);
    expect(rectifiedPastZero(original, [discount])).toBe(false);
  });

  it("leave the corrected invoice after a substitution", () => {
    const corrected = [item("Consultoría", 90, 10)];
    const substitution = substitutionLines(original, corrected);
    expect(unrectifiedLines(original, [substitution])).toEqual(corrected);
    expect(rectifiedPastZero(original, [substitution, reversed(corrected)])).toBe(false);
    expect(rectifiedPastZero(original, [substitution, reversed(original)])).toBe(true);
  });

  it("go back up when a rectification is undone, never above the original", () => {
    const march = [item("Consultoría", 100, -4)];
    expect(unrectifiedLines(original, [march, reversed(march)])).toEqual(original);
    expect(rectifiedPastZero(original, [march, reversed(march)])).toBe(false);
  });

  it("keep a negative original at or below zero", () => {
    const credit = [item("Abono", -100)];
    expect(rectifiedPastZero(credit, [reversed(credit)])).toBe(false);
    expect(fullyRectified(credit, [reversed(credit)])).toBe(true);
    expect(rectifiedPastZero(credit, [reversed(credit), reversed(credit)])).toBe(true);
    expect(rectifiedPastZero(credit, [[item("Abono", 100, 1, 0.1)]])).toBe(true);
  });

  it("allow the cents each invoice rounds its VAT to", () => {
    // 0,09 € at 21 % is 0,02 € of VAT; three rectifications of 0,03 € take 0,01 € each
    const small = [item("Tornillo", 0.03, 3)];
    const one = [item("Tornillo", 0.03, -1)];
    expect(rectifiedPastZero(small, [one, one, one])).toBe(false);
    expect(fullyRectified(small, [one, one, one])).toBe(true);
  });
});

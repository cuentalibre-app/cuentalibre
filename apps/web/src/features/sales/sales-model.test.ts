import type { SalesDocument } from "@cuentalibre/contracts";
import { reversedLine, substitutionLines } from "@cuentalibre/core";
import { describe, expect, it } from "vitest";
import { initialSalesDocuments } from "@/mocks/sales";
import { documentTotals, isFullyRectified, linesToRectify, originalToRectify, printedDocument } from "./sales-model";

const original = initialSalesDocuments.find((d) => d.kind === "invoice" && d.series === "normal" && !d.supplies)!;
const corrected = [{ ...original.lines[0]!, id: "corrected", unitPrice: 10 }];
const substitution: SalesDocument = {
  ...original,
  id: "substitution",
  series: "rectifying",
  rectifiesId: original.id,
  rectification: { reason: "R1", method: "substitution" },
  lines: substitutionLines(original.lines, corrected),
  issued: undefined,
};

describe("printedDocument", () => {
  it("prints a substitution as the corrected invoice, not as the change it books", () => {
    const printed = printedDocument(substitution, original);
    expect(printed.lines).toEqual(corrected);
    expect(documentTotals(printed).base).toBe(
      documentTotals({ ...original, lines: corrected, issued: undefined }).base,
    );
    expect(documentTotals(substitution).base).toBe(documentTotals(printed).base - documentTotals(original).base);
  });

  it("prints other documents as they are", () => {
    const differences = { ...substitution, rectification: { reason: "R4" as const, method: "differences" as const } };
    expect(printedDocument(differences, original)).toBe(differences);
    expect(printedDocument(original, undefined)).toBe(original);
  });
});

describe("rectifying again", () => {
  const first = original.lines[0]!;
  const partial: SalesDocument = {
    ...original,
    id: "partial",
    series: "rectifying",
    rectifiesId: original.id,
    rectification: { reason: "R1", method: "differences" },
    lines: [{ ...first, quantity: -first.quantity / 2 }],
    issued: undefined,
  };
  const docs = [original, partial];

  it("starts from what's left of the original", () => {
    expect(linesToRectify(original, [original])).toEqual(original.lines.map(reversedLine));
    const left = linesToRectify(original, docs);
    expect(left[0]).toMatchObject({ concept: first.concept, quantity: -first.quantity / 2 });
    expect(left).toHaveLength(original.lines.length);
    // Editing the partial one leaves it out
    expect(linesToRectify(original, docs, partial.id)).toEqual(original.lines.map(reversedLine));
  });

  it("is off once nothing is left", () => {
    const rest = { ...partial, id: "rest", lines: linesToRectify(original, docs) };
    expect(isFullyRectified(original, docs)).toBe(false);
    expect(isFullyRectified(original, [...docs, rest])).toBe(true);
  });

  it("from a rectifying invoice, rectifies the original and undoes that one", () => {
    expect(originalToRectify(partial, docs)).toBe(original);
    expect(originalToRectify(original, docs)).toBe(original);
    expect(linesToRectify(partial, docs)).toEqual(partial.lines.map(reversedLine));
  });
});

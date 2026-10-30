import type { SalesDocument } from "@cuentalibre/contracts";
import { substitutionLines } from "@cuentalibre/core";
import { describe, expect, it } from "vitest";
import { initialSalesDocuments } from "@/mocks/sales";
import { documentTotals, printedDocument } from "./sales-model";

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

import type { ExtractedPurchase } from "@cuentalibre/contracts";
import { cents } from "@cuentalibre/core";
import { describe, expect, it } from "vitest";
import {
  betterForm,
  draftTotal,
  expenseFlags,
  invoiceFlags,
  isReadable,
  linesFromDraft,
  withholdingKindOf,
} from "./reading-model";

const draft = (fields: Partial<ExtractedPurchase> = {}): ExtractedPurchase => ({
  kind: "invoice",
  supplier: { name: "Brisa Telecom SL", taxId: "B12345674", address: "", postalCode: "", city: "", country: "España" },
  number: "F-118",
  issuedOn: "2026-10-07",
  dueOn: null,
  concept: "Fibra y móvil",
  currency: "EUR",
  vatBreakdown: [{ rate: 0.21, base: cents(10000), vat: cents(2100), surchargeRate: 0, surcharge: cents(0) }],
  withholding: null,
  total: cents(12100),
  ...fields,
});

describe("reading a purchase", () => {
  it("reads PDFs and photos only", () => {
    expect(isReadable("factura.PDF")).toBe(true);
    expect(isReadable("ticket.heic")).toBe(true);
    expect(isReadable("contrato.docx")).toBe(false);
  });

  it("finds the withholding kind by its rate", () => {
    expect(withholdingKindOf(0.15)).toBe("professional");
    expect(withholdingKindOf(0.19)).toBe("rental");
    expect(withholdingKindOf(0.33)).toBe("none");
  });

  it("makes a concept per VAT rate, at its base in euros", () => {
    const lines = linesFromDraft(
      draft({
        vatBreakdown: [
          { rate: 0.21, base: cents(12345), vat: cents(2592), surchargeRate: 0.052, surcharge: cents(642) },
          { rate: 0.1, base: cents(500), vat: cents(50), surchargeRate: 0, surcharge: cents(0) },
        ],
      }),
    );
    expect(lines).toMatchObject([
      {
        concept: "Fibra y móvil",
        unitPrice: "123,45",
        quantity: "1",
        discount: "0",
        vatRate: 0.21,
        surchargeRate: 0.052,
      },
      { concept: "Fibra y móvil", unitPrice: "5", vatRate: 0.1, surchargeRate: 0 },
    ]);
  });

  it("adds up the breakdown when the document has no total", () => {
    expect(draftTotal(draft({ total: null, withholding: { rate: 0.15, amount: cents(1500) } }))).toBe(10600);
    expect(draftTotal(draft({ total: null, vatBreakdown: [] }))).toBeNull();
  });

  it("flags the invoice form's fields once, and trusts a matched supplier", () => {
    const issues = [
      { field: "supplier.taxId", code: "invalid" as const },
      { field: "vatBreakdown.0.vat", code: "mismatch" as const },
      { field: "vatBreakdown.1.rate", code: "invalid" as const },
      { field: "total", code: "mismatch" as const },
    ];
    expect(invoiceFlags(issues, false)).toEqual({
      supplierId: "El NIF leído no es válido: compáralo con el documento.",
      lines: "El IVA leído no cuadra con la base.",
    });
    expect(invoiceFlags(issues, true)).not.toHaveProperty("supplierId");
  });

  it("flags only the date, amount and payee of an expense", () => {
    const ticket = draft({ kind: "ticket", total: null, vatBreakdown: [] });
    expect(
      expenseFlags(
        [
          { field: "issuedOn", code: "missing" },
          { field: "number", code: "missing" },
          { field: "total", code: "missing" },
        ],
        ticket,
        false,
      ),
    ).toEqual({ date: "No se ha podido leer la fecha.", amount: "No se ha podido leer el importe." });
  });

  it("suggests the other form when the document fits it better", () => {
    const ticket = draft({ kind: "ticket", supplier: { ...draft().supplier, taxId: "" }, vatBreakdown: [] });
    expect(betterForm(ticket, "invoice")).toBe("expense");
    expect(betterForm(ticket, "expense")).toBeNull();
    expect(betterForm(draft(), "expense")).toBe("invoice");
    expect(betterForm(draft(), "invoice")).toBeNull();
  });
});

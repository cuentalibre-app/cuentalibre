import { describe, expect, it } from "vitest";
import { checkPurchaseDraft, findSupplierByTaxId, type PurchaseDraft } from "./extraction";
import type { Cents } from "./money";

const c = (value: number) => value as Cents;

const draft = (fields: Partial<PurchaseDraft> = {}): PurchaseDraft => ({
  kind: "invoice",
  supplier: { name: "Brisa Telecom SL", taxId: "B12345674", country: "España" },
  number: "F-118",
  issuedOn: "2026-10-07",
  currency: "EUR",
  // 100 € at 21 %, 50 € at 10 %, 15 % withholding
  vatBreakdown: [
    { rate: 0.21, base: c(10000), vat: c(2100), surchargeRate: 0, surcharge: c(0) },
    { rate: 0.1, base: c(5000), vat: c(500), surchargeRate: 0, surcharge: c(0) },
  ],
  withholding: { rate: 0.15, amount: c(2250) },
  total: c(15350),
  ...fields,
});

describe("checkPurchaseDraft", () => {
  it("passes an invoice whose amounts add up", () => {
    expect(checkPurchaseDraft(draft())).toEqual([]);
  });

  it("flags a Spanish tax ID with a wrong check character", () => {
    const supplier = { name: "Brisa Telecom SL", taxId: "B12345675", country: "España" };
    expect(checkPurchaseDraft(draft({ supplier }))).toEqual([{ field: "supplier.taxId", code: "invalid" }]);
  });

  it("checks a tax ID without a country as Spanish, unless it has another EU prefix", () => {
    const spanish = { name: "Brisa", taxId: "12345678A", country: "" };
    expect(checkPurchaseDraft(draft({ supplier: spanish }))).toEqual([{ field: "supplier.taxId", code: "invalid" }]);
    const french = { name: "OVH", taxId: "FR22424761419", country: "" };
    expect(checkPurchaseDraft(draft({ supplier: french }))).toEqual([]);
  });

  it("asks an invoice for the supplier's tax ID, its number and a VAT breakdown", () => {
    const issues = checkPurchaseDraft(
      draft({
        supplier: { name: "Brisa", taxId: "", country: "España" },
        number: " ",
        vatBreakdown: [],
        withholding: null,
        total: c(12100),
      }),
    );
    expect(issues).toEqual([
      { field: "supplier.taxId", code: "missing" },
      { field: "number", code: "missing" },
      { field: "vatBreakdown", code: "missing" },
    ]);
  });

  it("asks a ticket only for who, when and how much", () => {
    const ticket = draft({
      kind: "ticket",
      supplier: { name: "Aparcamiento Centro", taxId: "", country: "" },
      number: "",
      vatBreakdown: [],
      withholding: null,
      total: c(1250),
    });
    expect(checkPurchaseDraft(ticket)).toEqual([]);
    expect(
      checkPurchaseDraft({ ...ticket, supplier: { ...ticket.supplier, name: "" }, issuedOn: null, total: null }),
    ).toEqual([
      { field: "supplier.name", code: "missing" },
      { field: "issuedOn", code: "missing" },
      { field: "total", code: "missing" },
    ]);
  });

  it("flags a VAT rate Spain doesn't use, and VAT that isn't the base times the rate", () => {
    const issues = checkPurchaseDraft(
      draft({
        vatBreakdown: [
          { rate: 0.19, base: c(10000), vat: c(1900), surchargeRate: 0, surcharge: c(0) },
          { rate: 0.1, base: c(5000), vat: c(550), surchargeRate: 0, surcharge: c(0) },
        ],
        withholding: null,
        total: c(17450),
      }),
    );
    expect(issues).toEqual([
      { field: "vatBreakdown.0.rate", code: "invalid" },
      { field: "vatBreakdown.1.vat", code: "mismatch" },
    ]);
  });

  it("allows a cent of rounding per line", () => {
    const issues = checkPurchaseDraft(
      draft({
        vatBreakdown: [
          { rate: 0.21, base: c(1003), vat: c(211), surchargeRate: 0, surcharge: c(0) },
          { rate: 0.1, base: c(1005), vat: c(100), surchargeRate: 0, surcharge: c(0) },
        ],
        withholding: null,
        total: c(2320),
      }),
    );
    expect(issues).toEqual([]);
  });

  it("checks the equivalence surcharge against its VAT rate", () => {
    const line = { rate: 0.21, base: c(10000), vat: c(2100), surchargeRate: 0.052, surcharge: c(520) };
    expect(checkPurchaseDraft(draft({ vatBreakdown: [line], withholding: null, total: c(12620) }))).toEqual([]);
    const wrong = { ...line, surchargeRate: 0.014, surcharge: c(140) };
    expect(checkPurchaseDraft(draft({ vatBreakdown: [wrong], withholding: null, total: c(12240) }))).toEqual([
      { field: "vatBreakdown.0.surchargeRate", code: "invalid" },
    ]);
  });

  it("flags a withholding rate that doesn't exist, or an amount that isn't the rate on the base", () => {
    expect(checkPurchaseDraft(draft({ withholding: { rate: 0.12, amount: c(1800) }, total: c(15800) }))).toEqual([
      { field: "withholding.rate", code: "invalid" },
    ]);
    expect(checkPurchaseDraft(draft({ withholding: { rate: 0.15, amount: c(1500) }, total: c(16100) }))).toEqual([
      { field: "withholding.amount", code: "mismatch" },
    ]);
  });

  it("flags a total that isn't base plus VAT minus withholding", () => {
    expect(checkPurchaseDraft(draft({ total: c(17600) }))).toEqual([{ field: "total", code: "mismatch" }]);
  });

  it("adds up credit notes, whose amounts are negative", () => {
    const credit = draft({
      vatBreakdown: [{ rate: 0.21, base: c(-10000), vat: c(-2100), surchargeRate: 0, surcharge: c(0) }],
      withholding: { rate: 0.15, amount: c(-1500) },
      total: c(-10600),
    });
    expect(checkPurchaseDraft(credit)).toEqual([]);
  });

  it("flags a currency other than the euro", () => {
    expect(checkPurchaseDraft(draft({ currency: "USD" }))).toEqual([{ field: "currency", code: "invalid" }]);
  });
});

describe("findSupplierByTaxId", () => {
  const suppliers = [
    { id: "a", taxId: "B12345674" },
    { id: "b", taxId: "" },
  ];

  it("matches however the tax ID is typed", () => {
    expect(findSupplierByTaxId("ES-B12.345.674", suppliers)?.id).toBe("a");
  });

  it("never matches an empty tax ID", () => {
    expect(findSupplierByTaxId("", suppliers)).toBeUndefined();
  });
});

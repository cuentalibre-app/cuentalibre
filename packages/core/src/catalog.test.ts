import { describe, expect, it } from "vitest";
import {
  documentTakesStock,
  familyPath,
  familyWithDescendants,
  isCatalogUnit,
  parseYesNo,
  priceBreakdown,
  quantitiesByProduct,
  resolveFamilyPath,
  stockAlarm,
  stockChanges,
  stockLevel,
  stockOf,
  stockShortages,
  surchargeFitsVat,
  withStockAfter,
  type CatalogFamily,
  type StockMovement,
  type StockRules,
} from "./catalog";
import { eurosToCents } from "./money";

const eur = eurosToCents;

describe("priceBreakdown", () => {
  it("applies the discount, then VAT and surcharge on the discounted base", () => {
    expect(priceBreakdown(198.5, { discount: 0.1, vatRate: 0.21, surchargeRate: 0.052 })).toEqual({
      base: eur(178.65),
      vat: eur(37.52),
      surcharge: eur(9.29),
      total: eur(225.46),
    });
  });

  it("defaults to no discount and no taxes", () => {
    expect(priceBreakdown(50)).toEqual({ base: eur(50), vat: 0, surcharge: 0, total: eur(50) });
  });
});

describe("surchargeFitsVat", () => {
  it("pairs each surcharge with its VAT rate", () => {
    expect(surchargeFitsVat(0.21, 0.052)).toBe(true);
    expect(surchargeFitsVat(0.21, 0.0175)).toBe(true);
    expect(surchargeFitsVat(0.1, 0.014)).toBe(true);
    expect(surchargeFitsVat(0.04, 0.005)).toBe(true);
    expect(surchargeFitsVat(0.1, 0.052)).toBe(false);
    expect(surchargeFitsVat(0, 0.052)).toBe(false);
  });

  it("always accepts no surcharge", () => {
    expect(surchargeFitsVat(0.18, 0)).toBe(true);
    expect(surchargeFitsVat(0, 0)).toBe(true);
  });
});

describe("units", () => {
  it("knows the reference app's unit codes", () => {
    expect(isCatalogUnit("h")).toBe(true);
    expect(isCatalogUnit("1/2j")).toBe(true);
    expect(isCatalogUnit("horas")).toBe(false);
  });
});

const move = (
  productId: string,
  quantity: number,
  at: string,
  kind: StockMovement["kind"] = "manual",
): StockMovement => ({
  id: `${productId}-${at}`,
  productId,
  quantity,
  at,
  kind,
});

describe("stock", () => {
  const movements = [
    move("a", 10, "2026-01-01T09:00", "initial"),
    move("b", 5, "2026-01-02T09:00", "initial"),
    move("a", -3, "2026-02-01T10:00", "invoice"),
    move("a", 0.1, "2026-02-01T11:00"),
    move("a", 0.2, "2026-01-15T11:00"),
  ];

  it("adds up the product's movements", () => {
    expect(stockOf(movements, "a")).toBe(7.3);
    expect(stockOf(movements, "b")).toBe(5);
    expect(stockOf(movements, "c")).toBe(0);
  });

  it("gives the stock after each movement in date order", () => {
    expect(withStockAfter(movements).map((m) => [m.productId, m.stockAfter])).toEqual([
      ["a", 10],
      ["b", 5],
      ["a", 10.2],
      ["a", 7.2],
      ["a", 7.3],
    ]);
  });

  it("classifies the level and the alarm", () => {
    expect(stockLevel(-1)).toBe("negative");
    expect(stockLevel(0)).toBe("zero");
    expect(stockLevel(2)).toBe("positive");
    expect(stockAlarm(0, 5)).toBe("out");
    expect(stockAlarm(-2, 5)).toBe("out");
    expect(stockAlarm(4, 5)).toBe("low");
    expect(stockAlarm(5, 5)).toBe("ok");
  });
});

describe("stock and documents", () => {
  it("sums the units of each product and skips free lines", () => {
    const q = quantitiesByProduct([
      { productId: "a", quantity: 2 },
      { quantity: 7 },
      { productId: "a", quantity: 1.5 },
      { productId: "b", quantity: 1 },
    ]);
    expect([...q]).toEqual([
      ["a", 3.5],
      ["b", 1],
    ]);
  });

  it("turns an edit into the units to put back or take out", () => {
    const before = new Map([
      ["a", 3],
      ["b", 1],
    ]);
    const after = new Map([
      ["a", 5],
      ["c", 2],
    ]);
    expect([...stockChanges(before, after)]).toEqual([
      ["a", -2],
      ["b", 1],
      ["c", -2],
    ]);
    expect(stockChanges(before, before).size).toBe(0);
    expect([...stockChanges(before, new Map())]).toEqual([
      ["a", 3],
      ["b", 1],
    ]);
  });

  const never: StockRules = { invoices: "never", deliveryNotes: "never", quotes: "never", drafts: "never" };

  it("never takes stock with the default settings", () => {
    for (const kind of ["invoice", "draft", "quote", "deliveryNote"] as const)
      expect(documentTakesStock(kind, undefined, never)).toBe(false);
  });

  it("takes stock on invoices and delivery notes when they are created", () => {
    const rules: StockRules = { ...never, invoices: "createEdit", deliveryNotes: "createEdit" };
    expect(documentTakesStock("invoice", undefined, rules)).toBe(true);
    expect(documentTakesStock("deliveryNote", undefined, rules)).toBe(true);
    expect(documentTakesStock("quote", undefined, rules)).toBe(false);
    // The delivery note already took it
    expect(documentTakesStock("invoice", "deliveryNote", rules)).toBe(false);
  });

  it("takes stock when a delivery note, quote or draft is invoiced", () => {
    expect(documentTakesStock("invoice", "deliveryNote", { ...never, deliveryNotes: "invoice" })).toBe(true);
    expect(documentTakesStock("invoice", "quote", { ...never, quotes: "invoice" })).toBe(true);
    expect(documentTakesStock("invoice", "draft", { ...never, drafts: "invoice" })).toBe(true);
    expect(documentTakesStock("invoice", "draft", never)).toBe(false);
    expect(documentTakesStock("draft", undefined, { ...never, drafts: "invoice" })).toBe(false);
  });

  it("takes stock when a quote becomes a delivery note", () => {
    expect(documentTakesStock("deliveryNote", "quote", { ...never, quotes: "deliveryNote" })).toBe(true);
    expect(documentTakesStock("deliveryNote", undefined, { ...never, quotes: "deliveryNote" })).toBe(false);
  });

  it("finds sales that would leave a product without stock", () => {
    const wanted = new Map([
      ["a", 4],
      ["b", 10],
      ["free", 100],
    ]);
    const available = new Map([
      ["a", 4],
      ["b", 3],
    ]);
    expect(stockShortages(wanted, available)).toEqual([{ productId: "b", wanted: 10, available: 3 }]);
  });
});

describe("families", () => {
  const families: CatalogFamily[] = [
    { id: "1", name: "Diseño", parentId: null },
    { id: "2", name: "Web", parentId: "1" },
    { id: "3", name: "Landing", parentId: "2" },
    { id: "4", name: "Impresión", parentId: null },
  ];

  it("names the path from the top", () => {
    expect(familyPath(families, "3")).toEqual(["Diseño", "Web", "Landing"]);
    expect(familyPath(families, null)).toEqual([]);
    expect(familyPath(families, "x")).toEqual([]);
  });

  it("includes every subfamily", () => {
    expect([...familyWithDescendants(families, "1")].sort()).toEqual(["1", "2", "3"]);
    expect([...familyWithDescendants(families, "4")]).toEqual(["4"]);
  });

  it("reuses existing families and creates the missing ones", () => {
    let n = 0;
    const found = resolveFamilyPath(families, ["diseno", " WEB "], () => `new${++n}`);
    expect(found).toEqual({ id: "2", created: [] });

    const made = resolveFamilyPath(families, ["Diseño", "Branding", "Logos"], () => `new${++n}`);
    expect(made.id).toBe("new2");
    expect(made.created).toEqual([
      { id: "new1", name: "Branding", parentId: "1" },
      { id: "new2", name: "Logos", parentId: "new1" },
    ]);

    expect(resolveFamilyPath(families, [], () => "x")).toEqual({ id: null, created: [] });
  });
});

describe("parseYesNo", () => {
  it("reads yes, no and empty", () => {
    expect(parseYesNo("Sí")).toBe(true);
    expect(parseYesNo("SI")).toBe(true);
    expect(parseYesNo("No")).toBe(false);
    expect(parseYesNo(" ")).toBeNull();
    expect(parseYesNo("quizá")).toBeUndefined();
  });
});

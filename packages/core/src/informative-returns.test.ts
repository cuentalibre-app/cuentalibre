import { describe, expect, it } from "vitest";
import { obligation } from "./deadlines";
import {
  excludedFrom347,
  model111,
  model115,
  model180,
  model190,
  model347,
  model349,
  periods349,
  splitVatNumber,
  type PartyOperation,
} from "./informative-returns";
import { applyRate, cents, eurosToCents } from "./money";

const eur = eurosToCents;

let seq = 0;

/** An operation with its base in euros, for readable fixtures. */
function op(date: string, base: number, extra: Partial<PartyOperation> = {}): PartyOperation {
  const withholdingRate = extra.withholdingRate ?? 0;
  return {
    id: `o${++seq}`,
    date,
    side: "purchase",
    contactId: "s1",
    abroad: false,
    operation: "national",
    goods: false,
    base: eur(base),
    total: applyRate(eur(base), 1.21),
    withholding: applyRate(eur(base), withholdingRate),
    withholdingRate,
    rental: false,
    account: "623",
    cash: cents(0),
    ...extra,
  };
}

describe("model111", () => {
  const ops = [
    op("2026-01-10", 100, { withholdingRate: 0.15 }),
    op("2026-02-10", 100, { withholdingRate: 0.15 }),
    op("2026-03-10", 200, { contactId: "s2", withholdingRate: 0.07 }),
    op("2026-03-12", 300, { contactId: "s3", account: "6231", withholdingRate: 0.15 }),
    // Not in Q1, a rental, and an invoice without withholding
    op("2026-04-01", 100, { withholdingRate: 0.15 }),
    op("2026-01-05", 500, { contactId: "s9", rental: true, account: "621", withholdingRate: 0.19 }),
    op("2026-01-06", 80),
  ];

  it("splits earned income and professional activities and counts perceptors once", () => {
    const r = model111(ops, 2026, 1);
    expect(r.boxes).toMatchObject({
      "01": 1,
      "02": eur(300),
      "03": eur(45),
      "07": 2,
      "08": eur(400),
      "09": eur(44),
      "28": eur(89),
      "30": eur(89),
    });
    expect(r.documentIds).toHaveLength(4);
  });

  it("lists perceptors with the key and subkey of form 190", () => {
    const r = model111(ops, 2026, 1);
    expect(r.perceptors.map((p) => [p.contactId, p.key, p.subkey, p.withholding])).toEqual([
      ["s3", "F", "01", eur(45)],
      ["s1", "G", "01", eur(30)],
      ["s2", "G", "02", eur(14)],
    ]);
  });

  it("is zero without withheld invoices", () => {
    expect(model111([], 2026, 2).boxes["30"]).toBe(0);
  });
});

describe("model190", () => {
  it("sums the year per perceptor and matches the quarterly 111", () => {
    const ops = [
      op("2026-01-10", 100, { withholdingRate: 0.15 }),
      op("2026-05-10", 100, { withholdingRate: 0.15 }),
      op("2025-12-10", 100, { withholdingRate: 0.15 }),
    ];
    const r = model190(ops, 2026);
    expect(r.perceptors).toHaveLength(1);
    expect(r.perceptors[0]).toMatchObject({ base: eur(200), withholding: eur(30), rate: 0.15 });
    expect(r.paid).toEqual([15, 15, 0, 0].map(eur));
    expect(r.withholding).toBe(eur(30));
  });

  it("flags mixed rates with a null rate", () => {
    const ops = [op("2026-01-10", 100, { withholdingRate: 0.15 }), op("2026-02-10", 100, { withholdingRate: 0.07 })];
    expect(model190(ops, 2026).perceptors[0]!.rate).toBeNull();
  });
});

describe("rentals: model115 and model180", () => {
  const rent = (date: string, extra: Partial<PartyOperation> = {}) =>
    op(date, 500, {
      contactId: "l1",
      rental: true,
      account: "621",
      withholdingRate: 0.19,
      cadastralRef: "REF1",
      ...extra,
    });
  const ops = [
    rent("2026-01-01"),
    rent("2026-02-01"),
    rent("2026-03-01", { contactId: "l2", cadastralRef: "REF2", rentalLocation: "navarre" }),
    rent("2026-04-01", { cadastralRef: "REF3" }),
    // A coworking desk booked as a rental without withholding
    rent("2026-01-15", { contactId: "c1", withholdingRate: 0 }),
  ];

  it("computes the quarter's withholdings", () => {
    expect(model115(ops, 2026, 1).boxes).toEqual({ "01": 2, "02": eur(1500), "03": eur(285), "04": 0, "05": eur(285) });
  });

  it("reports one record per landlord and property", () => {
    const r = model180(ops, 2026);
    expect(r.landlords.map((l) => [l.contactId, l.cadastralRef, l.situation, l.withholding])).toEqual([
      ["l1", "REF1", "1", eur(190)],
      ["l2", "REF2", "2", eur(95)],
      ["l1", "REF3", "1", eur(95)],
    ]);
    expect(r.paid).toEqual([285, 95, 0, 0].map(eur));
  });

  it("warns about rentals with an unusual rate", () => {
    expect(model180(ops, 2026).unusual.map((o) => o.contactId)).toEqual(["c1"]);
  });
});

describe("model347", () => {
  const sale = (date: string, total: number, extra: Partial<PartyOperation> = {}) =>
    op(date, total / 1.21, { side: "sale", contactId: "c1", total: eur(total), account: "705", ...extra });

  it("reports parties above 3.005,06 € with their quarters, sales and purchases apart", () => {
    const ops = [
      sale("2026-01-10", 2000),
      sale("2026-07-10", 1500),
      op("2026-03-01", 3000, { contactId: "c1", total: eur(3630) }),
      sale("2026-02-01", 3000, { contactId: "c2" }),
    ];
    const r = model347(ops, 2026);
    expect(r.declared.map((d) => [d.contactId, d.key, d.total, d.quarters])).toEqual([
      ["c1", "A", eur(3630), [3630, 0, 0, 0].map(eur)],
      ["c1", "B", eur(3500), [2000, 0, 1500, 0].map(eur)],
    ]);
    expect(r.belowThreshold.map((d) => d.contactId)).toEqual(["c2"]);
  });

  it("leaves out withheld, foreign and unidentified operations and excluded contacts", () => {
    expect(excludedFrom347(sale("2026-01-01", 5000, { withholding: eur(600) }))).toMatch(/retención/);
    expect(excludedFrom347(sale("2026-01-01", 5000, { operation: "intraEu" }))).toMatch(/extranjero/);
    expect(excludedFrom347(op("2026-01-01", 5000, { operation: "reverseCharge", abroad: true }))).toMatch(/extranjero/);
    expect(excludedFrom347(op("2026-01-01", 5000, { contactId: "" }))).toMatch(/identificado/);
    expect(excludedFrom347(sale("2026-01-01", 5000), new Set(["c1"]))).toMatch(/excluido/);
    expect(excludedFrom347(sale("2026-01-01", 5000))).toBeNull();
  });

  it("reports cash collected only above 6.000 €", () => {
    const ops = [
      sale("2026-01-10", 7000, { cash: eur(7000) }),
      sale("2026-01-10", 4000, { contactId: "c2", cash: eur(4000) }),
    ];
    const r = model347(ops, 2026);
    expect(r.declared.map((d) => d.cash)).toEqual([7000, 0].map(eur));
  });
});

describe("model349", () => {
  const ops = [
    op("2026-01-10", 1000, { side: "sale", contactId: "c1", operation: "intraEu" }),
    op("2026-02-10", 500, { side: "sale", contactId: "c1", operation: "intraEu" }),
    op("2026-02-11", 300, { side: "sale", contactId: "c1", operation: "intraEu", goods: true }),
    op("2026-03-02", 60, { contactId: "s4", operation: "intraEu" }),
    op("2026-03-03", 40, { contactId: "s5", operation: "reverseCharge" }),
    op("2026-04-02", 60, { contactId: "s4", operation: "intraEu" }),
  ];

  it("groups by operator and key within the period", () => {
    const r = model349(ops, { year: 2026, months: [0, 1, 2] });
    expect(r.operations.map((o) => [o.contactId, o.key, o.base])).toEqual([
      ["c1", "E", eur(300)],
      ["s4", "I", eur(60)],
      ["c1", "S", eur(1500)],
    ]);
    expect(r.operators).toBe(3);
    expect(r.total).toBe(eur(1860));
  });

  it("covers one month for monthly filers", () => {
    expect(model349(ops, { year: 2026, months: [1] }).total).toBe(eur(800));
  });

  it("lists the periods of each periodicity", () => {
    expect(periods349(2026, "quarterly")[1]).toEqual({ key: "2026-T2", months: [3, 4, 5] });
    expect(periods349(2026, "bimonthly")[0]!.months).toEqual([0, 1]);
    expect(periods349(2026, "monthly")).toHaveLength(12);
  });

  it("splits the country code off EU VAT numbers", () => {
    expect(splitVatNumber("IE6364992H")).toEqual({ code: "IE", number: "6364992H" });
    expect(splitVatNumber("10313492Q", "Chipre")).toEqual({ code: "CY", number: "10313492Q" });
    expect(splitVatNumber("EL123456789")).toEqual({ code: "EL", number: "123456789" });
  });
});

describe("obligation", () => {
  it("gives each form its own window", () => {
    expect(obligation("111", 2026, 4).dueOn).toEqual(new Date(2027, 0, 20));
    // January 30th, 2027 is a Saturday
    expect(obligation("303", 2026, 4).dueOn).toEqual(new Date(2027, 1, 1));
    expect(obligation("347", 2026, null).dueOn).toEqual(new Date(2027, 2, 1));
  });
});

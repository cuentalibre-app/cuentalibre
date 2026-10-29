import { describe, expect, it } from "vitest";
import {
  annualVolume303,
  expenseBox100,
  filedReturnsOf,
  hardToJustify,
  incomeTaxReturns,
  incomeTaxYear,
  installmentReduction,
  model100,
  model130,
  model303,
  model390,
  vatReturns,
  type TaxableExpense,
  type TaxablePurchase,
  type TaxableSale,
  type TaxBooks,
} from "./tax-returns";
import { applyRate, cents, eurosToCents, type Cents } from "./money";

const eur = eurosToCents;

let seq = 0;

function sale(date: string, base: Cents, extra: Partial<TaxableSale> = {}): TaxableSale {
  const rate = 0.21;
  return {
    id: `s${++seq}`,
    date,
    operation: "national",
    rectifying: false,
    vatBreakdown: [{ rate, base, vat: applyRate(base, rate) }],
    withholding: applyRate(base, 0.15),
    rental: false,
    ...extra,
  };
}

function purchase(date: string, base: Cents, extra: Partial<TaxablePurchase> = {}): TaxablePurchase {
  const operation = extra.operation ?? "national";
  const rate = operation === "national" || operation === "import" ? 0.21 : 0;
  return {
    id: `p${++seq}`,
    date,
    operation,
    creditNote: false,
    goods: false,
    vatBreakdown: [{ rate, base, vat: applyRate(base, rate) }],
    vatShare: 1,
    expense: base,
    account: "629",
    ...extra,
  };
}

const expense = (date: string, amount: Cents, account = "6422"): TaxableExpense => ({
  id: `e${++seq}`,
  date,
  expense: amount,
  account,
});

const books = (b: Partial<TaxBooks>): TaxBooks => ({ sales: [], purchases: [], expenses: [], ...b });

describe("model303", () => {
  it("puts output VAT in the boxes of its rate and the deductible VAT in 28/29", () => {
    const r = model303(
      books({
        sales: [
          sale("2026-07-10", eur(1_000)),
          sale("2026-08-10", eur(200), { vatBreakdown: [{ rate: 0.1, base: eur(200), vat: eur(20) }] }),
        ],
        purchases: [purchase("2026-09-01", eur(100))],
      }),
      2026,
      3,
    );
    expect(r.boxes).toMatchObject({
      "07": eur(1_000),
      "08": 21,
      "09": eur(210),
      "04": eur(200),
      "05": 10,
      "06": eur(20),
    });
    expect(r.boxes).toMatchObject({
      "27": eur(230),
      "28": eur(100),
      "29": eur(21),
      "45": eur(21),
      "46": eur(209),
      "71": eur(209),
    });
    expect(r.result).toBe(eur(209));
    expect(r.hasActivity).toBe(true);
  });

  it("ignores documents of other quarters", () => {
    const r = model303(books({ sales: [sale("2026-06-30", eur(1_000))] }), 2026, 3);
    expect(r.result).toBe(0);
    expect(r.hasActivity).toBe(false);
  });

  it("self-assesses intra-EU and reverse-charge purchases at the general rate", () => {
    const r = model303(
      books({
        purchases: [
          purchase("2026-07-12", eur(60), { operation: "intraEu" }),
          purchase("2026-07-02", eur(40), { operation: "reverseCharge" }),
        ],
      }),
      2026,
      3,
    );
    expect(r.boxes).toMatchObject({ "10": eur(60), "11": eur(12.6), "36": eur(60), "37": eur(12.6) });
    expect(r.boxes).toMatchObject({ "12": eur(40), "13": eur(8.4), "28": eur(40), "29": eur(8.4) });
    // Charged and deducted at once: no effect on the result
    expect(r.result).toBe(0);
  });

  it("deducts the VAT of investment goods in their own boxes", () => {
    const r = model303(
      books({
        purchases: [
          purchase("2026-07-12", eur(1_000), { investment: true }),
          purchase("2026-07-13", eur(500), { investment: true, operation: "import" }),
          purchase("2026-07-14", eur(200), { investment: true, operation: "intraEu" }),
        ],
      }),
      2026,
      3,
    );
    expect(r.boxes).toMatchObject({
      "30": eur(1_000),
      "31": eur(210),
      "34": eur(500),
      "35": eur(105),
      "38": eur(200),
      "39": eur(42),
    });
    expect(r.boxes["28"] ?? 0).toBe(0);
    expect(r.boxes["45"]).toBe(eur(357));
  });

  it("deducts only the deductible share of VAT", () => {
    const r = model303(books({ purchases: [purchase("2026-07-12", eur(100), { vatShare: 0.5 })] }), 2026, 3);
    expect(r.boxes).toMatchObject({ "28": eur(50), "29": eur(10.5) });
  });

  it("leaves purchases without VAT out of the deduction bases", () => {
    const r = model303(
      books({
        purchases: [
          purchase("2026-07-12", eur(100)),
          purchase("2026-07-13", eur(21.78), { vatBreakdown: [{ rate: 0, base: eur(21.78), vat: cents(0) }] }),
        ],
      }),
      2026,
      3,
    );
    expect(r.boxes).toMatchObject({ "28": eur(100), "29": eur(21) });
    expect(r.unmappedBase).toBe(0);
  });

  it("reports rectifying invoices and credit notes as modifications", () => {
    const r = model303(
      books({
        sales: [sale("2026-07-10", eur(-100), { rectifying: true })],
        purchases: [purchase("2026-07-11", eur(-50), { creditNote: true })],
      }),
      2026,
      3,
    );
    expect(r.boxes).toMatchObject({ "14": eur(-100), "15": eur(-21), "40": eur(-50), "41": eur(-10.5) });
  });

  it("lists operations without VAT in the additional information boxes", () => {
    const r = model303(
      books({
        sales: [
          sale("2026-07-10", eur(3_000), {
            operation: "intraEu",
            vatBreakdown: [{ rate: 0, base: eur(3_000), vat: cents(0) }],
          }),
          sale("2026-07-11", eur(500), {
            operation: "export",
            vatBreakdown: [{ rate: 0, base: eur(500), vat: cents(0) }],
          }),
          sale("2026-07-12", eur(300), {
            operation: "notSubject",
            vatBreakdown: [{ rate: 0, base: eur(300), vat: cents(0) }],
          }),
          sale("2026-07-13", eur(200), {
            operation: "reverseCharge",
            vatBreakdown: [{ rate: 0, base: eur(200), vat: cents(0) }],
          }),
        ],
      }),
      2026,
      3,
    );
    expect(r.boxes).toMatchObject({ "59": eur(3_000), "60": eur(500), "120": eur(300), "122": eur(200), "27": 0 });
  });

  it("keeps rates the form doesn't have apart", () => {
    const r = model303(
      books({ sales: [sale("2026-07-10", eur(100), { vatBreakdown: [{ rate: 0.05, base: eur(100), vat: eur(5) }] })] }),
      2026,
      3,
    );
    expect(r.unmappedBase).toBe(eur(100));
  });

  it("offsets what is pending up to the positive result", () => {
    const r = model303(books({ sales: [sale("2026-07-10", eur(1_000))] }), 2026, 3, eur(300));
    expect(r.boxes).toMatchObject({ "110": eur(300), "78": eur(210), "87": eur(90), "71": 0 });
  });
});

describe("vatReturns", () => {
  it("carries a negative result into the next quarters and years", () => {
    const b = books({
      sales: [sale("2026-04-10", eur(1_000)), sale("2026-07-10", eur(1_000))],
      purchases: [purchase("2025-11-10", eur(500)), purchase("2026-02-10", eur(1_000))],
    });
    const [q1, q2, q3] = vatReturns(b, 2026);
    expect(q1!.boxes["110"]).toBe(eur(105));
    expect(q1!.result).toBe(eur(-210));
    expect(q2!.boxes).toMatchObject({ "110": eur(315), "78": eur(210), "71": 0 });
    expect(q3!.boxes).toMatchObject({ "110": eur(105), "78": eur(105), "71": eur(105) });
  });

  it("starts from what a filed return left pending", () => {
    const b = books({
      sales: [sale("2026-04-10", eur(1_000))],
      purchases: [purchase("2026-02-10", eur(1_000))],
    });
    // Q1 was filed before a purchase of 500 € was booked in it: only 105 € were left to offset
    const filed = { "303": { "2026-T1": { "87": 0, "71": -eur(105) } } };
    const [, q2] = vatReturns({ ...b, filed }, 2026);
    expect(q2!.boxes).toMatchObject({ "110": eur(105), "78": eur(105), "71": eur(105) });
  });
});

describe("filedReturnsOf", () => {
  it("keeps the latest version of each return", () => {
    expect(
      filedReturnsOf([
        { form: "303", period: "2026-T1", boxes: { "71": 100 } },
        { form: "130", period: "2026-T1", boxes: { "07": 50 } },
        { form: "303", period: "2026-T1", boxes: { "71": 120 } },
      ]),
    ).toEqual({ "303": { "2026-T1": { "71": 120 } }, "130": { "2026-T1": { "07": 50 } } });
  });
});

describe("annualVolume303", () => {
  it("takes the year's volume of operations from form 390, all in the common territory", () => {
    const b = books({
      sales: [
        sale("2026-02-10", eur(1_000)),
        sale("2026-11-10", eur(4_000), {
          operation: "intraEu",
          vatBreakdown: [{ rate: 0, base: eur(4_000), vat: cents(0) }],
        }),
        sale("2026-12-10", eur(500), {
          operation: "export",
          vatBreakdown: [{ rate: 0, base: eur(500), vat: cents(0) }],
        }),
        sale("2025-12-10", eur(9_000)),
      ],
    });
    expect(annualVolume303(b, 2026)).toEqual({
      "80": eur(1_000),
      "81": 0,
      "93": eur(4_000),
      "94": eur(500),
      "83": 0,
      "84": 0,
      "125": 0,
      "88": eur(5_500),
      "107": 100,
    });
  });
});

describe("model390", () => {
  it("summarizes the year by rate and section", () => {
    const b = books({
      sales: [
        sale("2026-02-10", eur(1_000)),
        sale("2026-05-10", eur(4_000), {
          operation: "intraEu",
          vatBreakdown: [{ rate: 0, base: eur(4_000), vat: cents(0) }],
        }),
      ],
      purchases: [
        purchase("2026-03-01", eur(100)),
        purchase("2026-03-02", eur(20), { operation: "intraEu" }),
        purchase("2026-03-03", eur(50), { operation: "intraEu", goods: true }),
        purchase("2026-03-04", eur(10), { operation: "reverseCharge" }),
      ],
    });
    const r = model390(b, 2026);
    expect(r.boxes).toMatchObject({
      "05": eur(1_000),
      "06": eur(210),
      "551": eur(20),
      "552": eur(4.2),
      "25": eur(50),
      "26": eur(10.5),
    });
    expect(r.boxes).toMatchObject({ "27": eur(10), "28": eur(2.1), "33": eur(1_080), "34": eur(226.8) });
    expect(r.boxes).toMatchObject({
      "605": eur(110),
      "606": eur(23.1),
      "637": eur(20),
      "638": eur(4.2),
      "629": eur(50),
      "630": eur(10.5),
    });
    expect(r.boxes).toMatchObject({ "64": eur(37.8), "65": eur(189), "86": eur(189) });
    expect(r.boxes).toMatchObject({ "99": eur(1_000), "103": eur(4_000), "108": eur(5_000) });
  });

  it("leaves purchases without VAT out of the deduction bases", () => {
    const b = books({
      purchases: [purchase("2026-03-01", eur(50), { vatBreakdown: [{ rate: 0, base: eur(50), vat: cents(0) }] })],
    });
    const r = model390(b, 2026);
    expect(r.boxes["605"] ?? 0).toBe(0);
    expect(r.unmappedBase).toBe(0);
  });

  it("takes the quarterly results and what was pending when the year started", () => {
    const b = books({
      sales: [sale("2026-04-10", eur(1_000))],
      purchases: [purchase("2025-11-10", eur(500))],
    });
    const r = model390(b, 2026);
    expect(r.quarters).toEqual([0, 105, 0, 0].map(eur));
    expect(r.boxes).toMatchObject({ "85": eur(105), "95": eur(105), "86": eur(105) });
  });
});

describe("hardToJustify", () => {
  it("is 5 % of the net income, up to 2.000 €", () => {
    expect(hardToJustify(eur(10_000), 2026)).toBe(eur(500));
    expect(hardToJustify(eur(100_000), 2026)).toBe(eur(2_000));
    expect(hardToJustify(eur(-500), 2026)).toBe(0);
  });

  it("was 7 % in 2023", () => {
    expect(hardToJustify(eur(10_000), 2023)).toBe(eur(700));
  });
});

describe("installmentReduction", () => {
  it("steps down with the previous year's net income", () => {
    expect(installmentReduction(null)).toBe(0);
    expect(installmentReduction(eur(8_000))).toBe(eur(100));
    expect(installmentReduction(eur(9_500))).toBe(eur(75));
    expect(installmentReduction(eur(10_500))).toBe(eur(50));
    expect(installmentReduction(eur(12_000))).toBe(eur(25));
    expect(installmentReduction(eur(12_001))).toBe(0);
  });
});

describe("model130", () => {
  const simplified = { simplified: true };

  it("works out the installment from the income and expenses since January", () => {
    const b = books({
      sales: [sale("2026-02-10", eur(10_000), { withholding: cents(0) })],
      expenses: [expense("2026-03-01", eur(2_000))],
    });
    const r = model130(b, 2026, 1, simplified);
    // Net 8.000 €, minus 5 % hard-to-justify (400 €)
    expect(r.boxes).toMatchObject({
      "01": eur(10_000),
      "02": eur(2_400),
      "03": eur(7_600),
      "04": eur(1_520),
      "06": eur(0),
      "07": eur(1_520),
    });
    expect(r.result).toBe(eur(1_520));
    expect(r.hardToJustify).toBe(eur(400));
  });

  it("subtracts withholdings and earlier installments", () => {
    const b = books({
      sales: [
        sale("2026-02-10", eur(10_000), { withholding: eur(500) }),
        sale("2026-05-10", eur(10_000), { withholding: eur(500) }),
      ],
    });
    const [q1, q2] = incomeTaxReturns(b, 2026, { simplified: false });
    expect(q1!.result).toBe(eur(1_500));
    expect(q2!.boxes).toMatchObject({ "04": eur(4_000), "05": eur(1_500), "06": eur(1_000), "07": eur(1_500) });
  });

  it("is negative when withholdings exceed the installment, and later quarters catch up", () => {
    const b = books({
      sales: [
        sale("2026-02-10", eur(1_000), { withholding: eur(300) }),
        sale("2026-05-10", eur(5_000), { withholding: cents(0) }),
      ],
    });
    const [q1, q2] = incomeTaxReturns(b, 2026, { simplified: false });
    expect(q1!.result).toBe(eur(-100));
    // The negative installment doesn't count as paid
    expect(q2!.boxes).toMatchObject({ "04": eur(1_200), "05": eur(0), "06": eur(300), "19": eur(900) });
  });

  it("subtracts the installments as filed", () => {
    const b = books({
      sales: [
        sale("2026-02-10", eur(10_000), { withholding: eur(500) }),
        sale("2026-05-10", eur(10_000), { withholding: eur(500) }),
      ],
    });
    const filed = { "130": { "2026-T1": { "07": eur(1_200) } } };
    const [q1, q2] = incomeTaxReturns({ ...b, filed }, 2026, { simplified: false });
    expect(q1!.result).toBe(eur(1_500));
    expect(q2!.boxes).toMatchObject({ "05": eur(1_200), "07": eur(1_800) });
  });

  it("takes the earlier installments the taxpayer enters", () => {
    const b = books({ sales: [sale("2026-02-10", eur(5_000), { withholding: cents(0) })] });
    const r = model130(b, 2026, 2, { simplified: false }, [eur(1_000)], { paid: eur(800) });
    expect(r.boxes).toMatchObject({ "05": eur(800), "07": eur(200), "19": eur(200) });
  });

  it("limits the reduction to the positive installment", () => {
    const b = books({ sales: [sale("2026-02-10", eur(300), { withholding: cents(0) })] });
    const r = model130(b, 2026, 1, { simplified: false }, [], { reduction: eur(100) });
    expect(r.boxes).toMatchObject({ "12": eur(60), "13": eur(60), "19": 0 });
  });
});

describe("model100", () => {
  it("fills section D1 by expense type", () => {
    const b = books({
      sales: [
        sale("2026-02-10", eur(40_000), { withholding: eur(1_000) }),
        sale("2026-03-10", eur(1_000), { rental: true, withholding: eur(190) }),
      ],
      purchases: [
        purchase("2026-03-01", eur(80), { account: "621" }),
        purchase("2026-03-02", eur(300), { account: "6294" }),
      ],
      expenses: [expense("2026-01-31", eur(800))],
    });
    const r = model100(b, 2026, { simplified: true }, [500, -20, 300, 0].map(eur));
    expect(r.boxes).toMatchObject({
      "0171": eur(41_000),
      "0180": eur(41_000),
      "0186": eur(800),
      "0192": eur(80),
      "0202": eur(300),
    });
    expect(r.boxes).toMatchObject({
      "0218": eur(1_180),
      "0221": eur(39_820),
      "0222": eur(1_991),
      "0223": eur(3_171),
      "0224": eur(37_829),
    });
    expect(r.boxes).toMatchObject({ "0598": eur(190), "0599": eur(1_000), "0604": eur(800) });
    expect(r.netIncome).toBe(eur(37_829));
  });

  it("maps unknown accounts to other external services", () => {
    expect(expenseBox100("6292")).toBe("0202");
    expect(expenseBox100("628")).toBe("0194");
  });
});

describe("incomeTaxYear", () => {
  it("suggests the reduction from the previous year's net income without applying it", () => {
    const b = books({
      sales: [
        sale("2025-06-10", eur(8_000), { withholding: cents(0) }),
        sale("2026-02-10", eur(5_000), { withholding: cents(0) }),
      ],
    });
    const { quarters, previousNet, suggestedReduction } = incomeTaxYear(b, 2026, { simplified: false });
    expect(previousNet).toBe(eur(8_000));
    expect(suggestedReduction).toBe(eur(100));
    expect(quarters[0]!.boxes).toMatchObject({ "07": eur(1_000), "13": 0, "19": eur(1_000) });
  });

  it("suggests no reduction without books for the previous year", () => {
    const b = books({ sales: [sale("2026-02-10", eur(5_000), { withholding: cents(0) })] });
    expect(incomeTaxYear(b, 2026, { simplified: false }).suggestedReduction).toBe(0);
  });
});

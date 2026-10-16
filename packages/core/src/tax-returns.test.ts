import { describe, expect, it } from "vitest";
import {
  expenseBox100,
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

let seq = 0;

function sale(date: string, base: number, extra: Partial<TaxableSale> = {}): TaxableSale {
  const rate = 0.21;
  return {
    id: `s${++seq}`,
    date,
    operation: "national",
    rectifying: false,
    vatBreakdown: [{ rate, base, vat: Math.round(base * rate * 100) / 100 }],
    withholding: Math.round(base * 0.15 * 100) / 100,
    rental: false,
    ...extra,
  };
}

function purchase(date: string, base: number, extra: Partial<TaxablePurchase> = {}): TaxablePurchase {
  const operation = extra.operation ?? "national";
  const rate = operation === "national" || operation === "import" ? 0.21 : 0;
  return {
    id: `p${++seq}`,
    date,
    operation,
    creditNote: false,
    goods: false,
    vatBreakdown: [{ rate, base, vat: Math.round(base * rate * 100) / 100 }],
    vatShare: 1,
    expense: base,
    account: "629",
    ...extra,
  };
}

const expense = (date: string, amount: number, account = "6422"): TaxableExpense => ({
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
          sale("2026-07-10", 1_000),
          sale("2026-08-10", 200, { vatBreakdown: [{ rate: 0.1, base: 200, vat: 20 }] }),
        ],
        purchases: [purchase("2026-09-01", 100)],
      }),
      2026,
      3,
    );
    expect(r.boxes).toMatchObject({ "07": 1_000, "08": 21, "09": 210, "04": 200, "05": 10, "06": 20 });
    expect(r.boxes).toMatchObject({ "27": 230, "28": 100, "29": 21, "45": 21, "46": 209, "71": 209 });
    expect(r.result).toBe(209);
    expect(r.hasActivity).toBe(true);
  });

  it("ignores documents of other quarters", () => {
    const r = model303(books({ sales: [sale("2026-06-30", 1_000)] }), 2026, 3);
    expect(r.result).toBe(0);
    expect(r.hasActivity).toBe(false);
  });

  it("self-assesses intra-EU and reverse-charge purchases at the general rate", () => {
    const r = model303(
      books({
        purchases: [
          purchase("2026-07-12", 60, { operation: "intraEu" }),
          purchase("2026-07-02", 40, { operation: "reverseCharge" }),
        ],
      }),
      2026,
      3,
    );
    expect(r.boxes).toMatchObject({ "10": 60, "11": 12.6, "36": 60, "37": 12.6 });
    expect(r.boxes).toMatchObject({ "12": 40, "13": 8.4, "28": 40, "29": 8.4 });
    // Charged and deducted at once: no effect on the result
    expect(r.result).toBe(0);
  });

  it("deducts only the deductible share of VAT", () => {
    const r = model303(books({ purchases: [purchase("2026-07-12", 100, { vatShare: 0.5 })] }), 2026, 3);
    expect(r.boxes).toMatchObject({ "28": 50, "29": 10.5 });
  });

  it("reports rectifying invoices and credit notes as modifications", () => {
    const r = model303(
      books({
        sales: [sale("2026-07-10", -100, { rectifying: true })],
        purchases: [purchase("2026-07-11", -50, { creditNote: true })],
      }),
      2026,
      3,
    );
    expect(r.boxes).toMatchObject({ "14": -100, "15": -21, "40": -50, "41": -10.5 });
  });

  it("lists operations without VAT in the additional information boxes", () => {
    const r = model303(
      books({
        sales: [
          sale("2026-07-10", 3_000, { operation: "intraEu", vatBreakdown: [{ rate: 0, base: 3_000, vat: 0 }] }),
          sale("2026-07-11", 500, { operation: "export", vatBreakdown: [{ rate: 0, base: 500, vat: 0 }] }),
          sale("2026-07-12", 300, { operation: "notSubject", vatBreakdown: [{ rate: 0, base: 300, vat: 0 }] }),
          sale("2026-07-13", 200, { operation: "reverseCharge", vatBreakdown: [{ rate: 0, base: 200, vat: 0 }] }),
        ],
      }),
      2026,
      3,
    );
    expect(r.boxes).toMatchObject({ "59": 3_000, "60": 500, "120": 300, "122": 200, "27": 0 });
  });

  it("keeps rates the form doesn't have apart", () => {
    const r = model303(
      books({ sales: [sale("2026-07-10", 100, { vatBreakdown: [{ rate: 0.05, base: 100, vat: 5 }] })] }),
      2026,
      3,
    );
    expect(r.unmappedBase).toBe(100);
  });

  it("offsets what is pending up to the positive result", () => {
    const r = model303(books({ sales: [sale("2026-07-10", 1_000)] }), 2026, 3, 300);
    expect(r.boxes).toMatchObject({ "110": 300, "78": 210, "87": 90, "71": 0 });
  });
});

describe("vatReturns", () => {
  it("carries a negative result into the next quarters and years", () => {
    const b = books({
      sales: [sale("2026-04-10", 1_000), sale("2026-07-10", 1_000)],
      purchases: [purchase("2025-11-10", 500), purchase("2026-02-10", 1_000)],
    });
    const [q1, q2, q3] = vatReturns(b, 2026);
    expect(q1!.boxes["110"]).toBe(105);
    expect(q1!.result).toBe(-210);
    expect(q2!.boxes).toMatchObject({ "110": 315, "78": 210, "71": 0 });
    expect(q3!.boxes).toMatchObject({ "110": 105, "78": 105, "71": 105 });
  });
});

describe("model390", () => {
  it("summarizes the year by rate and section", () => {
    const b = books({
      sales: [
        sale("2026-02-10", 1_000),
        sale("2026-05-10", 4_000, { operation: "intraEu", vatBreakdown: [{ rate: 0, base: 4_000, vat: 0 }] }),
      ],
      purchases: [
        purchase("2026-03-01", 100),
        purchase("2026-03-02", 20, { operation: "intraEu" }),
        purchase("2026-03-03", 50, { operation: "intraEu", goods: true }),
        purchase("2026-03-04", 10, { operation: "reverseCharge" }),
      ],
    });
    const r = model390(b, 2026);
    expect(r.boxes).toMatchObject({ "05": 1_000, "06": 210, "551": 20, "552": 4.2, "25": 50, "26": 10.5 });
    expect(r.boxes).toMatchObject({ "27": 10, "28": 2.1, "33": 1_080, "34": 226.8 });
    expect(r.boxes).toMatchObject({ "605": 110, "606": 23.1, "637": 20, "638": 4.2, "629": 50, "630": 10.5 });
    expect(r.boxes).toMatchObject({ "64": 37.8, "65": 189, "86": 189 });
    expect(r.boxes).toMatchObject({ "99": 1_000, "103": 4_000, "108": 5_000 });
  });

  it("takes the quarterly results and what was pending when the year started", () => {
    const b = books({
      sales: [sale("2026-04-10", 1_000)],
      purchases: [purchase("2025-11-10", 500)],
    });
    const r = model390(b, 2026);
    expect(r.quarters).toEqual([0, 105, 0, 0]);
    expect(r.boxes).toMatchObject({ "85": 105, "95": 105, "86": 105 });
  });
});

describe("hardToJustify", () => {
  it("is 5 % of the net income, up to 2.000 €", () => {
    expect(hardToJustify(10_000, 2026)).toBe(500);
    expect(hardToJustify(100_000, 2026)).toBe(2_000);
    expect(hardToJustify(-500, 2026)).toBe(0);
  });

  it("was 7 % in 2023", () => {
    expect(hardToJustify(10_000, 2023)).toBe(700);
  });
});

describe("installmentReduction", () => {
  it("steps down with the previous year's net income", () => {
    expect(installmentReduction(null)).toBe(0);
    expect(installmentReduction(8_000)).toBe(100);
    expect(installmentReduction(9_500)).toBe(75);
    expect(installmentReduction(10_500)).toBe(50);
    expect(installmentReduction(12_000)).toBe(25);
    expect(installmentReduction(12_001)).toBe(0);
  });
});

describe("model130", () => {
  const simplified = { simplified: true };

  it("works out the installment from the income and expenses since January", () => {
    const b = books({
      sales: [sale("2026-02-10", 10_000, { withholding: 0 })],
      expenses: [expense("2026-03-01", 2_000)],
    });
    const r = model130(b, 2026, 1, simplified);
    // Net 8.000 €, minus 5 % hard-to-justify (400 €)
    expect(r.boxes).toMatchObject({ "01": 10_000, "02": 2_400, "03": 7_600, "04": 1_520, "06": 0, "07": 1_520 });
    expect(r.result).toBe(1_520);
    expect(r.hardToJustify).toBe(400);
  });

  it("subtracts withholdings and earlier installments", () => {
    const b = books({
      sales: [sale("2026-02-10", 10_000, { withholding: 500 }), sale("2026-05-10", 10_000, { withholding: 500 })],
    });
    const [q1, q2] = incomeTaxReturns(b, 2026, { simplified: false });
    expect(q1!.result).toBe(1_500);
    expect(q2!.boxes).toMatchObject({ "04": 4_000, "05": 1_500, "06": 1_000, "07": 1_500 });
  });

  it("is negative when withholdings exceed the installment, and later quarters catch up", () => {
    const b = books({
      sales: [sale("2026-02-10", 1_000, { withholding: 300 }), sale("2026-05-10", 5_000, { withholding: 0 })],
    });
    const [q1, q2] = incomeTaxReturns(b, 2026, { simplified: false });
    expect(q1!.result).toBe(-100);
    // The negative installment doesn't count as paid
    expect(q2!.boxes).toMatchObject({ "04": 1_200, "05": 0, "06": 300, "19": 900 });
  });

  it("limits the reduction to the positive installment", () => {
    const b = books({ sales: [sale("2026-02-10", 300, { withholding: 0 })] });
    const r = model130(b, 2026, 1, { simplified: false }, [], { reduction: 100 });
    expect(r.boxes).toMatchObject({ "12": 60, "13": 60, "19": 0 });
  });
});

describe("model100", () => {
  it("fills section D1 by expense type", () => {
    const b = books({
      sales: [sale("2026-02-10", 40_000, { withholding: 1_000 }), sale("2026-03-10", 1_000, { rental: true, withholding: 190 })],
      purchases: [purchase("2026-03-01", 80, { account: "621" }), purchase("2026-03-02", 300, { account: "6294" })],
      expenses: [expense("2026-01-31", 800)],
    });
    const r = model100(b, 2026, { simplified: true }, [500, -20, 300, 0]);
    expect(r.boxes).toMatchObject({ "0171": 41_000, "0180": 41_000, "0186": 800, "0192": 80, "0202": 300 });
    expect(r.boxes).toMatchObject({ "0218": 1_180, "0221": 39_820, "0222": 1_991, "0223": 3_171, "0224": 37_829 });
    expect(r.boxes).toMatchObject({ "0598": 190, "0599": 1_000, "0604": 800 });
    expect(r.netIncome).toBe(37_829);
  });

  it("maps unknown accounts to other external services", () => {
    expect(expenseBox100("6292")).toBe("0202");
    expect(expenseBox100("628")).toBe("0194");
  });
});

describe("incomeTaxYear", () => {
  it("applies the reduction from the previous year's net income", () => {
    const b = books({
      sales: [sale("2025-06-10", 8_000, { withholding: 0 }), sale("2026-02-10", 5_000, { withholding: 0 })],
    });
    const { quarters, previousNet, reduction } = incomeTaxYear(b, 2026, { simplified: false });
    expect(previousNet).toBe(8_000);
    expect(reduction).toBe(100);
    expect(quarters[0]!.boxes).toMatchObject({ "07": 1_000, "13": 100, "19": 900 });
  });

  it("has no reduction without books for the previous year", () => {
    const b = books({ sales: [sale("2026-02-10", 5_000, { withholding: 0 })] });
    expect(incomeTaxYear(b, 2026, { simplified: false }).reduction).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { monthlyResults, periodDates, pnlLine, profitAndLoss, relativeChange, yearToQuarter } from "./reports";
import type { TaxableExpense, TaxablePurchase, TaxableSale, TaxBooks } from "./tax-returns";

function sale(date: string, base: number, rental = false, account?: string): TaxableSale {
  return {
    id: date,
    date,
    operation: "national",
    rectifying: false,
    vatBreakdown: [{ rate: 0.21, base, vat: base * 0.21 }],
    withholding: 0,
    rental,
    account,
  };
}

function purchase(date: string, expense: number, account: string): TaxablePurchase {
  return {
    id: date,
    date,
    operation: "national",
    creditNote: false,
    goods: false,
    vatBreakdown: [{ rate: 0.21, base: expense, vat: expense * 0.21 }],
    vatShare: 1,
    expense,
    account,
  };
}

const expense = (date: string, amount: number, account: string): TaxableExpense => ({
  id: date,
  date,
  expense: amount,
  account,
});

const books: TaxBooks = {
  sales: [
    sale("2026-01-15", 3_000),
    sale("2026-02-10", 1_000.1),
    sale("2026-03-01", 500, true),
    sale("2026-04-02", 9_999),
  ],
  purchases: [
    purchase("2026-01-20", 120.5, "629"),
    purchase("2026-02-01", 60, "6231"),
    purchase("2026-03-05", 40, "662"),
  ],
  expenses: [expense("2026-01-31", 294, "642"), expense("2026-03-31", 12, "626"), expense("2026-02-28", 100, "681")],
};

describe("pnlLine", () => {
  it("groups accounts by their first two digits", () => {
    expect(pnlLine("629")).toBe("62");
    expect(pnlLine("6231")).toBe("62");
    expect(pnlLine("642")).toBe("64");
    expect(pnlLine("631")).toBe("63");
    expect(pnlLine("681")).toBe("68");
    expect(pnlLine("705")).toBe("70");
  });

  it("sends unknown accounts to services or other income", () => {
    expect(pnlLine("69")).toBe("62");
    expect(pnlLine("79")).toBe("75");
  });
});

describe("profitAndLoss", () => {
  const pnl = profitAndLoss(books, "2026-01-01", "2026-03-31");

  it("sums income by account, rentals apart", () => {
    expect(pnl.accounts["705"]).toBe(4_000.1);
    expect(pnl.accounts["752"]).toBe(500);
    expect(pnl.lines["70"]).toBe(4_000.1);
    expect(pnl.lines["75"]).toBe(500);
    expect(pnl.income).toBe(4_500.1);
  });

  it("sums deductible expenses into their lines", () => {
    expect(pnl.lines["62"]).toBe(192.5);
    expect(pnl.lines["64"]).toBe(294);
    expect(pnl.expenses).toBe(486.5);
    expect(pnl.lines["68"]).toBe(100);
    expect(pnl.lines["66"]).toBe(40);
  });

  it("works out every result", () => {
    expect(pnl.operating).toBe(4_013.6);
    expect(pnl.exploitation).toBe(3_913.6);
    expect(pnl.financial).toBe(-40);
    expect(pnl.result).toBe(3_873.6);
  });

  it("uses the invoice's own income account", () => {
    const own = profitAndLoss(
      {
        sales: [sale("2026-05-01", 200, false, "740"), sale("2026-05-02", 50, false, "769")],
        purchases: [],
        expenses: [],
      },
      "2026-05-01",
      "2026-05-31",
    );
    expect(own.lines["74"]).toBe(200);
    expect(own.lines["76"]).toBe(50);
    expect(own.income).toBe(200);
    expect(own.financial).toBe(50);
    expect(own.result).toBe(250);
  });

  it("leaves out documents outside the range", () => {
    expect(profitAndLoss(books, "2026-04-01", "2026-06-30").income).toBe(9_999);
    expect(profitAndLoss(books, "2025-01-01", "2025-12-31").result).toBe(0);
  });
});

describe("ranges", () => {
  it("runs from January to the end of the quarter", () => {
    expect(yearToQuarter(2026, 3)).toEqual({ from: "2026-01-01", to: "2026-09-30" });
  });

  it("covers a quarter or a year", () => {
    expect(periodDates({ year: 2024, quarter: 1 })).toEqual({ from: "2024-01-01", to: "2024-03-31" });
    expect(periodDates({ year: 2026, quarter: null })).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });
});

describe("monthlyResults", () => {
  it("returns twelve months on the report's basis", () => {
    const months = monthlyResults(books, 2026);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ month: 0, income: 3_000, expenses: 414.5, profit: 2_585.5 });
    expect(months[1]!.expenses).toBe(60);
    expect(months[11]!.income).toBe(0);
  });
});

describe("relativeChange", () => {
  it("compares against the absolute previous value", () => {
    expect(relativeChange(150, 100)).toBe(0.5);
    expect(relativeChange(-50, -100)).toBe(0.5);
    expect(relativeChange(10, 0)).toBeNull();
  });
});

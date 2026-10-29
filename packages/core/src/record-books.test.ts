import { describe, expect, it } from "vitest";
import { cents, eurosToCents } from "./money";
import {
  expenseConcept,
  recordBooks,
  recordBooksFileName,
  type BookCell,
  type ExpenseEntry,
  type IncomeEntry,
  type InvestmentEntry,
  type PurchaseEntry,
  type RecordBook,
  type RecordBookEntries,
} from "./record-books";
import { EXPENSE_BOXES_100, model100 } from "./tax-returns";

const eur = eurosToCents;
const activity = { type: "A05", code: "763" };
const nobody = { sales: [], purchases: [], expenses: [], investments: [] };

/** A cell by its column letter in the AEAT's design. */
function col(row: BookCell[], letter: string): BookCell {
  const index = [...letter].reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return row[index] ?? null;
}

const book = (books: RecordBook[], name: RecordBook["name"]) => books.find((b) => b.name === name)!;

function sale(overrides: Partial<IncomeEntry> = {}): IncomeEntry {
  return {
    id: "s1",
    date: "2026-02-10",
    operation: "national",
    rectifying: false,
    vatBreakdown: [{ rate: 0.21, base: eur(1000), vat: eur(210) }],
    withholding: eur(150),
    withholdingRate: 0.15,
    rental: false,
    number: "2026-0001",
    client: { taxId: "B12345674", name: "Estudio Norte S.L." },
    ...overrides,
  };
}

function purchase(overrides: Partial<PurchaseEntry> = {}): PurchaseEntry {
  return {
    id: "p1",
    date: "2026-03-05",
    issuedOn: "2026-03-01",
    operation: "national",
    creditNote: false,
    goods: false,
    vatBreakdown: [{ rate: 0.21, base: eur(100), vat: eur(21) }],
    vatShare: 1,
    expense: eur(100),
    account: "621",
    number: "A-77",
    supplier: { taxId: "A28015865", name: "Oficinas Centro S.A." },
    withholding: cents(0),
    withholdingRate: 0,
    ...overrides,
  };
}

function expense(overrides: Partial<ExpenseEntry> = {}): ExpenseEntry {
  return {
    id: "e1",
    date: "2026-01-31",
    expense: eur(294),
    amount: eur(294),
    account: "6422",
    number: "RETA-01",
    payee: { taxId: "Q2827003A", name: "Tesorería General de la Seguridad Social" },
    ...overrides,
  };
}

const laptop: InvestmentEntry = {
  number: "TP-25-0012",
  issuedOn: "2025-07-01",
  supplier: { taxId: "B30456784", name: "Tecnoplaza Informática S.L." },
  description: "Portátil",
  identifier: "",
  acquisition: eur(1200),
  asset: {
    value: eur(1200),
    startsOn: "2025-07-01",
    plan: { category: "itEquipment", condition: "new", method: "rate", value: 25 },
  },
};

const books = (entries: Partial<RecordBookEntries>, year = 2026) =>
  recordBooks({ ...nobody, ...entries }, year, activity);

describe("recordBooks: layout", () => {
  it("has the three sheets Renta WEB looks for, with the template's three header rows", () => {
    const result = books({});
    expect(result.map((b) => b.name)).toEqual(["INGRESOS", "GASTOS", "BIENES-INVERSIÓN"]);
    expect(result.map((b) => b.header.length)).toEqual([3, 3, 3]);
    expect(result.map((b) => b.header[0]!.length)).toEqual([36, 42, 40]);
    expect(col(book(result, "INGRESOS").header[1]!, "P")).toBe("Identificación");
  });

  it("never writes past the last column of its sheet", () => {
    const result = books({
      sales: [sale()],
      purchases: [purchase({ withholding: eur(15), withholdingRate: 0.15 })],
      expenses: [expense()],
      investments: [laptop],
    });
    for (const b of result) for (const row of b.rows) expect(row.length).toBeLessThanOrEqual(b.header[0]!.length);
  });

  it("names the file by year, NIF, D and the taxpayer's name", () => {
    expect(recordBooksFileName(2026, { taxId: "50123456-q", surnames: "Martín  Gómez", name: "Lucía" })).toBe(
      "202650123456QDMartín Gómez, Lucía.xlsx",
    );
  });
});

describe("recordBooks: income", () => {
  it("writes an invoice under its quarter, with the activity, the base as income and the withholding", () => {
    const [row] = book(books({ sales: [sale()] }), "INGRESOS").rows;
    expect(row!.slice(0, 9)).toEqual([2026, "1T", "A", "05", "763", "F1", "I01", 1000, { date: "2026-02-10" }]);
    expect(col(row!, "L")).toBe("2026-0001");
    expect(col(row!, "P")).toBe("B12345674");
    expect(col(row!, "Q")).toBe("Estudio Norte S.L.");
    expect([col(row!, "U"), col(row!, "V"), col(row!, "W"), col(row!, "X")]).toEqual([1210, 1000, 21, 210]);
    expect([col(row!, "AE"), col(row!, "AF")]).toEqual([15, 150]);
  });

  it("writes a line per VAT rate and the withholding only on the first", () => {
    const rows = book(
      books({
        sales: [
          sale({
            vatBreakdown: [
              { rate: 0.21, base: eur(800), vat: eur(168) },
              { rate: 0.1, base: eur(200), vat: eur(20) },
            ],
          }),
        ],
      }),
      "INGRESOS",
    ).rows;
    expect(rows.map((r) => [col(r, "H"), col(r, "U"), col(r, "W"), col(r, "AF")])).toEqual([
      [800, 968, 21, 150],
      [200, 220, 10, null],
    ]);
  });

  it("writes a corrective invoice as R1 with negative amounts", () => {
    const [row] = book(
      books({
        sales: [
          sale({
            rectifying: true,
            number: "R-2026-0001",
            vatBreakdown: [{ rate: 0.21, base: eur(-200), vat: eur(-42) }],
            withholding: eur(-30),
          }),
        ],
      }),
      "INGRESOS",
    ).rows;
    expect([col(row!, "F"), col(row!, "H"), col(row!, "U"), col(row!, "X"), col(row!, "AF")]).toEqual([
      "R1",
      -200,
      -242,
      -42,
      -30,
    ]);
  });

  it("identifies EU clients by their VAT number and the rest by country", () => {
    const rows = book(
      books({
        sales: [
          sale({ client: { taxId: "40303265045", name: "Client FR", country: "Francia" } }),
          sale({ client: { taxId: "86-1696045", name: "US Client", country: "Estados Unidos" } }),
          sale({ client: { taxId: "es b12345674", name: "Estudio Norte S.L." } }),
        ],
      }),
      "INGRESOS",
    ).rows;
    expect(rows.map((r) => [col(r, "N"), col(r, "O"), col(r, "P")])).toEqual([
      ["02", "FR", "FR40303265045"],
      ["04", "US", "86-1696045"],
      [null, null, "B12345674"],
    ]);
  });

  it("writes sales to unidentified customers as simplified invoices to final consumers", () => {
    const rows = book(
      books({ sales: [sale({ client: null }), sale({ client: { taxId: "", name: "Varios" }, rectifying: true })] }),
      "INGRESOS",
    ).rows;
    expect(rows.map((r) => [col(r, "F"), col(r, "P"), col(r, "Q")])).toEqual([
      ["F2", null, "VENTAS A CONSUMIDOR FINAL"],
      ["R5", null, "VENTAS A CONSUMIDOR FINAL"],
    ]);
  });

  it("writes the operation date only when it differs from the issue date", () => {
    const rows = book(
      books({ sales: [sale({ operationOn: "2026-01-30" }), sale({ operationOn: "2026-02-10" })] }),
      "INGRESOS",
    ).rows;
    expect(rows.map((r) => col(r, "J"))).toEqual([{ date: "2026-01-30" }, null]);
  });

  it("keeps only the year's invoices, in date order", () => {
    const rows = book(
      books({
        sales: [
          sale({ number: "B", date: "2026-05-02" }),
          sale({ number: "X", date: "2025-12-31" }),
          sale({ number: "A", date: "2026-05-02" }),
          sale({ number: "C", date: "2026-11-20" }),
        ],
      }),
      "INGRESOS",
    ).rows;
    expect(rows.map((r) => [col(r, "B"), col(r, "L")])).toEqual([
      ["2T", "A"],
      ["2T", "B"],
      ["4T", "C"],
    ]);
  });
});

describe("recordBooks: expenses", () => {
  it("gives each account the concept of its box in form 100", () => {
    expect(
      ["600", "621", "622", "628", "6291", "623", "625", "6422", "642", "662", "660", "631", "681", "680", "629"].map(
        expenseConcept,
      ),
    ).toEqual([
      "G01",
      "G12",
      "G13",
      "GY4",
      "GY4",
      "G19",
      "G20",
      "G45",
      "G05",
      "G23",
      "G24",
      "G26",
      "GY8",
      "G38",
      "G22",
    ]);
  });

  it("writes a received invoice with its deductible part and a receipt number", () => {
    const [row] = book(books({ purchases: [purchase()] }), "GASTOS").rows;
    expect(row!.slice(0, 11)).toEqual([
      2026,
      "1T",
      "A",
      "05",
      "763",
      "F1",
      "G12",
      100,
      { date: "2026-03-01" },
      null,
      "A-77",
    ]);
    expect([col(row!, "N"), col(row!, "R"), col(row!, "S")]).toEqual(["1", "A28015865", "Oficinas Centro S.A."]);
    expect([col(row!, "Z"), col(row!, "AA"), col(row!, "AB"), col(row!, "AC")]).toEqual([121, 100, 21, 21]);
  });

  it("spreads a partly deductible expense over the invoice's lines without losing a cent", () => {
    const rows = book(
      books({
        purchases: [
          purchase({
            vatBreakdown: [
              { rate: 0.21, base: eur(33.33), vat: eur(7) },
              { rate: 0.1, base: eur(66.67), vat: eur(6.67) },
            ],
            expense: eur(50.01),
          }),
        ],
      }),
      "GASTOS",
    ).rows;
    const parts = rows.map((r) => col(r, "H") as number);
    expect(parts).toEqual([16.67, 33.34]);
    expect(parts.every((p, i) => p <= (col(rows[i]!, "AA") as number))).toBe(true);
  });

  it("writes a supplier's credit note as R1 and a purchase that isn't an expense without concept", () => {
    const rows = book(
      books({
        purchases: [
          purchase({
            creditNote: true,
            vatBreakdown: [{ rate: 0.21, base: eur(-40), vat: eur(-8.4) }],
            expense: eur(-40),
          }),
          purchase({ id: "p2", number: "TP-1", account: "681", expense: cents(0) }),
        ],
      }),
      "GASTOS",
    ).rows;
    expect(rows.map((r) => [col(r, "F"), col(r, "G"), col(r, "H"), col(r, "Z")])).toEqual([
      ["R1", "G12", -40, -48.4],
      ["F1", null, 0, 121],
    ]);
  });

  it("writes expenses without an invoice as SF entries, numbered apart from the invoices", () => {
    const rows = book(
      books({
        purchases: [purchase({ date: "2026-01-10" }), purchase({ id: "p2", number: "A-78", date: "2026-02-10" })],
        expenses: [
          expense(),
          expense({
            id: "e2",
            date: "2026-02-28",
            account: "626",
            expense: eur(4),
            amount: eur(4),
            payee: null,
            number: "",
          }),
        ],
      }),
      "GASTOS",
    ).rows;
    expect(rows.map((r) => [col(r, "F"), col(r, "G"), col(r, "N"), col(r, "R")])).toEqual([
      ["F1", "G12", "1", "A28015865"],
      ["SF", "G45", "1", "Q2827003A"],
      ["F1", "G12", "2", "A28015865"],
      ["SF", "G22", "2", null],
    ]);
    const reta = rows[1]!;
    expect([col(reta, "H"), col(reta, "Z"), col(reta, "AA"), col(reta, "AB"), col(reta, "AC")]).toEqual([
      294, 294, 294, 0, 0,
    ]);
  });

  it("writes amortizations as entries without invoice or payee, under the tangible or intangible concept", () => {
    const rows = book(
      books({
        expenses: [
          expense({
            id: "a1",
            date: "2026-03-31",
            account: "681",
            expense: eur(75),
            amount: eur(75),
            number: "",
            payee: null,
          }),
          expense({
            id: "a2",
            date: "2026-03-31",
            account: "680",
            expense: eur(20),
            amount: eur(20),
            number: "",
            payee: null,
          }),
        ],
      }),
      "GASTOS",
    ).rows;
    expect(rows.map((r) => [col(r, "F"), col(r, "G"), col(r, "H"), col(r, "K"), col(r, "R")])).toEqual([
      ["SF", "GY8", 75, null, null],
      ["SF", "G38", 20, null, null],
    ]);
  });

  it("adds up, concept by concept, to the expense boxes of form 100", () => {
    const entries: RecordBookEntries = {
      ...nobody,
      sales: [sale()],
      purchases: [
        purchase(),
        purchase({ id: "p2", account: "628", expense: eur(45.5) }),
        purchase({ id: "p3", account: "662", expense: eur(12) }),
        purchase({ id: "p4", account: "600", expense: eur(300), vatShare: 0.5 }),
      ],
      expenses: [expense(), expense({ id: "a1", account: "681", expense: eur(75), amount: eur(75), payee: null })],
    };
    const rows = book(recordBooks(entries, 2026, activity), "GASTOS").rows;
    const byConcept = new Map<string, number>();
    for (const r of rows) {
      const concept = col(r, "G") as string;
      byConcept.set(concept, (byConcept.get(concept) ?? 0) + eur(col(r, "H") as number));
    }
    const boxes = model100(entries, 2026, { simplified: true }).boxes;
    const fromBooks: Record<string, number> = {};
    for (const [concept, amount] of byConcept) {
      const box = { G01: "0181", G12: "0192", GY4: "0194", G23: "0203", G45: "0186", GY8: "0208" }[concept]!;
      fromBooks[box] = (fromBooks[box] ?? 0) + amount;
    }
    const nonZero = Object.fromEntries(EXPENSE_BOXES_100.filter((box) => boxes[box]).map((box) => [box, boxes[box]]));
    expect(fromBooks).toEqual(nonZero);
  });
});

describe("recordBooks: investment goods", () => {
  it("lists a good bought in the year with its amortization", () => {
    const [row] = book(books({ investments: [laptop] }, 2025), "BIENES-INVERSIÓN").rows;
    expect(row).toEqual([
      2025,
      "0A",
      "A",
      "05",
      "763",
      "23",
      null,
      "Portátil",
      { date: "2025-07-01" },
      1200,
      1200,
      "01",
      25,
      0,
      151.23,
      151.23,
      1048.77,
      { date: "2025-07-01" },
      "TP-25-0012",
      null,
      null,
      null,
      null,
      null,
      "B30456784",
      "Tecnoplaza Informática S.L.",
    ]);
  });

  it("carries it while it is amortized, from what was accumulated, and drops it after", () => {
    const [row] = book(books({ investments: [laptop] }, 2026), "BIENES-INVERSIÓN").rows;
    expect([col(row!, "N"), col(row!, "O"), col(row!, "P"), col(row!, "Q")]).toEqual([151.23, 300, 451.23, 748.77]);
    expect(book(books({ investments: [laptop] }, 2030), "BIENES-INVERSIÓN").rows).toEqual([]);
    expect(book(books({ investments: [laptop] }, 2024), "BIENES-INVERSIÓN").rows).toEqual([]);
  });

  it("gives the kind of good and the method its plan says", () => {
    const camera: InvestmentEntry = {
      ...laptop,
      identifier: "1234ABC",
      asset: { ...laptop.asset, plan: { category: "transport", condition: "used", method: "rate", value: 32 } },
    };
    const [row] = book(books({ investments: [camera] }, 2025), "BIENES-INVERSIÓN").rows;
    expect([col(row!, "F"), col(row!, "G"), col(row!, "L"), col(row!, "M")]).toEqual(["22", "1234ABC", "08", 32]);
  });
});

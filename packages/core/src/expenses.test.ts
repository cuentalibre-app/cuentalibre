import { describe, expect, it } from "vitest";
import { deductibleExpense, isDuplicateExpense, pendingSocialSecurity } from "./expenses";
import { eurosToCents as eur } from "./money";

describe("deductibleExpense", () => {
  it("is the whole amount at 100 %", () => {
    expect(deductibleExpense(eur(294), 100)).toBe(eur(294));
  });

  it("applies the imputation and rounds to cents", () => {
    expect(deductibleExpense(eur(33.33), 30)).toBe(eur(10));
    expect(deductibleExpense(eur(12.35), 50)).toBe(eur(6.18));
  });

  it("is zero when nothing is imputed", () => {
    expect(deductibleExpense(eur(80), 0)).toBe(0);
  });
});

describe("isDuplicateExpense", () => {
  const fee = {
    id: "e1",
    date: "2026-09-30",
    number: "",
    concept: "Cuota de autónomos septiembre",
    amount: eur(294),
    payee: "tgss",
  };
  const receipt = { id: "e2", date: "2026-03-10", number: "R-15", concept: "Parking", amount: eur(12), payee: "s6" };
  const existing = [fee, receipt];

  it("flags a numbered receipt from the same payee in the same year", () => {
    expect(isDuplicateExpense({ ...receipt, id: undefined, date: "2026-11-02", amount: eur(30) }, existing)).toBe(true);
    expect(isDuplicateExpense({ ...receipt, id: undefined, number: " r-15 " }, existing)).toBe(true);
  });

  it("allows the same number in another year or from another payee", () => {
    expect(isDuplicateExpense({ ...receipt, id: undefined, date: "2027-03-10" }, existing)).toBe(false);
    expect(isDuplicateExpense({ ...receipt, id: undefined, payee: "s7" }, existing)).toBe(false);
  });

  it("without a number, matches date, concept, amount and payee", () => {
    expect(isDuplicateExpense({ ...fee, id: undefined, concept: "cuota de  autónomos septiembre" }, existing)).toBe(
      true,
    );
    expect(isDuplicateExpense({ ...fee, id: undefined, amount: eur(294.01) }, existing)).toBe(false);
    expect(isDuplicateExpense({ ...fee, id: undefined, date: "2026-10-31" }, existing)).toBe(false);
  });

  it("ignores the expense being edited", () => {
    expect(isDuplicateExpense(fee, existing)).toBe(false);
  });
});

describe("pendingSocialSecurity", () => {
  const q4 = [9, 10, 11];
  const today = new Date(2026, 10, 9);

  it("counts the elapsed months of the period, the current one included", () => {
    expect(pendingSocialSecurity(q4, 2026, today, [], eur(294))).toBe(eur(588));
  });

  it("skips months with a fee already booked", () => {
    expect(pendingSocialSecurity(q4, 2026, today, ["2026-10-30"], eur(294))).toBe(eur(294));
    expect(pendingSocialSecurity(q4, 2026, today, ["2026-10-30", "2026-11-28"], eur(294))).toBe(0);
  });

  it("counts every month of a past year and none of a future one", () => {
    expect(pendingSocialSecurity(q4, 2025, today, ["2025-12-31"], eur(294))).toBe(eur(588));
    expect(pendingSocialSecurity(q4, 2027, today, [], eur(294))).toBe(0);
  });

  it("is nothing without a fee", () => {
    expect(pendingSocialSecurity(q4, 2026, today, [], eur(0))).toBe(0);
  });
});

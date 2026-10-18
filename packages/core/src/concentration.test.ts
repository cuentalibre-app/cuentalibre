import { describe, expect, it } from "vitest";
import { isEconomicallyDependent, rankCounterparties } from "./concentration";
import { eurosToCents as eur } from "./money";

describe("rankCounterparties", () => {
  it("sums per name and ranks largest first with shares", () => {
    const ranking = rankCounterparties([
      { name: "A", amount: eur(100) },
      { name: "B", amount: eur(300) },
      { name: "A", amount: eur(100) },
    ]);
    expect(ranking.total).toBe(eur(500));
    expect(ranking.count).toBe(2);
    expect(ranking.items.map((i) => [i.name, i.amount, i.share])).toEqual([
      ["B", eur(300), 0.6],
      ["A", eur(200), 0.4],
    ]);
  });

  it("folds everyone past the limit into Otros", () => {
    const entries = ["A", "B", "C", "D"].map((name, i) => ({ name, amount: eur(40 - i * 10) }));
    const ranking = rankCounterparties(entries, 2);
    expect(ranking.items.map((i) => i.name)).toEqual(["A", "B", "Otros"]);
    expect(ranking.items[2]).toMatchObject({ amount: eur(30), isOther: true });
    expect(ranking.count).toBe(4);
  });

  it("does not fold a single leftover counterparty", () => {
    const entries = ["A", "B", "C"].map((name) => ({ name, amount: eur(10) }));
    expect(rankCounterparties(entries, 2).items.map((i) => i.name)).toEqual(["A", "B", "C"]);
  });

  it("leaves out counterparties with no positive net amount", () => {
    const ranking = rankCounterparties([
      { name: "A", amount: eur(100) },
      { name: "B", amount: eur(50) },
      { name: "B", amount: eur(-50) },
    ]);
    expect(ranking.items.map((i) => i.name)).toEqual(["A"]);
    expect(ranking.count).toBe(1);
  });

  it("is empty when there is nothing", () => {
    expect(rankCounterparties([])).toEqual({ items: [], total: 0, count: 0 });
  });
});

describe("isEconomicallyDependent", () => {
  it("is true from 75% of income from one client", () => {
    const ranking = rankCounterparties([
      { name: "A", amount: eur(75) },
      { name: "B", amount: eur(25) },
    ]);
    expect(isEconomicallyDependent(ranking)).toBe(true);
  });

  it("is false below 75%", () => {
    const ranking = rankCounterparties([
      { name: "A", amount: eur(74) },
      { name: "B", amount: eur(26) },
    ]);
    expect(isEconomicallyDependent(ranking)).toBe(false);
  });

  it("is false with no clients", () => {
    expect(isEconomicallyDependent(rankCounterparties([]))).toBe(false);
  });
});

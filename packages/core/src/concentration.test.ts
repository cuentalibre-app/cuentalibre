import { describe, expect, it } from "vitest";
import { isEconomicallyDependent, rankCounterparties } from "./concentration";

describe("rankCounterparties", () => {
  it("sums per name and ranks largest first with shares", () => {
    const ranking = rankCounterparties([
      { name: "A", amount: 100 },
      { name: "B", amount: 300 },
      { name: "A", amount: 100 },
    ]);
    expect(ranking.total).toBe(500);
    expect(ranking.count).toBe(2);
    expect(ranking.items.map((i) => [i.name, i.amount, i.share])).toEqual([
      ["B", 300, 0.6],
      ["A", 200, 0.4],
    ]);
  });

  it("folds everyone past the limit into Otros", () => {
    const entries = ["A", "B", "C", "D"].map((name, i) => ({ name, amount: 40 - i * 10 }));
    const ranking = rankCounterparties(entries, 2);
    expect(ranking.items.map((i) => i.name)).toEqual(["A", "B", "Otros"]);
    expect(ranking.items[2]).toMatchObject({ amount: 30, isOther: true });
    expect(ranking.count).toBe(4);
  });

  it("does not fold a single leftover counterparty", () => {
    const entries = ["A", "B", "C"].map((name) => ({ name, amount: 10 }));
    expect(rankCounterparties(entries, 2).items.map((i) => i.name)).toEqual(["A", "B", "C"]);
  });

  it("leaves out counterparties with no positive net amount", () => {
    const ranking = rankCounterparties([
      { name: "A", amount: 100 },
      { name: "B", amount: 50 },
      { name: "B", amount: -50 },
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
      { name: "A", amount: 75 },
      { name: "B", amount: 25 },
    ]);
    expect(isEconomicallyDependent(ranking)).toBe(true);
  });

  it("is false below 75%", () => {
    const ranking = rankCounterparties([
      { name: "A", amount: 74 },
      { name: "B", amount: 26 },
    ]);
    expect(isEconomicallyDependent(ranking)).toBe(false);
  });

  it("is false with no clients", () => {
    expect(isEconomicallyDependent(rankCounterparties([]))).toBe(false);
  });
});

/**
 * A self-employed worker who earns at least 75% of their income from a single
 * client can qualify as economically dependent (TRADE, Ley 20/2007, art. 11).
 */
export const ECONOMIC_DEPENDENCY_THRESHOLD = 0.75;

export interface CounterpartyAmount {
  name: string;
  amount: number;
}

export interface RankedCounterparty extends CounterpartyAmount {
  /** Fraction of the total: 0.5 is 50%. */
  share: number;
  /** True for the bucket that groups everyone past the limit. */
  isOther: boolean;
}

export interface CounterpartyRanking {
  items: RankedCounterparty[];
  total: number;
  /** Counterparties with a positive amount, including those folded into "Otros". */
  count: number;
}

/**
 * Sums amounts per counterparty and ranks them, largest first. Past `limit`,
 * the rest fold into a single "Otros" entry so the list stays short.
 * Counterparties whose net amount is zero or negative are left out.
 */
export function rankCounterparties(entries: CounterpartyAmount[], limit = 5): CounterpartyRanking {
  const byName = new Map<string, number>();
  for (const { name, amount } of entries) byName.set(name, (byName.get(name) ?? 0) + amount);

  const ranked = [...byName]
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([name, amount]) => ({ name, amount }));
  const total = ranked.reduce((acc, r) => acc + r.amount, 0);
  const share = (amount: number) => (total ? amount / total : 0);

  // Folding a single counterparty into "Otros" would only hide its name
  const shown = ranked.length > limit + 1 ? ranked.slice(0, limit) : ranked;
  const items: RankedCounterparty[] = shown.map((r) => ({ ...r, share: share(r.amount), isOther: false }));
  if (shown.length < ranked.length) {
    const rest = ranked.slice(shown.length).reduce((acc, r) => acc + r.amount, 0);
    items.push({ name: "Otros", amount: rest, share: share(rest), isOther: true });
  }

  return { items, total, count: ranked.length };
}

/** Whether the top client's share of income reaches the TRADE threshold. */
export function isEconomicallyDependent(ranking: CounterpartyRanking): boolean {
  const top = ranking.items[0];
  return top !== undefined && !top.isOther && top.share >= ECONOMIC_DEPENDENCY_THRESHOLD;
}

import { useMemo, useSyncExternalStore } from "react";
import { lockedQuarter, periodKey, toIsoDate, type Period } from "@fiscalia/core";
import type { ClosedQuarter } from "@fiscalia/contracts";
import { initialClosedQuarters } from "@/mocks/closing";

/**
 * Closed quarters, in memory until reload like the other stores. Closing is
 * enforced by the forms and lists; the backend will enforce it too.
 */
let closed = initialClosedQuarters;
const listeners = new Set<() => void>();

function commit(next: ClosedQuarter[]) {
  closed = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useClosedQuarters(): ClosedQuarter[] {
  return useSyncExternalStore(subscribe, () => closed);
}

export const closingStore = {
  close: (period: Period, today: Date) =>
    commit([
      { period: periodKey(period), closedOn: toIsoDate(today) },
      ...closed.filter((c) => c.period !== periodKey(period)),
    ]),
  reopen: (period: Period) => commit(closed.filter((c) => c.period !== periodKey(period))),
};

/** The closed quarter a document date falls in, or null when it can be changed. */
export function useLockedQuarter(): (isoDate: string) => Period | null {
  const quarters = useClosedQuarters();
  return useMemo(() => {
    const keys = new Set(quarters.map((c) => c.period));
    return (isoDate: string) => lockedQuarter(isoDate, keys);
  }, [quarters]);
}

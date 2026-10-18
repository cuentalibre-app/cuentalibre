import { useMemo } from "react";
import { lockedQuarter, periodKey, toIsoDate, type Period } from "@fiscalia/core";
import type { ClosedQuarter } from "@fiscalia/contracts";
import { createStore } from "@/data/store";
import { initialClosedQuarters } from "@/mocks/closing";

/**
 * Closed quarters. Closing is enforced by the forms and lists; the backend will
 * enforce it too, which is why closing and reopening are commands of their own.
 */
const closed = createStore<ClosedQuarter[]>(initialClosedQuarters);

export function useClosedQuarters(): ClosedQuarter[] {
  return closed.use();
}

export const closingStore = {
  close(period: Period, today: Date) {
    const quarter = { period: periodKey(period), closedOn: toIsoDate(today) };
    return closed.write(
      [quarter, ...closed.get().filter((c) => c.period !== quarter.period)],
      [{ type: "closeQuarter", ...quarter }],
    );
  },
  reopen(period: Period) {
    const key = periodKey(period);
    return closed.write(
      closed.get().filter((c) => c.period !== key),
      [{ type: "reopenQuarter", period: key }],
    );
  },
};

/** The closed quarter a document date falls in, or null when it can be changed. */
export function useLockedQuarter(): (isoDate: string) => Period | null {
  const quarters = useClosedQuarters();
  return useMemo(() => {
    const keys = new Set(quarters.map((c) => c.period));
    return (isoDate: string) => lockedQuarter(isoDate, keys);
  }, [quarters]);
}

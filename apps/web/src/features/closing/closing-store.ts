import { useMemo } from "react";
import { filedReturnsOf, lockedQuarter, newId, periodKey, toIsoDate, type Period } from "@fiscalia/core";
import type { ClosedQuarter, FiledReturn } from "@fiscalia/contracts";
import { createStore } from "@/data/store";
import { listTarget, syncTarget } from "@/data/sync";
import { initialClosedQuarters, initialFiledReturns } from "@/mocks/closing";

/**
 * Closed quarters and the returns filed when closing them. Closing is
 * enforced by the forms and lists, and by the API, which is why closing and
 * reopening are commands of their own.
 */
interface ClosingState {
  /** Newest first. */
  closed: ClosedQuarter[];
  /** Every version, oldest first: the latest of each form and quarter counts. */
  filed: FiledReturn[];
}

const closing = createStore<ClosingState>({ closed: initialClosedQuarters, filed: initialFiledReturns });

const newestFirst = (quarters: ClosedQuarter[]) => [...quarters].sort((a, b) => b.period.localeCompare(a.period));
const take = (changes: Partial<ClosingState>) => closing.set({ ...closing.get(), ...changes });

syncTarget<ClosedQuarter>("closedQuarters", {
  receive: (quarter) =>
    take({ closed: newestFirst([quarter, ...closing.get().closed.filter((c) => c.period !== quarter.period)]) }),
  forget: (period) => take({ closed: closing.get().closed.filter((c) => c.period !== period) }),
  replace: (quarters) => take({ closed: newestFirst(quarters) }),
});
syncTarget(
  "filedReturns",
  listTarget(
    () => closing.get().filed,
    (filed) => take({ filed }),
  ),
);

export function useClosedQuarters(): ClosedQuarter[] {
  return closing.use().closed;
}

export function useFiledReturns(): FiledReturn[] {
  return closing.use().filed;
}

/** A return as computed when closing its quarter. */
export type ReturnToFile = Pick<FiledReturn, "form" | "boxes" | "result">;

export const closingStore = {
  /** Closes the quarter and keeps its returns as filed. */
  close(period: Period, today: Date, returns: ReturnToFile[]) {
    const quarter = { period: periodKey(period), closedOn: toIsoDate(today) };
    const filed = returns.map((r) => ({ ...r, id: newId(), period: quarter.period, filedOn: quarter.closedOn }));
    const { closed, filed: before } = closing.get();
    return closing.write(
      { closed: [quarter, ...closed.filter((c) => c.period !== quarter.period)], filed: [...before, ...filed] },
      [{ type: "closeQuarter", ...quarter, returns: filed }],
    );
  },
  reopen(period: Period) {
    const key = periodKey(period);
    return closing.write({ ...closing.get(), closed: closing.get().closed.filter((c) => c.period !== key) }, [
      { type: "reopenQuarter", period: key },
    ]);
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

/** The latest filed version of a quarter's return, if it was filed. */
export function useFiledReturn(form: FiledReturn["form"], period: Period): FiledReturn | undefined {
  const filed = useFiledReturns();
  const key = periodKey(period);
  return useMemo(() => filed.findLast((r) => r.form === form && r.period === key), [filed, form, key]);
}

/** Filed returns as the tax maths take them. */
export function useFiledBoxes() {
  const filed = useFiledReturns();
  return useMemo(() => filedReturnsOf(filed), [filed]);
}

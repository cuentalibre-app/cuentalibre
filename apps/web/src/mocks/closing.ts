import type { ClosedQuarter, FiledReturn } from "@cuentalibre/contracts";

/** Quarters already filed and closed in the sample data. */
export const initialClosedQuarters: ClosedQuarter[] = [
  { period: "2026-T2", closedOn: "2026-07-17" },
  { period: "2026-T1", closedOn: "2026-04-16" },
  { period: "2025-T4", closedOn: "2026-01-28" },
  { period: "2025-T3", closedOn: "2025-10-17" },
  { period: "2025-T2", closedOn: "2025-07-18" },
  { period: "2025-T1", closedOn: "2025-04-17" },
];

/** The sample quarters were closed before returns were kept: their figures come from the books. */
export const initialFiledReturns: FiledReturn[] = [];

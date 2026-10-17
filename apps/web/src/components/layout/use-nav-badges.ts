import { daysUntil, upcomingDeadlines } from "@fiscalia/core";
import { useMemo } from "react";
import { reconciliationStatus } from "@fiscalia/core";
import { useSalesDocuments } from "@/features/sales/sales-store";
import { matchedAmount } from "@/features/treasury/treasury-model";
import { usePayments, useTreasury } from "@/features/treasury/treasury-store";
import type { BadgeKey } from "./nav";

/** Counters shown next to navigation items. */
export function useNavBadges(): Record<BadgeKey, number> {
  const today = new Date();
  const drafts = useSalesDocuments().filter((d) => d.kind === "draft").length;
  const filingsSoon = upcomingDeadlines(today, 10).filter(
    (d) => d.kind !== "social-security" && daysUntil(today, d.date) <= 30,
  ).length;
  const payments = usePayments();
  const { movements } = useTreasury();
  const unreconciled = useMemo(() => {
    const byKey = new Map(payments.map((p) => [p.key, p]));
    return movements.filter((m) => reconciliationStatus(m.amount, matchedAmount(m, byKey)) !== "full").length;
  }, [payments, movements]);
  return { drafts, filingsSoon, unreconciled };
}

import { daysUntil, upcomingDeadlines } from "@fiscalia/core";
import { draftInvoicesCount } from "@/mocks/data";
import type { BadgeKey } from "./nav";

/** Counters shown next to navigation items. */
export function useNavBadges(): Record<BadgeKey, number> {
  const today = new Date();
  const filingsSoon = upcomingDeadlines(today, 10).filter(
    (d) => d.kind !== "social-security" && daysUntil(today, d.date) <= 30,
  ).length;
  return { drafts: draftInvoicesCount, filingsSoon };
}

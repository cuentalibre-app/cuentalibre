import { daysUntil, upcomingDeadlines } from "@cuentalibre/core";
import { useSalesDocuments } from "@/features/sales/sales-store";
import { useSettings } from "@/features/settings/settings-store";
import type { BadgeKey } from "./nav";

/** Counters shown next to navigation items. */
export function useNavBadges(): Record<BadgeKey, number> {
  const today = new Date();
  const drafts = useSalesDocuments().filter((d) => d.kind === "draft").length;
  const incomeTax = useSettings().profile.kind === "selfEmployed";
  const filingsSoon = upcomingDeadlines(today, 10, { incomeTax }).filter(
    (d) => d.kind !== "social-security" && daysUntil(today, d.date) <= 30,
  ).length;
  return { drafts, filingsSoon };
}

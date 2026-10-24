import { cents } from "@cuentalibre/core";
import { describe, expect, it } from "vitest";
import {
  isLive,
  localDate,
  planHeadline,
  planState,
  perMonth,
  periodOf,
  savingOf,
  trialDaysLeft,
  withVat,
} from "./billing-model";

describe("billing model", () => {
  it("matches the landing's per-month prices and savings", () => {
    expect(["monthly", "quarterly", "yearly"].map((p) => perMonth(periodOf(p as "monthly")))).toEqual([499, 466, 408]);
    expect(["monthly", "quarterly", "yearly"].map((p) => savingOf(periodOf(p as "monthly")))).toEqual([0, 7, 18]);
  });

  it("adds 21 % VAT as Stripe charges it", () => {
    expect(withVat(cents(499))).toBe(604);
    expect(withVat(cents(1399))).toBe(1693);
    expect(withVat(cents(4900))).toBe(5929);
  });

  it("counts the trial's days left, today included", () => {
    const plan = { status: "trial" as const, canWrite: true, trialEndsAt: "2026-11-23T10:00:00.000Z" };
    expect(trialDaysLeft(plan, new Date("2026-10-24T10:00:00Z"))).toBe(30);
    expect(trialDaysLeft(plan, new Date("2026-11-23T09:00:00Z"))).toBe(1);
    expect(trialDaysLeft(plan, new Date("2026-11-24T00:00:00Z"))).toBe(0);
  });

  it("takes the date of a timestamp in the local time zone", () => {
    expect(localDate("2026-10-24T10:00:00.000Z")).toMatch(/^2026-10-2[45]$/);
  });

  it("tells a subscription that still charges from one that ended", () => {
    const subscription = { period: "yearly" as const, currentPeriodEnd: null, cancelAtPeriodEnd: false };
    expect(isLive(null)).toBe(false);
    expect(isLive({ ...subscription, status: "active" })).toBe(true);
    expect(isLive({ ...subscription, status: "past_due" })).toBe(true);
    expect(isLive({ ...subscription, status: "canceled" })).toBe(false);
  });

  it("names where the company stands", () => {
    const now = new Date("2026-10-24T10:00:00Z");
    const plan = (status: "trial" | "active" | "pastDue" | "readOnly") => ({
      status,
      canWrite: status !== "readOnly",
      trialEndsAt: "2026-10-30T10:00:00.000Z",
    });
    const sub = (status: string, cancelAtPeriodEnd = false) => ({
      period: "yearly" as const,
      status,
      currentPeriodEnd: "2027-10-24T10:00:00.000Z",
      cancelAtPeriodEnd,
    });
    expect(planHeadline({ plan: plan("trial"), subscription: null }, now)).toEqual({
      title: "Prueba gratuita",
      badge: "Quedan 6 días",
      tone: "primary",
    });
    expect(planState({ plan: plan("readOnly"), subscription: null })).toBe("trialEnded");
    expect(planState({ plan: plan("readOnly"), subscription: sub("canceled") })).toBe("subscriptionEnded");
    expect(planState({ plan: plan("active"), subscription: sub("active") })).toBe("active");
    expect(planState({ plan: plan("active"), subscription: sub("active", true) })).toBe("cancelled");
    expect(planState({ plan: plan("pastDue"), subscription: sub("past_due") })).toBe("pastDue");
    expect(planHeadline({ plan: plan("readOnly"), subscription: null }).badge).toBe("Solo lectura");
  });
});

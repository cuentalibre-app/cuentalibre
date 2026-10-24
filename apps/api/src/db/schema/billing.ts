import type { BillingPeriod } from "@cuentalibre/contracts";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { createdAt, updatedAt } from "./columns";

/**
 * Each organization's Stripe customer, made when someone first goes to pay, and its
 * subscription as the webhook last read it from Stripe. Only on instances that bill.
 */
export const subscription = pgTable("subscription", {
  organizationId: uuid()
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  stripeCustomerId: text().notNull().unique(),
  /** Null until the first checkout completes. */
  stripeSubscriptionId: text().unique(),
  period: text().$type<BillingPeriod>(),
  /** Stripe's status: `active`, `past_due`, `canceled`… */
  status: text(),
  currentPeriodEnd: timestamp({ withTimezone: true }),
  cancelAtPeriodEnd: boolean().default(false).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Stripe events already handled, so a redelivered one is handled once. */
export const stripeEvent = pgTable("stripe_event", {
  id: text().primaryKey(),
  type: text().notNull(),
  createdAt: createdAt(),
});

import type { BillingPeriod } from "@cuentalibre/contracts";
import type { DeletionNotice } from "../../billing/retention";
import { boolean, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
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

/**
 * The emails sent to an organization's owners before deleting it for being read-only
 * too long (`src/billing/retention.ts`), one per notice and read-only spell: subscribing
 * and lapsing again starts a new spell, with its own notices.
 */
export const deletionNotice = pgTable(
  "deletion_notice",
  {
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    readOnlySince: timestamp({ withTimezone: true }).notNull(),
    notice: text().$type<DeletionNotice>().notNull(),
    sentAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.readOnlySince, table.notice] })],
);

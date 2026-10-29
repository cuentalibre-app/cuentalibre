import type { AccountKind, PaymentMethodType } from "@cuentalibre/contracts";
import { boolean, foreignKey, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { createdAt, updatedAt } from "./columns";
import { amount, day } from "./sales";

/* Treasury accounts, payment methods and manual payments. Deleted with a tombstone. */

const tenant = () =>
  uuid()
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: timestamp({ withTimezone: true }),
});

export const treasuryAccount = pgTable(
  "treasury_account",
  {
    organizationId: tenant(),
    id: uuid().notNull(),
    kind: text().$type<AccountKind>().notNull(),
    name: text().notNull(),
    /** IBAN, card number (often its last digits) or PayPal email. */
    number: text().notNull(),
    active: boolean().notNull(),
    ...timestamps(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.id] })],
);

export const paymentMethod = pgTable(
  "payment_method",
  {
    organizationId: tenant(),
    id: uuid().notNull(),
    type: text().$type<PaymentMethodType>().notNull(),
    name: text().notNull(),
    number: text().notNull(),
    /** Treasury account it books into, if any. */
    accountId: uuid(),
    active: boolean().notNull(),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.id] }),
    foreignKey({
      columns: [table.organizationId, table.accountId],
      foreignColumns: [treasuryAccount.organizationId, treasuryAccount.id],
    }),
  ],
);

/** Collections and payments not tied to an invoice or expense. */
export const manualPayment = pgTable(
  "manual_payment",
  {
    organizationId: tenant(),
    id: uuid().notNull(),
    date: day().notNull(),
    /** Signed cents: positive for money in. */
    amount: amount().notNull(),
    paymentMethodId: uuid().notNull(),
    description: text().notNull(),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.id] }),
    foreignKey({
      columns: [table.organizationId, table.paymentMethodId],
      foreignColumns: [paymentMethod.organizationId, paymentMethod.id],
    }),
  ],
);

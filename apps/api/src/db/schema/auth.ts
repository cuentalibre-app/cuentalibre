/*
 * Tables used by Better Auth: users, sessions, sign-in accounts, organizations
 * and the memberships that link them. Started from `pnpm dlx auth generate` and
 * adapted to our conventions: UUID keys, timestamps with time zone and
 * snake_case columns (set by `casing` on the client). After changing the auth
 * config, run `pnpm dlx auth generate --config auth.config.ts --output <scratch file>`
 * and port the differences here.
 */
import { relations } from "drizzle-orm";
import { bigint, boolean, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./columns";

export const user = pgTable("user", {
  id: uuid().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().default(false).notNull(),
  image: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const organization = pgTable("organization", {
  id: uuid().primaryKey(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  logo: text(),
  metadata: text(),
  createdAt: createdAt(),
});

export const membership = pgTable(
  "membership",
  {
    id: uuid().primaryKey(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** owner, admin or member. */
    role: text().default("member").notNull(),
    createdAt: createdAt(),
  },
  (table) => [unique().on(table.organizationId, table.userId), index().on(table.userId)],
);

export const invitation = pgTable(
  "invitation",
  {
    id: uuid().primaryKey(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text().notNull(),
    role: text(),
    status: text().default("pending").notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    inviterId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [index().on(table.organizationId), index().on(table.email)],
);

export const session = pgTable(
  "session",
  {
    id: uuid().primaryKey(),
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The organization the user is working in; requests are scoped to it. */
    activeOrganizationId: uuid().references(() => organization.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index().on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: uuid().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index().on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: uuid().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index().on(table.identifier)],
);

/**
 * Better Auth's rate limit counters, one per IP address and path, so they survive
 * deploys. `lastRequest` is in milliseconds since the epoch; old rows are pruned as it goes.
 */
export const rateLimit = pgTable(
  "rate_limit",
  {
    id: uuid().primaryKey(),
    key: text().notNull().unique(),
    count: integer().notNull(),
    lastRequest: bigint({ mode: "number" }).notNull(),
  },
  (table) => [index().on(table.lastRequest)],
);

/**
 * API keys, for scripts and agents (Better Auth's api-key plugin). Each one
 * acts as the user who created it, in the organization named in its
 * `metadata` (JSON), and stops working if the user leaves it. Only a hash of
 * the key is stored.
 */
export const apikey = pgTable(
  "apikey",
  {
    id: uuid().primaryKey(),
    configId: text().default("default").notNull(),
    name: text(),
    /** First characters of the key, to recognize it in a list. */
    start: text(),
    /** The user it belongs to. */
    referenceId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    prefix: text(),
    key: text().notNull(),
    refillInterval: integer(),
    refillAmount: integer(),
    lastRefillAt: timestamp({ withTimezone: true }),
    enabled: boolean().default(true),
    rateLimitEnabled: boolean().default(true),
    rateLimitTimeWindow: integer(),
    rateLimitMax: integer(),
    requestCount: integer().default(0),
    remaining: integer(),
    lastRequest: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    permissions: text(),
    metadata: text(),
  },
  (table) => [index().on(table.configId), index().on(table.referenceId), index().on(table.key)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  memberships: many(membership),
  invitations: many(invitation),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  memberships: many(membership),
  invitations: many(invitation),
}));

export const membershipRelations = relations(membership, ({ one }) => ({
  organization: one(organization, { fields: [membership.organizationId], references: [organization.id] }),
  user: one(user, { fields: [membership.userId], references: [user.id] }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, { fields: [invitation.organizationId], references: [organization.id] }),
  user: one(user, { fields: [invitation.inviterId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

import type { SettingsSection, UserSettingsSection } from "@cuentalibre/contracts";
import { jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { createdAt, updatedAt } from "./columns";

/**
 * The organization's settings, one JSON document per section, validated with
 * the section's schema on every save. A section that was never saved has no
 * row: the API serves its defaults.
 */
export const organizationSetting = pgTable(
  "organization_setting",
  {
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    section: text().$type<SettingsSection>().notNull(),
    data: jsonb().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.section] })],
);

/**
 * The signed-in user's own settings, one JSON document per section, validated
 * with `userSettingsSchema`. They follow the user across organizations.
 */
export const userSetting = pgTable(
  "user_setting",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    section: text().$type<UserSettingsSection>().notNull(),
    data: jsonb().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.section] })],
);

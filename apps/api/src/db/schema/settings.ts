import type { SettingsSection } from "@fiscalia/contracts";
import { jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
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

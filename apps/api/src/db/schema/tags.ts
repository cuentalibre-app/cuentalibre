import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { createdAt, updatedAt } from "./columns";

/** The tag list with its colors. Records store tag names, so deleting a tag leaves them as they are. */
export const tag = pgTable(
  "tag",
  {
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    id: uuid().notNull(),
    name: text().notNull(),
    /** "#rrggbb". */
    color: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.id] })],
);

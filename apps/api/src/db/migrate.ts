import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import type { Db } from "./client";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Applies the SQL migrations in `drizzle/` that haven't run yet. */
export function runMigrations(db: Db) {
  return migrate(db, { migrationsFolder });
}

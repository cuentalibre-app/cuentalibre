import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url: string, options?: postgres.Options<{}>) {
  const client = postgres(url, options);
  return drizzle({ client, schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;

import { loadEnv } from "../env";
import { createDb } from "./client";
import { runMigrations } from "./migrate";

const db = createDb(loadEnv().DATABASE_URL);
await runMigrations(db);
await db.$client.end();
console.log("Migrations applied");

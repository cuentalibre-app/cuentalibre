import postgres from "postgres";
import { createDb } from "../db/client";
import { runMigrations } from "../db/migrate";
import { testDatabaseUrl } from "./database";

/** Creates the test database if needed, wipes it and applies the migrations. */
export default async function setup() {
  const url = new URL(testDatabaseUrl);
  const name = url.pathname.slice(1);
  const admin = postgres({ ...connection(url), database: "postgres", onnotice: () => {} });
  const [exists] = await admin`select 1 from pg_database where datname = ${name}`;
  if (!exists) await admin.unsafe(`create database "${name}"`);
  await admin.end();

  const db = createDb(testDatabaseUrl, { onnotice: () => {} });
  await db.$client.unsafe(
    "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;",
  );
  await runMigrations(db);
  await db.$client.end();
}

function connection(url: URL) {
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

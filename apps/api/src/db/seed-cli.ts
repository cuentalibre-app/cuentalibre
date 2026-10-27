import { createApp } from "../app";
import { createAuth } from "../auth";
import { loadEnv } from "../env";
import { createStorage } from "../storage";
import { createDb } from "./client";
import { seed } from "./seed";

const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD;
if (!email || !password) throw new Error("Seeding needs SEED_EMAIL and SEED_PASSWORD");

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const app = createApp({ db, auth: createAuth(db, env, null), env, storage: createStorage(env), mailer: null });
const created = await seed(app, db, env.BETTER_AUTH_URL, { email, password });
await db.$client.end();
console.log(created ? `Seeded ${email}` : `${email} already exists; nothing seeded`);

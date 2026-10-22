// Entry point for the Better Auth CLI (`pnpm dlx auth generate`), which reads the auth tables from it.
import { createAuth } from "./src/auth";
import { createDb } from "./src/db/client";
import { createMailer } from "./src/email/mailer";
import { loadEnv } from "./src/env";

const env = loadEnv();
export const auth = createAuth(createDb(env.DATABASE_URL), env, createMailer(env));

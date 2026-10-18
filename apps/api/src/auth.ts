import { newId } from "@fiscalia/core";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import type { Db } from "./db/client";
import * as schema from "./db/schema";
import type { Env } from "./env";

/**
 * Authentication with Better Auth: email and password sign-in, sessions in
 * Postgres, and organizations. Users belong to organizations through
 * `membership`, which carries their role.
 */
export function createAuth(db: Db, env: Env) {
  return betterAuth({
    appName: "Fiscalia",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/v1/auth",
    trustedOrigins: [env.WEB_ORIGIN],
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true },
    plugins: [organization({ schema: { member: { modelName: "membership" } } })],
    advanced: {
      // UUIDv7, like the records the web app creates.
      database: { generateId: () => newId() },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;

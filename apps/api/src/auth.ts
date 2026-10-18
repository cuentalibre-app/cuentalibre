import { newId } from "@fiscalia/core";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";
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
    databaseHooks: {
      session: {
        create: {
          // A new session starts in the user's oldest organization, so signing in lands in the app.
          before: async (data) => {
            const [first] = await db
              .select({ organizationId: schema.membership.organizationId })
              .from(schema.membership)
              .where(eq(schema.membership.userId, data.userId))
              .orderBy(asc(schema.membership.createdAt))
              .limit(1);
            return { data: { ...data, activeOrganizationId: first?.organizationId ?? null } };
          },
        },
      },
    },
    advanced: {
      // UUIDv7, like the records the web app creates.
      database: { generateId: () => newId() },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;

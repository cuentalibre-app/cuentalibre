import { newId } from "@cuentalibre/core";
import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";
import type { Db } from "./db/client";
import * as schema from "./db/schema";
import {
  VERIFICATION_EXPIRES_IN,
  passwordResetEmail,
  sendInBackground,
  verificationEmail,
} from "./email/account-emails";
import type { Mailer } from "./email/mailer";
import type { Env } from "./env";

/** Every API key starts with it, so leaked keys are easy to spot. */
export const API_KEY_PREFIX = "fsk_";

/**
 * The organization plugin's routes the web app doesn't use yet, closed until it does: a user
 * has one organization, created at onboarding. Switching organizations reopens `set-active`
 * and `list` (#33); invitations and managing members, the rest (#32, #34).
 */
export const CLOSED_ORGANIZATION_PATHS = [
  "/organization/set-active",
  "/organization/list",
  "/organization/check-slug",
  "/organization/get-full-organization",
  "/organization/update",
  "/organization/delete",
  "/organization/leave",
  "/organization/invite-member",
  "/organization/accept-invitation",
  "/organization/reject-invitation",
  "/organization/cancel-invitation",
  "/organization/get-invitation",
  "/organization/list-invitations",
  "/organization/list-user-invitations",
  "/organization/list-members",
  "/organization/remove-member",
  "/organization/update-member-role",
  "/organization/get-active-member",
  "/organization/get-active-member-role",
  "/organization/has-permission",
];

/**
 * Authentication with Better Auth: email and password sign-in, Google when
 * configured, sessions in Postgres, and organizations. Users belong to organizations through
 * `membership`, which carries their role. Scripts and agents use API keys.
 *
 * With a mailer, new users get a link to verify their email, and people who
 * forgot their password get one to reset it. Google only links itself to an
 * existing user whose email is verified: otherwise someone could sign up with
 * another person's email and keep access after the owner signs in with Google.
 */
export function createAuth(db: Db, env: Env, mailer: Mailer | null) {
  return betterAuth({
    appName: "cuentalibre",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/v1/auth",
    trustedOrigins: [env.WEB_ORIGIN],
    disabledPaths: CLOSED_ORGANIZATION_PATHS,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      // Whoever reset the password owns the mailbox: anyone else signed in is out
      revokeSessionsOnPasswordReset: true,
      ...(mailer && {
        sendResetPassword: async ({ user, url }) => sendInBackground(mailer, passwordResetEmail(user, url)),
        // The reset link reached the mailbox, which proves it is theirs
        onPasswordReset: async ({ user }) => {
          await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.id, user.id));
        },
      }),
    },
    ...(mailer && {
      emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        expiresIn: VERIFICATION_EXPIRES_IN,
        sendVerificationEmail: async ({ user, url }) => sendInBackground(mailer, verificationEmail(user, url)),
      },
    }),
    socialProviders: googleProvider(env),
    plugins: [
      // One organization per user until the web app can switch between them (#33)
      organization({ organizationLimit: 1, schema: { member: { modelName: "membership" } } }),
      // Keys are created and checked through our own routes and middleware (`routes/api-keys.ts`)
      apiKey({
        defaultPrefix: API_KEY_PREFIX,
        enableMetadata: true,
        rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 600 },
      }),
    ],
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

/** True when the instance lets people sign in with Google. */
export const hasGoogleSignIn = (env: Env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

function googleProvider(env: Env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return {};
  return {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account" as const,
      // A Google account only becomes a new user when the web app asks, next to the terms it accepts.
      disableImplicitSignUp: true,
    },
  };
}

export type Auth = ReturnType<typeof createAuth>;

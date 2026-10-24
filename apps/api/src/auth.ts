import { newId } from "@cuentalibre/core";
import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";
import { rejectBreachedPasswords } from "./breached-passwords";
import type { Db } from "./db/client";
import * as schema from "./db/schema";
import {
  VERIFICATION_EXPIRES_IN,
  emailChangeCodeEmail,
  passwordResetEmail,
  sendInBackground,
  verificationCodeEmail,
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
 * The email OTP plugin's routes beyond verifying an email and changing it: signing in or
 * resetting a password with a code would skip the password, and signing in would create
 * users who never accepted the terms. Codes are sent through `/send-verification-email`.
 */
export const CLOSED_EMAIL_OTP_PATHS = [
  "/sign-in/email-otp",
  "/forget-password/email-otp",
  "/email-otp/request-password-reset",
  "/email-otp/reset-password",
  "/email-otp/send-verification-otp",
  "/email-otp/check-verification-otp",
];

/**
 * Authentication with Better Auth: email and password sign-in, Google when
 * configured, sessions in Postgres, and organizations. Users belong to organizations through
 * `membership`, which carries their role. Scripts and agents use API keys.
 *
 * With a mailer, new users get a code to verify their email (or to switch to
 * another one, if they mistyped it), and people who forgot their password get
 * a link to reset it. New passwords found in data breaches are rejected. Google only links itself to an
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
    disabledPaths: [...CLOSED_ORGANIZATION_PATHS, ...CLOSED_EMAIL_OTP_PATHS],
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
    // The email OTP plugin sends the verification email, with a code instead of a link
    ...(mailer && { emailVerification: { sendOnSignUp: true } }),
    socialProviders: googleProvider(env),
    ...(env.PASSWORD_BREACH_CHECK === "on" && { hooks: { before: rejectBreachedPasswords() } }),
    plugins: [
      // One organization per user until the web app can switch between them (#33)
      organization({ organizationLimit: 1, schema: { member: { modelName: "membership" } } }),
      // Keys are created and checked through our own routes and middleware (`routes/api-keys.ts`)
      apiKey({
        defaultPrefix: API_KEY_PREFIX,
        enableMetadata: true,
        rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 600 },
      }),
      ...(mailer ? [emailCodes(db, mailer)] : []),
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

/**
 * Six-digit codes to verify the user's email, entered without leaving the app, and to
 * switch to another email, sent to that one. Each code allows three tries.
 */
function emailCodes(db: Db, mailer: Mailer) {
  return emailOTP({
    overrideDefaultEmailVerification: true,
    expiresIn: VERIFICATION_EXPIRES_IN,
    storeOTP: "hashed",
    disableSignUp: true,
    changeEmail: { enabled: true },
    sendVerificationOTP: async ({ email, otp, type }, ctx) => {
      // Changing it, the new email has no user yet: the code goes to whoever is signed in
      const name = ctx?.context.session?.user.name ?? (await nameOf(db, email));
      if (type === "email-verification") sendInBackground(mailer, verificationCodeEmail({ name, email }, otp));
      if (type === "change-email") sendInBackground(mailer, emailChangeCodeEmail({ name, email }, otp));
    },
  });
}

async function nameOf(db: Db, email: string) {
  const [found] = await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.email, email));
  return found?.name ?? "";
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

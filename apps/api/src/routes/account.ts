import {
  meSchema,
  membershipSchema,
  organizationMemberSchema,
  organizationSchema,
  userSettingsSchema,
  userSettingsSectionSchema,
  type MembershipRole,
  type UserSettings,
} from "@cuentalibre/contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { newId } from "@cuentalibre/core";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { isLive } from "../billing/plan";
import { BREACHED_PASSWORD, BREACHED_PASSWORD_MESSAGE, isBreachedPassword } from "../breached-passwords";
import type { AppEnv } from "../context";
import type { Db } from "../db/client";
import {
  account,
  file,
  invitation,
  membership,
  organization,
  subscription,
  user as userTable,
  userSetting,
  verification,
} from "../db/schema";
import { ApiError, errorContent, errorResponse } from "../errors";
import { reportError } from "../error-reporting";
import { requireOrganization, requireSession, requireUser } from "../middleware";
import { parseOr } from "../sync/records";

const me = createRoute({
  method: "get",
  path: "/me",
  tags: ["Account"],
  summary: "The signed-in user and the organizations they belong to",
  middleware: [requireUser] as const,
  responses: {
    200: {
      description: "The signed-in user",
      content: {
        "application/json": {
          schema: meSchema,
        },
      },
    },
    401: errorContent("Not signed in"),
  },
});

const saveUserSettings = createRoute({
  method: "put",
  path: "/me/settings/{section}",
  tags: ["Account"],
  summary: "Replace a section of the signed-in user's own settings",
  description:
    "The body is the whole section: `userProfile` (first and last names, birth date, phone, gender) `userLocale` (language, number format, time zone; empty follows the business) or `userTour` (whether the first-run tour was finished or skipped). Saving the profile also renames the user.",
  middleware: [requireUser] as const,
  request: {
    params: z.object({ section: userSettingsSectionSchema }),
    body: { required: true, content: { "application/json": { schema: z.record(z.string(), z.unknown()) } } },
  },
  responses: {
    204: { description: "The section is saved" },
    400: errorContent("The section doesn't match its schema"),
    401: errorContent("Not signed in"),
  },
});

const currentOrganization = createRoute({
  method: "get",
  path: "/organization",
  tags: ["Account"],
  summary: "The organization requests are scoped to, and the user's role in it",
  middleware: [requireOrganization] as const,
  responses: {
    200: {
      description: "The active organization",
      content: {
        "application/json": {
          schema: z.object({ organization: organizationSchema, role: membershipSchema.shape.role }),
        },
      },
    },
    401: errorContent("Not signed in"),
    403: errorContent("No active organization, or the user doesn't belong to it"),
  },
});

const members = createRoute({
  method: "get",
  path: "/organization/members",
  tags: ["Account"],
  summary: "The people who belong to the active organization",
  description: "Oldest first, so the owner who created it leads.",
  middleware: [requireOrganization] as const,
  responses: {
    200: {
      description: "The organization's members",
      content: { "application/json": { schema: z.object({ members: z.array(organizationMemberSchema) }) } },
    },
    401: errorContent("Not signed in"),
    403: errorContent("No active organization, or the user doesn't belong to it"),
  },
});

const deleteAccount = createRoute({
  method: "delete",
  path: "/me",
  tags: ["Account"],
  summary: "Delete the signed-in user's account and the organizations only they belong to",
  description:
    "Erases the user, their sessions, sign-in methods and API keys, and every organization where they are the only member, with all its data and files, and cancels their subscriptions. Organizations shared with other people are kept; the user just leaves them. Needs a browser session (an API key can't do it) and the current password; users without one, who sign in with Google, need a session started in the last ten minutes instead.",
  middleware: [requireSession] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: z.object({ password: z.string().min(1).optional() }) } },
    },
  },
  responses: {
    204: { description: "The account is deleted" },
    401: errorContent("Not signed in, or signed in with an API key"),
    403: errorContent("The password is wrong, or the user has none and the session is not recent"),
    409: errorContent("The user is the only owner of an organization that has other members"),
  },
});

/** Better Auth's limits, which signing up and changing a password also apply. */
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const createPassword = createRoute({
  method: "post",
  path: "/me/password",
  tags: ["Account"],
  summary: "Give a password to a user who only signs in with Google",
  description:
    "Afterwards they can also sign in with their email and this password. Needs a browser session started in the last ten minutes, as there is no password to confirm it's them; users who have one change it with `/v1/auth/change-password`.",
  middleware: [requireSession] as const,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({ newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH) }),
        },
      },
    },
  },
  responses: {
    204: { description: "The password is set" },
    400: errorContent("The password is too short or too long, or it has appeared in a data breach"),
    401: errorContent("Not signed in, or signed in with an API key"),
    403: errorContent("The session is not recent"),
    409: errorContent("The user has a password already"),
  },
});

/** How recent a session must be to delete an account, or create a password, without one. */
const FRESH_SESSION_MS = 10 * 60 * 1000;

const organizationColumns = { id: organization.id, name: organization.name, slug: organization.slug };

/**
 * Every section: as saved, or its defaults; the profile starts from the name
 * given on sign-up, and the tour is pending until the user finishes or skips it.
 */
async function readUserSettings(db: Db, user: { id: string; name: string }): Promise<UserSettings> {
  const rows = await db.select().from(userSetting).where(eq(userSetting.userId, user.id));
  const saved = Object.fromEntries(rows.map((row) => [row.section, row.data])) as Partial<UserSettings>;
  return {
    userProfile: saved.userProfile ?? { firstName: user.name, lastName: "", birthDate: "", phone: "", gender: "" },
    userLocale: saved.userLocale ?? { language: "", numberFormat: "", timeZone: "" },
    userTour: saved.userTour ?? { status: "pending" },
  };
}

export const accountRoutes = new OpenAPIHono<AppEnv>()
  .openapi(me, async (c) => {
    const user = c.get("user")!;
    const db = c.get("db");
    const [credential] = await db
      .select({ updatedAt: account.updatedAt })
      .from(account)
      .where(and(eq(account.userId, user.id), eq(account.providerId, "credential")));
    const rows = await db
      .select({ organization: organizationColumns, role: membership.role })
      .from(membership)
      .innerJoin(organization, eq(organization.id, membership.organizationId))
      .where(eq(membership.userId, user.id))
      .orderBy(organization.name);
    return c.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          hasPassword: Boolean(credential),
          // Only the password changes on the credential account
          passwordChangedAt: credential?.updatedAt.toISOString() ?? null,
        },
        activeOrganizationId: c.get("activeOrganizationId"),
        memberships: rows.map((row) => ({ ...row, role: row.role as MembershipRole })),
        settings: await readUserSettings(db, user),
      },
      200,
    );
  })
  .openapi(saveUserSettings, async (c) => {
    const { id: userId } = c.get("user")!;
    const { section } = c.req.valid("param");
    const data = parseOr(userSettingsSchema.shape[section], c.req.valid("json"), "invalid_settings");
    await c.get("db").transaction(async (tx) => {
      await tx
        .insert(userSetting)
        .values({ userId, section, data })
        .onConflictDoUpdate({
          target: [userSetting.userId, userSetting.section],
          set: { data, updatedAt: new Date() },
        });
      // The account's name is what emails and other members see
      if (section === "userProfile") {
        const { firstName, lastName } = data as UserSettings["userProfile"];
        const name = `${firstName} ${lastName.trim()}`.trim();
        await tx.update(userTable).set({ name }).where(eq(userTable.id, userId));
      }
    });
    return c.body(null, 204);
  })
  .openapi(currentOrganization, async (c) => {
    const [row] = await c
      .get("db")
      .select(organizationColumns)
      .from(organization)
      .where(eq(organization.id, c.get("organizationId")));
    return c.json({ organization: row!, role: c.get("role") }, 200);
  })
  .openapi(members, async (c) => {
    const rows = await c
      .get("db")
      .select({
        userId: membership.userId,
        name: userTable.name,
        email: userTable.email,
        role: membership.role,
        joinedAt: membership.createdAt,
      })
      .from(membership)
      .innerJoin(userTable, eq(userTable.id, membership.userId))
      .where(eq(membership.organizationId, c.get("organizationId")))
      .orderBy(asc(membership.createdAt));
    return c.json(
      {
        members: rows.map((row) => ({
          ...row,
          role: row.role as MembershipRole,
          joinedAt: row.joinedAt.toISOString(),
        })),
      },
      200,
    );
  })
  .openapi(createPassword, async (c) => {
    const db = c.get("db");
    const { id: userId } = c.get("user")!;
    const { newPassword } = c.req.valid("json");
    // Someone who got hold of the session mustn't make themselves a way back in
    if (Date.now() - c.get("session")!.createdAt.getTime() > FRESH_SESSION_MS)
      return errorResponse(c, 403, "session_not_fresh", "Sign in again to confirm it's you, then create the password.");

    const [credential] = await db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
    if (credential) return errorResponse(c, 409, "password_already_set", "The user has a password already.");
    if (c.get("checkBreachedPasswords") && (await isBreachedPassword(newPassword)))
      return errorResponse(c, 400, BREACHED_PASSWORD, BREACHED_PASSWORD_MESSAGE);
    // The row Better Auth makes on signing up with email and password
    await db.insert(account).values({
      id: newId(),
      userId,
      providerId: "credential",
      accountId: userId,
      password: await hashPassword(newPassword),
    });
    return c.body(null, 204);
  })
  .openapi(deleteAccount, async (c) => {
    const db = c.get("db");
    const { id: userId, email } = c.get("user")!;
    const { password } = c.req.valid("json");

    const [credential] = await db
      .select({ hash: account.password })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
    if (credential?.hash) {
      if (!password || !(await verifyPassword({ hash: credential.hash, password })))
        return errorResponse(c, 403, "wrong_password", "The password is wrong.");
    } else if (Date.now() - c.get("session")!.createdAt.getTime() > FRESH_SESSION_MS) {
      return errorResponse(c, 403, "session_not_fresh", "Sign in again to confirm it's you, then delete the account.");
    }

    const { storageKeys, subscriptionIds } = await db.transaction(async (tx) => {
      // Lock the user's memberships so nobody joins or leaves their organizations meanwhile
      const mine = await tx
        .select({ organizationId: membership.organizationId, role: membership.role })
        .from(membership)
        .where(eq(membership.userId, userId))
        .for("update");
      const ids = mine.map((row) => row.organizationId);
      const others = ids.length
        ? await tx
            .select({ organizationId: membership.organizationId, role: membership.role })
            .from(membership)
            .where(and(inArray(membership.organizationId, ids), ne(membership.userId, userId)))
            .for("update")
        : [];

      const shared = new Set(others.map((row) => row.organizationId));
      const owned = new Set(others.filter((row) => row.role === "owner").map((row) => row.organizationId));
      if (mine.some((row) => row.role === "owner" && shared.has(row.organizationId) && !owned.has(row.organizationId)))
        throw new ApiError(
          409,
          "sole_owner",
          "You are the only owner of an organization with other members. Remove them or make one of them an owner first.",
        );

      const solo = ids.filter((id) => !shared.has(id));
      const keys = solo.length
        ? (await tx.select({ key: file.storageKey }).from(file).where(inArray(file.organizationId, solo))).map(
            (row) => row.key,
          )
        : [];
      const subscriptions = solo.length
        ? await tx
            .select({ id: subscription.stripeSubscriptionId, status: subscription.status })
            .from(subscription)
            .where(inArray(subscription.organizationId, solo))
        : [];
      // Everything an organization holds cascades from it: records, settings, files, outbox, VERI*FACTU…
      if (solo.length) await tx.delete(organization).where(inArray(organization.id, solo));
      await tx.delete(invitation).where(sql`lower(${invitation.email}) = lower(${email})`);
      await tx.delete(verification).where(eq(verification.value, userId));
      // Sessions, sign-in accounts, memberships, API keys and sent invitations cascade from the user.
      await tx.delete(userTable).where(eq(userTable.id, userId));
      return {
        storageKeys: keys,
        subscriptionIds: subscriptions.filter((row) => row.id && isLive(row.status)).map((row) => row.id!),
      };
    });

    // After the commit: a file left behind by a failure here is unreachable, never a dangling row.
    const storage = c.get("storage");
    for (const key of storageKeys) {
      await storage.delete(key).catch((error: unknown) => console.error(`Couldn't delete file ${key}`, error));
    }
    // Nobody is left to use what they would pay for. A failure must reach someone, who cancels it by hand.
    const billing = c.get("billing");
    for (const id of subscriptionIds) {
      await billing?.stripe.cancelSubscription(id).catch((error: unknown) => {
        console.error(`Couldn't cancel subscription ${id}`, error);
        reportError(error, { method: c.req.method, route: c.req.routePath });
      });
    }
    return c.body(null, 204);
  });

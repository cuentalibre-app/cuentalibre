import { membershipSchema, organizationSchema, type MembershipRole } from "@cuentalibre/contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { verifyPassword } from "better-auth/crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { AppEnv } from "../context";
import { account, file, invitation, membership, organization, user as userTable, verification } from "../db/schema";
import { ApiError, errorContent, errorResponse } from "../errors";
import { requireOrganization, requireSession, requireUser } from "../middleware";

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
          schema: z.object({
            user: z.object({ id: z.uuid(), name: z.string(), email: z.email() }),
            activeOrganizationId: z.uuid().nullable(),
            memberships: z.array(membershipSchema),
          }),
        },
      },
    },
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

const deleteAccount = createRoute({
  method: "delete",
  path: "/me",
  tags: ["Account"],
  summary: "Delete the signed-in user's account and the organizations only they belong to",
  description:
    "Erases the user, their sessions, sign-in methods and API keys, and every organization where they are the only member, with all its data and files. Organizations shared with other people are kept; the user just leaves them. Needs the current password, and a browser session: an API key can't do it.",
  middleware: [requireSession] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: z.object({ password: z.string().min(1) }) } },
    },
  },
  responses: {
    204: { description: "The account is deleted" },
    401: errorContent("Not signed in, or signed in with an API key"),
    403: errorContent("The password is wrong"),
    409: errorContent("The user is the only owner of an organization that has other members"),
  },
});

const organizationColumns = { id: organization.id, name: organization.name, slug: organization.slug };

export const accountRoutes = new OpenAPIHono<AppEnv>()
  .openapi(me, async (c) => {
    const user = c.get("user")!;
    const rows = await c
      .get("db")
      .select({ organization: organizationColumns, role: membership.role })
      .from(membership)
      .innerJoin(organization, eq(organization.id, membership.organizationId))
      .where(eq(membership.userId, user.id))
      .orderBy(organization.name);
    return c.json(
      {
        user: { id: user.id, name: user.name, email: user.email },
        activeOrganizationId: c.get("activeOrganizationId"),
        memberships: rows.map((row) => ({ ...row, role: row.role as MembershipRole })),
      },
      200,
    );
  })
  .openapi(currentOrganization, async (c) => {
    const [row] = await c
      .get("db")
      .select(organizationColumns)
      .from(organization)
      .where(eq(organization.id, c.get("organizationId")));
    return c.json({ organization: row!, role: c.get("role") }, 200);
  })
  .openapi(deleteAccount, async (c) => {
    const db = c.get("db");
    const { id: userId, email } = c.get("user")!;
    const { password } = c.req.valid("json");

    const [credential] = await db
      .select({ hash: account.password })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
    if (!credential?.hash || !(await verifyPassword({ hash: credential.hash, password })))
      return errorResponse(c, 403, "wrong_password", "The password is wrong.");

    const storageKeys = await db.transaction(async (tx) => {
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
      // Everything an organization holds cascades from it: records, settings, files, outbox, VERI*FACTU…
      if (solo.length) await tx.delete(organization).where(inArray(organization.id, solo));
      await tx.delete(invitation).where(sql`lower(${invitation.email}) = lower(${email})`);
      await tx.delete(verification).where(eq(verification.value, userId));
      // Sessions, sign-in accounts, memberships, API keys and sent invitations cascade from the user.
      await tx.delete(userTable).where(eq(userTable.id, userId));
      return keys;
    });

    // After the commit: a file left behind by a failure here is unreachable, never a dangling row.
    const storage = c.get("storage");
    for (const key of storageKeys) {
      await storage.delete(key).catch((error: unknown) => console.error(`Couldn't delete file ${key}`, error));
    }
    return c.body(null, 204);
  });

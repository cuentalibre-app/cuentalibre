import { membershipSchema, organizationSchema, type MembershipRole } from "@cuentalibre/contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../context";
import { membership, organization } from "../db/schema";
import { errorContent } from "../errors";
import { requireOrganization, requireUser } from "../middleware";

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
  });

import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { Auth } from "./auth";
import type { AppEnv } from "./context";
import { membership } from "./db/schema";
import { errorResponse } from "./errors";

/** Reads the session cookie, if any, and puts the user and session on the context. */
export const loadSession = (auth: Auth) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const data = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set("user", data?.user ?? null);
    c.set("session", data?.session ?? null);
    await next();
  });

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user")) return errorResponse(c, 401, "unauthorized", "Sign in to continue.");
  await next();
});

/**
 * Scopes the request to the session's active organization, after checking the
 * user still belongs to it. Every tenant route goes through here and filters by
 * `organizationId`, so no request can read or write another organization's data.
 */
export const requireOrganization = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) return errorResponse(c, 401, "unauthorized", "Sign in to continue.");
  const organizationId = c.get("session")?.activeOrganizationId;
  if (!organizationId) return errorResponse(c, 403, "no_active_organization", "Choose an organization first.");

  const [row] = await c
    .get("db")
    .select({ role: membership.role })
    .from(membership)
    .where(and(eq(membership.organizationId, organizationId), eq(membership.userId, user.id)));
  if (!row) return errorResponse(c, 403, "not_a_member", "You don't belong to this organization.");

  c.set("organizationId", organizationId);
  c.set("role", row.role as AppEnv["Variables"]["role"]);
  await next();
});

import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { API_KEY_PREFIX, type Auth } from "./auth";
import type { AppEnv } from "./context";
import { membership, user } from "./db/schema";
import { errorResponse } from "./errors";
import type { Scope } from "./sync/write";

/** The API key a request carries, as `Authorization: Bearer <key>` or `x-api-key`. */
function apiKeyOf(headers: Headers): string | null {
  const bearer = /^Bearer\s+(\S+)$/i.exec(headers.get("authorization") ?? "")?.[1];
  const key = bearer ?? headers.get("x-api-key");
  return key?.startsWith(API_KEY_PREFIX) ? key : null;
}

/**
 * Authenticates the request: with an API key, which acts as its user in its
 * organization, or with the session cookie. Puts the user on the context.
 */
export const loadSession = (auth: Auth) =>
  createMiddleware<AppEnv>(async (c, next) => {
    c.set("apiKeyId", null);
    const key = apiKeyOf(c.req.raw.headers);
    if (key) {
      const result = await auth.api.verifyApiKey({ body: { key } });
      if (!result.valid || !result.key) {
        if (result.error?.code === "RATE_LIMITED")
          return errorResponse(c, 429, "rate_limited", "Too many requests with this API key; try again shortly.");
        return errorResponse(c, 401, "invalid_api_key", "The API key is invalid, expired or revoked.");
      }
      const [owner] = await c.get("db").select().from(user).where(eq(user.id, result.key.referenceId));
      if (!owner) return errorResponse(c, 401, "invalid_api_key", "The API key is invalid, expired or revoked.");
      const metadata = (result.key.metadata ?? {}) as { organizationId?: string };
      c.set("user", owner as AppEnv["Variables"]["user"]);
      c.set("session", null);
      c.set("activeOrganizationId", metadata.organizationId ?? null);
      c.set("apiKeyId", result.key.id);
      return next();
    }
    const data = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set("user", data?.user ?? null);
    c.set("session", data?.session ?? null);
    c.set("activeOrganizationId", data?.session.activeOrganizationId ?? null);
    await next();
  });

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user")) return errorResponse(c, 401, "unauthorized", "Sign in to continue.");
  await next();
});

/** For what only a signed-in person may do, such as managing API keys: an API key can't. */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("session")) return errorResponse(c, 401, "unauthorized", "Sign in to continue.");
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
  const organizationId = c.get("activeOrganizationId");
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

/** Who a tenant request acts as, for the services that write. */
export function scopeOf(c: Context<AppEnv>): Scope {
  return {
    organizationId: c.get("organizationId"),
    userId: c.get("user")!.id,
    verifactuEnvironment: c.get("verifactuEnvironment"),
  };
}

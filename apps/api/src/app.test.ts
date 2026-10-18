import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { session } from "./db/schema";
import { app, createOrganization, db, signUp } from "./test/harness";

describe("meta", () => {
  it("reports health", async () => {
    const response = await app.request("/v1/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("serves the OpenAPI document", async () => {
    const response = await app.request("/v1/openapi.json");
    const doc = (await response.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(["/v1/health", "/v1/me", "/v1/organization"]));
  });

  it("answers unknown routes with a JSON error", async () => {
    const response = await app.request("/v1/nope");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "not_found", message: "Not found." } });
  });
});

describe("account", () => {
  it("rejects anonymous requests", async () => {
    expect((await app.request("/v1/me")).status).toBe(401);
    expect((await app.request("/v1/organization")).status).toBe(401);
  });

  it("returns the user with UUIDv7 IDs", async () => {
    const ana = await signUp("Ana");
    const response = await ana.request("/v1/me");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { id: string; email: string }; memberships: unknown[] };
    expect(body.user.email).toBe(ana.email);
    expect(body.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    expect(body.memberships).toEqual([]);
  });

  it("needs an active organization for tenant routes", async () => {
    const ana = await signUp();
    const response = await ana.request("/v1/organization");
    expect(response.status).toBe(403);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("no_active_organization");
  });

  it("makes the creator the owner and scopes requests to the active organization", async () => {
    const ana = await signUp("Ana");
    const created = await createOrganization(ana, "Estudio Ana");

    const me = (await (await ana.request("/v1/me")).json()) as { activeOrganizationId: string; memberships: unknown };
    expect(me.activeOrganizationId).toBe(created.id);
    expect(me.memberships).toEqual([
      { organization: { id: created.id, name: "Estudio Ana", slug: created.slug }, role: "owner" },
    ]);

    const current = await ana.request("/v1/organization");
    expect(current.status).toBe(200);
    expect(await current.json()).toEqual({
      organization: { id: created.id, name: "Estudio Ana", slug: created.slug },
      role: "owner",
    });
  });

  it("doesn't let a user switch to another user's organization", async () => {
    const ana = await signUp("Ana");
    const luis = await signUp("Luis");
    const anas = await createOrganization(ana, "Ana SL");
    await createOrganization(luis, "Luis SL");

    const switched = await luis.request("/v1/auth/organization/set-active", {
      method: "POST",
      body: { organizationId: anas.id },
    });
    expect(switched.status).toBe(403);

    // Better Auth clears the active organization after the failed switch.
    const current = await luis.request("/v1/organization");
    expect(current.status).toBe(403);
  });

  it("rejects a session whose active organization the user doesn't belong to", async () => {
    const ana = await signUp("Ana");
    const luis = await signUp("Luis");
    const anas = await createOrganization(ana, "Ana SL");
    const lu = (await (await luis.request("/v1/me")).json()) as { user: { id: string } };
    // E.g. Luis was removed from the organization while signed in.
    await db.update(session).set({ activeOrganizationId: anas.id }).where(eq(session.userId, lu.user.id));

    const response = await luis.request("/v1/organization");
    expect(response.status).toBe(403);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("not_a_member");
  });
});

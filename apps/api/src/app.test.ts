import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { session } from "./db/schema";
import { createApp } from "./app";
import { CLOSED_ORGANIZATION_PATHS, createAuth } from "./auth";
import { accountMailer, app, createOrganization, db, env, mailer, signUp, storage } from "./test/harness";

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

  it("says whether Google sign-in is on", async () => {
    const response = await app.request("/v1/sign-in-methods");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ google: false, email: true, billing: false });
  });

  it("sends people to Google when it is set up", async () => {
    const googleEnv = { ...env, GOOGLE_CLIENT_ID: "client-id", GOOGLE_CLIENT_SECRET: "client-secret" };
    const withGoogle = createApp({
      db,
      auth: createAuth(db, googleEnv, accountMailer),
      env: googleEnv,
      storage,
      mailer,
    });
    expect(await (await withGoogle.request("/v1/sign-in-methods")).json()).toEqual({
      google: true,
      email: true,
      billing: false,
    });

    const origin = env.BETTER_AUTH_URL;
    const response = await withGoogle.request(`${origin}/v1/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ provider: "google", callbackURL: `${env.WEB_ORIGIN}/` }),
    });
    expect(response.status).toBe(200);
    const { url } = (await response.json()) as { url: string };
    expect(new URL(url).hostname).toBe("accounts.google.com");
    expect(new URL(url).searchParams.get("redirect_uri")).toBe(`${origin}/v1/auth/callback/google`);
  });

  it("lets a signed-in user start linking Google, but not a visitor", async () => {
    const googleEnv = { ...env, GOOGLE_CLIENT_ID: "client-id", GOOGLE_CLIENT_SECRET: "client-secret" };
    const withGoogle = createApp({
      db,
      auth: createAuth(db, googleEnv, accountMailer),
      env: googleEnv,
      storage,
      mailer,
    });
    const origin = env.BETTER_AUTH_URL;
    const link = (cookie?: string) =>
      withGoogle.request(`${origin}/v1/auth/link-social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin, ...(cookie ? { cookie } : {}) },
        body: JSON.stringify({ provider: "google", callbackURL: `${env.WEB_ORIGIN}/configuracion/credenciales` }),
      });
    expect((await link()).status).toBe(401);

    const signedUp = await withGoogle.request(`${origin}/v1/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ name: "Ana", email: `link${Date.now()}@example.com`, password: "a-long-password" }),
    });
    const cookie = signedUp.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const response = await link(cookie);
    expect(response.status).toBe(200);
    const { url } = (await response.json()) as { url: string };
    expect(new URL(url).hostname).toBe("accounts.google.com");
  });

  it("sends security headers, on errors and auth routes too", async () => {
    for (const path of ["/v1/health", "/v1/nope", "/v1/auth/get-session"]) {
      const response = await app.request(path);
      expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; frame-ancestors 'none'; sandbox");
      expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    }
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
    const body = (await response.json()) as {
      user: { id: string; email: string; hasPassword: boolean };
      memberships: unknown[];
    };
    expect(body.user.email).toBe(ana.email);
    expect(body.user.hasPassword).toBe(true);
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

  it("starts a new session in the user's organization", async () => {
    const ana = await signUp("Ana");
    const created = await createOrganization(ana, "Estudio Ana");

    const response = await app.request(`${env.BETTER_AUTH_URL}/v1/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: env.BETTER_AUTH_URL },
      body: JSON.stringify({ email: ana.email, password: "a-long-password" }),
    });
    expect(response.status).toBe(200);
    const [stored] = await db
      .select({ activeOrganizationId: session.activeOrganizationId })
      .from(session)
      .where(eq(session.token, ((await response.json()) as { token: string }).token));
    expect(stored?.activeOrganizationId).toBe(created.id);
  });

  it("lets a user create only one organization", async () => {
    const ana = await signUp("Ana");
    const first = await createOrganization(ana, "Ana SL");

    const second = await ana.request("/v1/auth/organization/create", {
      method: "POST",
      body: { name: "Otra SL", slug: `otra-sl-${crypto.randomUUID().slice(0, 8)}` },
    });
    expect(second.status).toBe(403);
    expect(await (await ana.request("/v1/organization")).json()).toMatchObject({ organization: { id: first.id } });
  });

  it("closes the organization routes the web app doesn't use", async () => {
    const ana = await signUp("Ana");
    const luis = await signUp("Luis");
    const anas = await createOrganization(ana, "Ana SL");
    await createOrganization(luis, "Luis SL");

    for (const path of CLOSED_ORGANIZATION_PATHS) {
      const response = await luis.request(`/v1/auth${path}`, { method: "POST", body: { organizationId: anas.id } });
      expect(response.status, path).toBe(404);
    }
    expect((await luis.request("/v1/auth/organization/list")).status).toBe(404);
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

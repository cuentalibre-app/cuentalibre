import type { Me } from "@cuentalibre/contracts";
import { newId } from "@cuentalibre/core";
import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { account, apikey, file, membership, organization, session, user, userSetting } from "./db/schema";
import { addOrganization, app, db, env, signUp, storage, withApiKey, type Client } from "./test/harness";
import { client, errorCode, member, send, workspace } from "./test/sync";

const PASSWORD = "a-long-password";

async function userIdOf(someone: Client) {
  const response = await someone.request("/v1/me");
  return ((await response.json()) as { user: { id: string } }).user.id;
}

async function upload(someone: Client) {
  const form = new FormData();
  form.set("file", new File(["%PDF-1.7 factura"], "factura.pdf", { type: "application/pdf" }));
  const response = await someone.request("/v1/files", { method: "POST", form });
  expect(response.status).toBe(201);
  const { id } = (await response.json()) as { id: string };
  const [row] = await db.select({ key: file.storageKey }).from(file).where(eq(file.id, id));
  return row!.key;
}

const deleteAccount = (someone: Client, password = PASSWORD) =>
  someone.request("/v1/me", { method: "DELETE", body: { password } });

async function join(organizationId: string, someone: Client, role = "member") {
  await db.insert(membership).values({ id: newId(), organizationId, userId: await userIdOf(someone), role });
}

describe("deleting an account", () => {
  it("erases the user and the organizations only they belong to, with their data and files", async () => {
    const ana = await member();
    const second = await addOrganization(ana, "Ana Freelance");
    const anaId = await userIdOf(ana);
    expect((await send(ana, [{ type: "create", entity: "clients", data: client() }])).status).toBe(200);
    const key = await upload(ana);
    const created = await ana.request("/v1/api-keys", { method: "POST", body: { name: "Script" } });
    expect(created.status).toBe(201);

    expect((await deleteAccount(ana)).status).toBe(204);

    expect(await db.select().from(user).where(eq(user.id, anaId))).toEqual([]);
    expect(await db.select().from(session).where(eq(session.userId, anaId))).toEqual([]);
    expect(await db.select().from(account).where(eq(account.userId, anaId))).toEqual([]);
    expect(await db.select().from(apikey).where(eq(apikey.referenceId, anaId))).toEqual([]);
    expect(
      await db
        .select()
        .from(organization)
        .where(inArray(organization.id, [ana.organizationId, second.id])),
    ).toEqual([]);
    expect(await storage.get(key)).toBeNull();
    // The old session no longer works
    expect((await ana.request("/v1/me")).status).toBe(401);
  });

  it("keeps other people's data", async () => {
    const ana = await member();
    const eve = await member("Eve");
    const contact = client();
    await send(eve, [{ type: "create", entity: "clients", data: contact }]);
    const key = await upload(eve);

    expect((await deleteAccount(ana)).status).toBe(204);

    expect((await workspace(eve)).clients.map((row) => row.id)).toEqual([contact.id]);
    expect(await storage.get(key)).not.toBeNull();
  });

  it("leaves organizations shared with others, which keep their data", async () => {
    const ana = await member();
    const eve = await signUp("Eve");
    await join(ana.organizationId, eve, "owner");
    const contact = client();
    await send(ana, [{ type: "create", entity: "clients", data: contact }]);

    expect((await deleteAccount(ana)).status).toBe(204);

    const members = await db.select().from(membership).where(eq(membership.organizationId, ana.organizationId));
    expect(members.map((row) => row.userId)).toEqual([await userIdOf(eve)]);
  });

  it("refuses while the user is the only owner of an organization with other members", async () => {
    const ana = await member();
    await join(ana.organizationId, await signUp("Eve"));

    const response = await deleteAccount(ana);
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe("sole_owner");
    expect((await ana.request("/v1/me")).status).toBe(200);
  });

  it("asks for the right password", async () => {
    const ana = await member();
    const response = await deleteAccount(ana, "not-the-password");
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe("wrong_password");
    expect((await ana.request("/v1/me")).status).toBe(200);
  });

  it("asks users without a password for a recent session instead", async () => {
    const ana = await member();
    const anaId = await userIdOf(ana);
    // Like someone who only signs in with Google
    await db.delete(account).where(eq(account.userId, anaId));
    await db
      .update(session)
      .set({ createdAt: new Date(Date.now() - 11 * 60 * 1000) })
      .where(eq(session.userId, anaId));

    const stale = await ana.request("/v1/me", { method: "DELETE", body: {} });
    expect(stale.status).toBe(403);
    expect(await errorCode(stale)).toBe("session_not_fresh");

    await db.update(session).set({ createdAt: new Date() }).where(eq(session.userId, anaId));
    expect((await ana.request("/v1/me", { method: "DELETE", body: {} })).status).toBe(204);
  });

  it("can't be done with an API key", async () => {
    const ana = await member();
    const created = await ana.request("/v1/api-keys", { method: "POST", body: { name: "Script" } });
    const { key } = (await created.json()) as { key: string };
    expect((await deleteAccount(withApiKey(key))).status).toBe(401);
  });
});

const signIn = (email: string, password: string) =>
  app.request(`${env.BETTER_AUTH_URL}/v1/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: env.BETTER_AUTH_URL },
    body: JSON.stringify({ email, password }),
  });

async function passwordChangedAt(someone: Client) {
  const response = await someone.request("/v1/me");
  return ((await response.json()) as { user: { passwordChangedAt: string | null } }).user.passwordChangedAt;
}

describe("changing the password", () => {
  const change = (someone: Client, currentPassword: string) =>
    someone.request("/v1/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword: "a-new-long-password", revokeOtherSessions: true },
    });

  it("asks for the current password", async () => {
    const ana = await signUp();
    const response = await change(ana, "not-the-password");
    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe("INVALID_PASSWORD");
    expect((await signIn(ana.email, PASSWORD)).status).toBe(200);
  });

  it("replaces the old one, signs out other devices and says when it changed", async () => {
    const ana = await signUp();
    const before = await passwordChangedAt(ana);
    expect(before).not.toBeNull();
    const elsewhere = (await signIn(ana.email, PASSWORD)).headers.getSetCookie().map((c) => c.split(";")[0]);

    expect((await change(ana, PASSWORD)).status).toBe(200);

    expect((await signIn(ana.email, PASSWORD)).status).toBe(401);
    expect((await signIn(ana.email, "a-new-long-password")).status).toBe(200);
    const other = await app.request(`${env.BETTER_AUTH_URL}/v1/me`, { headers: { cookie: elsewhere.join("; ") } });
    expect(other.status).toBe(401);
    // This device stays signed in
    expect(Date.parse((await passwordChangedAt(ana))!)).toBeGreaterThan(Date.parse(before!));
  });

  it("isn't there for users who only sign in with Google", async () => {
    const ana = await signUp();
    await db.delete(account).where(eq(account.userId, await userIdOf(ana)));
    expect(await passwordChangedAt(ana)).toBeNull();
  });
});

describe("the user's own settings", () => {
  const profile = { firstName: "Ana", lastName: "Ruiz Gil", birthDate: "1990-05-02", phone: "600 000 000", gender: "" };
  const me = async (someone: Client) => (await (await someone.request("/v1/me")).json()) as Me;
  const save = (someone: Client, section: string, body: unknown) =>
    someone.request(`/v1/me/settings/${section}`, { method: "PUT", body });

  it("starts the profile from the name given on sign-up", async () => {
    const ana = await signUp("Ana Ruiz");
    const { user, settings } = await me(ana);
    expect(user.email).toBe(ana.email);
    expect(settings).toEqual({
      userProfile: { firstName: "Ana Ruiz", lastName: "", birthDate: "", phone: "", gender: "" },
      userLocale: { language: "", numberFormat: "", timeZone: "" },
      userTour: { status: "pending" },
    });
  });

  it("saves each section for the user alone, and renames them with the profile", async () => {
    const ana = await signUp();
    const eve = await signUp("Eve");
    const locale = { language: "en", numberFormat: "US", timeZone: "Atlantic/Canary" };

    expect((await save(ana, "userProfile", profile)).status).toBe(204);
    expect((await save(ana, "userLocale", locale)).status).toBe(204);
    expect((await save(ana, "userLocale", { ...locale, timeZone: "" })).status).toBe(204);
    expect((await save(ana, "userTour", { status: "skipped" })).status).toBe(204);

    const { user, settings } = await me(ana);
    expect(user.name).toBe("Ana Ruiz Gil");
    expect(settings).toEqual({
      userProfile: profile,
      userLocale: { ...locale, timeZone: "" },
      userTour: { status: "skipped" },
    });
    expect((await me(eve)).settings.userProfile.firstName).toBe("Eve");
    expect((await me(eve)).settings.userTour.status).toBe("pending");
  });

  it("validates the whole section", async () => {
    const ana = await signUp();
    const blank = await save(ana, "userProfile", { ...profile, firstName: "  " });
    expect(blank.status).toBe(400);
    expect(await errorCode(blank)).toBe("invalid_settings");
    expect((await save(ana, "userProfile", { ...profile, birthDate: "02/05/1990" })).status).toBe(400);
    expect((await save(ana, "userLocale", { language: "es" })).status).toBe(400);
    expect((await save(ana, "userTour", { status: "seen" })).status).toBe(400);
    expect((await save(ana, "notificationPrefs", {})).status).toBe(400);
    expect((await me(ana)).user.name).toBe("Ana");
  });

  it("needs a signed-in user", async () => {
    const response = await app.request(`${env.BETTER_AUTH_URL}/v1/me/settings/userLocale`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: "", numberFormat: "", timeZone: "" }),
    });
    expect(response.status).toBe(401);
  });

  it("goes with the account when it is deleted", async () => {
    const ana = await member();
    const anaId = await userIdOf(ana);
    await save(ana, "userProfile", profile);
    expect((await deleteAccount(ana)).status).toBe(204);
    expect(await db.select().from(userSetting).where(eq(userSetting.userId, anaId))).toEqual([]);
  });
});

describe("the organization's members", () => {
  const membersOf = async (someone: Client) => {
    const response = await someone.request("/v1/organization/members");
    expect(response.status).toBe(200);
    return ((await response.json()) as { members: { name: string; email: string; role: string }[] }).members;
  };

  it("lists the people in the active organization, the owner first", async () => {
    const ana = await member();
    const eve = await signUp("Eve");
    await join(ana.organizationId, eve, "admin");
    // Someone else's organization stays out
    await member("Bob");

    const members = await membersOf(ana);
    expect(members.map(({ name, email, role }) => ({ name, email, role }))).toEqual([
      { name: "Ana", email: ana.email, role: "owner" },
      { name: "Eve", email: eve.email, role: "admin" },
    ]);
  });

  it("is only for members", async () => {
    const ana = await signUp();
    expect((await ana.request("/v1/organization/members")).status).toBe(403);
  });
});

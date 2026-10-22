import { newId } from "@cuentalibre/core";
import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { account, apikey, file, membership, organization, session, user } from "./db/schema";
import { createOrganization, db, signUp, storage, withApiKey, type Client } from "./test/harness";
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
    const second = await createOrganization(ana, "Ana Freelance");
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

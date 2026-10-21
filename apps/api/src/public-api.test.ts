import type { ApiKey, CreatedApiKey, SalesDocument } from "@cuentalibre/contracts";
import { newId } from "@cuentalibre/core";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { membership } from "./db/schema";
import { createOrganization, db, withApiKey, type Client } from "./test/harness";
import { client, document, errorCode, member, send } from "./test/sync";

async function createKey(user: Client, body: Record<string, unknown> = { name: "Agente" }) {
  const response = await user.request("/v1/api-keys", { method: "POST", body });
  expect(response.status).toBe(201);
  return (await response.json()) as CreatedApiKey;
}

/** A member with a client, and an API key of theirs. */
async function agent() {
  const ana = await member();
  const norte = client();
  await send(ana, [{ type: "create", entity: "clients", data: norte }]);
  const key = await createKey(ana);
  return { ana, norte, key, api: withApiKey(key.key) };
}

describe("API keys", () => {
  it("act as their user in the organization they were made in", async () => {
    const { ana, key, api } = await agent();
    expect(key.key).toMatch(/^fsk_/);
    expect(key).toMatchObject({ name: "Agente", start: key.key.slice(0, 6), expiresAt: null });

    const me = await api.request("/v1/organization");
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ organization: { id: ana.organizationId }, role: "owner" });

    // Switching the session to another organization doesn't move the key
    await createOrganization(ana, "Otra SL");
    expect(await (await api.request("/v1/organization")).json()).toMatchObject({
      organization: { id: ana.organizationId },
    });
  });

  it("are listed without their secret and can be revoked", async () => {
    const { ana, key, api } = await agent();
    const listed = (await (await ana.request("/v1/api-keys")).json()) as { apiKeys: ApiKey[] };
    const { key: _secret, ...shown } = key;
    expect(listed.apiKeys).toEqual([shown]);

    expect((await ana.request(`/v1/api-keys/${key.id}`, { method: "DELETE" })).status).toBe(204);
    const rejected = await api.request("/v1/organization");
    expect(rejected.status).toBe(401);
    expect(await errorCode(rejected)).toBe("invalid_api_key");
  });

  it("can't manage keys, and stop working when the user leaves the organization", async () => {
    const { ana, api } = await agent();
    expect((await api.request("/v1/api-keys", { method: "POST", body: { name: "Otra" } })).status).toBe(401);
    await db.delete(membership).where(eq(membership.organizationId, ana.organizationId));
    const left = await api.request("/v1/organization");
    expect(left.status).toBe(403);
    expect(await errorCode(left)).toBe("not_a_member");

    const bea = await member("Bea");
    const theirs = await createKey(bea);
    const carla = await member("Carla");
    expect((await carla.request(`/v1/api-keys/${theirs.id}`, { method: "DELETE" })).status).toBe(404);

    expect((await withApiKey("fsk_not-a-real-key").request("/v1/organization")).status).toBe(401);
  });

  it("expire", async () => {
    const ana = await member();
    const key = await createKey(ana, { name: "Corta", expiresInDays: 1 });
    expect(new Date(key.expiresAt!).getTime()).toBeGreaterThan(Date.now() + 86_000_000);
  });
});

describe("public API", () => {
  it("creates a draft, issues it and reads the invoice", async () => {
    const { norte, api } = await agent();
    const { id: _, ...draft } = document(norte.id);
    const created = await api.request("/v1/sales-documents", { method: "POST", body: draft });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as SalesDocument;

    const issued = await api.request(`/v1/sales-documents/${id}/issue`, { method: "POST" });
    expect(issued.status).toBe(201);
    expect(await issued.json()).toMatchObject({
      id,
      kind: "invoice",
      number: "2026-0001",
      issued: { totals: { total: 106000 } },
    });

    const listed = (await (await api.request("/v1/sales-documents?from=2026-10-01&to=2026-10-31")).json()) as {
      data: SalesDocument[];
    };
    expect(listed.data.map((d) => d.number)).toEqual(["2026-0001"]);
    expect((await (await api.request("/v1/sales-documents?from=2026-11-01")).json()) as object).toEqual({ data: [] });

    const changed = await api.request(`/v1/sales-documents/${id}`, { method: "PATCH", body: { publicNotes: "Otra" } });
    expect(changed.status).toBe(409);
    expect(await errorCode(changed)).toBe("invoice_issued");
    expect((await api.request(`/v1/sales-documents/${id}`, { method: "DELETE" })).status).toBe(409);
  });

  it("issues a new invoice directly", async () => {
    const { norte, api } = await agent();
    const { id: _, ...invoice } = document(norte.id, { kind: "invoice" });
    const response = await api.request("/v1/invoices", { method: "POST", body: invoice });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ kind: "invoice", number: "2026-0001" });
  });

  it("keeps expenses to the organization", async () => {
    const { api } = await agent();
    const expense = {
      date: "2026-10-02",
      number: "",
      concept: "Cuota de coworking",
      amount: 15000,
      expenseType: "621",
      imputation: 100,
      supplierId: null,
      payment: null,
      rental: false,
      privateNotes: "",
    };
    const created = await api.request("/v1/expenses", { method: "POST", body: expense });
    expect(created.status, await created.clone().text()).toBe(201);
    const { id } = (await created.json()) as { id: string };
    expect((await api.request(`/v1/expenses/${id}`)).status).toBe(200);

    const other = await agent();
    expect((await other.api.request(`/v1/expenses/${id}`)).status).toBe(404);
    expect((await other.api.request(`/v1/expenses/${id}`, { method: "DELETE" })).status).toBe(404);

    const updated = await api.request(`/v1/expenses/${id}`, { method: "PATCH", body: { concept: "Coworking" } });
    expect(await updated.json()).toMatchObject({ id, concept: "Coworking" });
    expect((await api.request(`/v1/expenses/${id}`, { method: "DELETE" })).status).toBe(204);
    expect((await api.request(`/v1/expenses/${id}`)).status).toBe(404);
    expect((await api.request(`/v1/purchase-invoices/${newId()}`)).status).toBe(404);
  });

  it("describes itself with OpenAPI, keys as bearer auth", async () => {
    const { api } = await agent();
    const doc = (await (await api.request("/v1/openapi.json")).json()) as {
      paths: Record<string, unknown>;
      components: { securitySchemes: Record<string, unknown> };
    };
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(["/v1/invoices", "/v1/sales-documents/{id}/issue", "/v1/expenses/{id}", "/v1/api-keys"]),
    );
    expect(doc.components.securitySchemes.apiKey).toMatchObject({ type: "http", scheme: "bearer" });
  });
});

import { newId } from "@cuentalibre/core";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { changeLog } from "./db/schema";
import { db, signUp } from "./test/harness";
import { changes, client, EMPTY, errorCode, member, send, workspace } from "./test/sync";

describe("sync", () => {
  it("starts with an empty workspace", async () => {
    const ana = await member();
    expect(await workspace(ana)).toEqual(EMPTY);
  });

  it("applies commands and returns the authoritative records", async () => {
    const ana = await member();
    const norte = client({ email: "facturas@estudionorte.es", discount: 5, tags: ["Recurrente"] });
    const response = await send(ana, [{ type: "create", entity: "clients", data: norte }]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ changes: [{ op: "upsert", entity: "clients", data: norte }] });

    const after = await workspace(ana);
    expect(after.clients).toEqual([norte]);
    expect(after.suppliers).toEqual([]);
    expect(after.cursor).toBeGreaterThan(0);
  });

  it("merges updates and clears fields sent as null", async () => {
    const ana = await member();
    const norte = client({ email: "a@norte.es", notes: "Old" });
    await send(ana, [{ type: "create", entity: "clients", data: norte }]);
    const response = await send(ana, [
      { type: "update", entity: "clients", id: norte.id, changes: { city: "Bilbao", notes: null } },
    ]);
    expect(response.status).toBe(200);
    expect((await workspace(ana)).clients).toEqual([
      { id: norte.id, name: norte.name, taxId: norte.taxId, email: "a@norte.es", city: "Bilbao" },
    ]);
  });

  it("validates the record that results from an update", async () => {
    const ana = await member();
    const norte = client();
    await send(ana, [{ type: "create", entity: "clients", data: norte }]);
    const response = await send(ana, [{ type: "update", entity: "clients", id: norte.id, changes: { name: "" } }]);
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_contact");
    expect((await workspace(ana)).clients).toEqual([norte]);
  });

  it("saves all the commands of a call or none", async () => {
    const ana = await member();
    const response = await send(ana, [
      { type: "create", entity: "clients", data: client() },
      { type: "update", entity: "clients", id: newId(), changes: { city: "Bilbao" } },
    ]);
    expect(response.status).toBe(404);
    expect(await workspace(ana)).toEqual(EMPTY);
    expect(await db.select().from(changeLog).where(eq(changeLog.organizationId, ana.organizationId))).toEqual([]);
  });

  it("rejects reusing an ID", async () => {
    const ana = await member();
    const norte = client();
    await send(ana, [{ type: "create", entity: "clients", data: norte }]);
    const response = await send(ana, [{ type: "create", entity: "suppliers", data: norte }]);
    expect(response.status).toBe(409);
  });

  it("keeps clients and suppliers apart", async () => {
    const ana = await member();
    const norte = client();
    await send(ana, [{ type: "create", entity: "clients", data: norte }]);
    const response = await send(ana, [{ type: "delete", entity: "suppliers", id: norte.id }]);
    expect(response.status).toBe(404);
  });

  it("rejects malformed commands", async () => {
    const ana = await member();
    const response = await send(ana, [{ type: "create", entity: "clients", data: client({ id: "c1" }) }]);
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_request");
  });

  it("names the field that is wrong, not every kind of command", async () => {
    const ana = await member();
    const response = await send(ana, [{ type: "closeQuarter", period: "2026-T3" } as never]);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_request",
        message: "commands.0.closedOn: Invalid input: expected string, received undefined",
      },
    });

    const unknown = await send(ana, [{ type: "create", entity: "invoices", data: {} } as never]);
    expect(((await unknown.json()) as { error: { message: string } }).error.message).toMatch(/^commands\.0\.entity: /);
  });

  it("feeds changes after a cursor, once per record with its latest state", async () => {
    const ana = await member();
    const norte = client();
    const brisa = client({ name: "Agencia Brisa S.L." });
    await send(ana, [{ type: "create", entity: "clients", data: norte }]);
    const { cursor } = await workspace(ana);

    await send(ana, [
      { type: "create", entity: "suppliers", data: brisa },
      { type: "update", entity: "clients", id: norte.id, changes: { city: "Bilbao" } },
    ]);
    await send(ana, [{ type: "update", entity: "clients", id: norte.id, changes: { city: "Getxo" } }]);
    await send(ana, [{ type: "delete", entity: "suppliers", id: brisa.id }]);

    const feed = await changes(ana, cursor);
    expect(feed.hasMore).toBe(false);
    expect(feed.changes).toEqual([
      { op: "delete", entity: "suppliers", id: brisa.id },
      { op: "upsert", entity: "clients", data: { ...norte, city: "Getxo" } },
    ]);
    expect(feed.cursor).toBe(cursor + 4);
    expect(await changes(ana, feed.cursor)).toEqual({ cursor: feed.cursor, changes: [], hasMore: false });
  });

  it("pages the feed", async () => {
    const ana = await member();
    const records = [client(), client(), client()];
    await send(
      ana,
      records.map((data) => ({ type: "create", entity: "clients", data }) as const),
    );

    const first = await changes(ana, 0, 2);
    expect(first.changes.map((change) => change.op === "upsert" && "id" in change.data && change.data.id)).toEqual([
      records[0]!.id,
      records[1]!.id,
    ]);
    expect(first.hasMore).toBe(true);
    const second = await changes(ana, first.cursor, 2);
    expect(second.changes.map((change) => change.op === "upsert" && "id" in change.data && change.data.id)).toEqual([
      records[2]!.id,
    ]);
    expect(second.hasMore).toBe(false);
  });

  it("isolates organizations", async () => {
    const ana = await member("Ana");
    const luis = await member("Luis");
    const norte = client();
    await send(ana, [{ type: "create", entity: "clients", data: norte }]);

    expect(await workspace(luis)).toEqual(EMPTY);
    expect((await changes(luis, 0)).changes).toEqual([]);
    expect(
      (await send(luis, [{ type: "update", entity: "clients", id: norte.id, changes: { name: "Mine" } }])).status,
    ).toBe(404);
    expect((await send(luis, [{ type: "delete", entity: "clients", id: norte.id }])).status).toBe(404);
    expect((await luis.request(`/v1/contacts/${norte.id}`)).status).toBe(404);
    expect((await workspace(ana)).clients).toEqual([norte]);
  });

  it("needs an active organization", async () => {
    const ana = await signUp();
    expect((await ana.request("/v1/workspace")).status).toBe(403);
    expect((await send(ana, [{ type: "create", entity: "clients", data: client() }])).status).toBe(403);
  });
});

describe("contacts", () => {
  it("creates, lists, updates and deletes", async () => {
    const ana = await member();
    const created = await ana.request("/v1/contacts", {
      method: "POST",
      body: { role: "supplier", name: "Papelería Sol", taxId: "B11111119" },
    });
    expect(created.status).toBe(201);
    const sol = (await created.json()) as { id: string };
    expect(sol).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      role: "supplier",
      name: "Papelería Sol",
      taxId: "B11111119",
    });

    const listed = await ana.request("/v1/contacts?role=supplier");
    expect(await listed.json()).toEqual({ contacts: [sol] });
    expect(await (await ana.request("/v1/contacts?role=client")).json()).toEqual({ contacts: [] });

    const updated = await ana.request(`/v1/contacts/${sol.id}`, { method: "PATCH", body: { city: "Sevilla" } });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toEqual({ ...sol, city: "Sevilla" });

    const moved = await ana.request(`/v1/contacts/${sol.id}`, { method: "PATCH", body: { role: "client" } });
    expect(moved.status).toBe(400);

    expect((await ana.request(`/v1/contacts/${sol.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await ana.request(`/v1/contacts/${sol.id}`)).status).toBe(404);
    expect((await workspace(ana)).suppliers).toEqual([]);
  });

  it("accepts a repeated tax ID and finds contacts by it", async () => {
    const ana = await member();
    const create = (name: string, taxId: string, variousClients?: boolean) =>
      ana.request("/v1/contacts", { method: "POST", body: { role: "client", name, taxId, variousClients } });
    expect((await create("Norte SL", "B12345674")).status).toBe(201);
    expect((await create("Norte SL (Bilbao)", "ES-B12.345.674")).status).toBe(201);
    expect((await create("Clientes varios", "", true)).status).toBe(201);

    const names = async (query: string) =>
      ((await (await ana.request(`/v1/contacts?${query}`)).json()) as { contacts: { name: string }[] }).contacts
        .map((c) => c.name)
        .sort();
    expect(await names("taxId=b12345674")).toEqual(["Norte SL", "Norte SL (Bilbao)"]);
    expect(await names("role=supplier&taxId=B12345674")).toEqual([]);
    expect(await names("taxId=")).toEqual([]);
  });

  it("needs a valid tax ID for the contact's country", async () => {
    const ana = await member();
    const create = (body: Record<string, unknown>) =>
      ana.request("/v1/contacts", { method: "POST", body: { role: "client", name: "Norte SL", ...body } });
    const rejected = async (body: Record<string, unknown>) => {
      const response = await create(body);
      expect(response.status).toBe(400);
      return ((await response.json()) as { error: { code: string; message: string } }).error;
    };

    expect(await rejected({ taxId: "" })).toEqual({ code: "invalid_tax_id", message: "taxId: required." });
    expect((await rejected({ taxId: "hola" })).code).toBe("invalid_tax_id");
    expect((await rejected({ taxId: "B12345675" })).message).toBe("taxId: the control character is wrong.");
    expect((await rejected({ taxId: "DE#123", country: "Alemania" })).code).toBe("invalid_tax_id");

    const foreign = await create({ taxId: "fr 40 303 265 045", country: "Francia" });
    expect(foreign.status).toBe(201);
    expect(await foreign.json()).toMatchObject({ taxId: "FR40303265045", country: "Francia" });

    const created = await create({ taxId: "b-12.345.674" });
    expect(created.status).toBe(201);
    const norte = (await created.json()) as { id: string; taxId: string };
    expect(norte.taxId).toBe("B12345674");

    const patch = (body: Record<string, unknown>) => ana.request(`/v1/contacts/${norte.id}`, { method: "PATCH", body });
    expect(await errorCode(await patch({ taxId: "B12345675" }))).toBe("invalid_tax_id");
    // Moving to the UK keeps the NIF, which is still letters and digits; a stray symbol isn't
    expect((await patch({ country: "Reino Unido" })).status).toBe(200);
    expect(await errorCode(await patch({ taxId: "GB 123/456*" }))).toBe("invalid_tax_id");
  });

  it('lets only the "Clientes varios" client go without a tax ID', async () => {
    const ana = await member();
    const various = client({ name: "Clientes varios", taxId: "", variousClients: true });
    expect((await send(ana, [{ type: "create", entity: "clients", data: various }])).status).toBe(200);
    const saved = await ana.request(`/v1/contacts/${various.id}`, { method: "PATCH", body: { city: "Sevilla" } });
    expect(saved.status).toBe(200);

    // A tax ID it does have must still be valid, and dropping the mark makes it required
    const patch = (body: Record<string, unknown>) =>
      ana.request(`/v1/contacts/${various.id}`, { method: "PATCH", body });
    expect(await errorCode(await patch({ taxId: "hola" }))).toBe("invalid_tax_id");
    expect(await errorCode(await patch({ variousClients: null }))).toBe("invalid_tax_id");

    const supplier = await send(ana, [
      { type: "create", entity: "suppliers", data: client({ taxId: "", variousClients: true }) },
    ]);
    expect(supplier.status).toBe(400);
    expect(await errorCode(supplier)).toBe("invalid_contact");
  });

  it("documents the routes", async () => {
    const ana = await member();
    const doc = (await (await ana.request("/v1/openapi.json")).json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(["/v1/workspace", "/v1/sync", "/v1/commands", "/v1/contacts", "/v1/contacts/{id}"]),
    );
  });
});

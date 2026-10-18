import type { Contact } from "@fiscalia/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { createApiBackend, ApiError } from "./api";
import { localBackend, setBackend } from "./backend";
import { createCollection } from "./collection";
import { syncCollection } from "./sync";

const norte: Contact = { id: "0199f0a0-0000-7000-8000-000000000001", name: "Estudio Norte S.L.", taxId: "B12345674" };
const brisa: Contact = { id: "0199f0a0-0000-7000-8000-000000000002", name: "Agencia Brisa S.L.", taxId: "B87654323" };

interface Call {
  url: string;
  method: string;
  body: unknown;
}

/** A fetch that records the requests and answers each one with the next response. */
function fakeFetch(...responses: { status?: number; body: unknown }[]) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body as string) : undefined });
    const next = responses.shift();
    if (!next) throw new Error(`Unexpected request to ${url}`);
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function setup(...responses: { status?: number; body: unknown }[]) {
  const clients = createCollection<Contact>("clients", []);
  const suppliers = createCollection<Contact>("suppliers", []);
  syncCollection("clients", clients);
  syncCollection("suppliers", suppliers);
  const { calls, fetchImpl } = fakeFetch(...responses);
  const api = createApiBackend("http://api", fetchImpl);
  setBackend(api);
  return { api, calls, clients, suppliers };
}

afterEach(() => setBackend(localBackend));

describe("api backend", () => {
  it("replaces the synced collections with the workspace, then follows the feed from its cursor", async () => {
    const { api, calls, clients, suppliers } = setup(
      { body: { cursor: 7, clients: [norte], suppliers: [brisa] } },
      { body: { cursor: 9, changes: [{ op: "delete", entity: "clients", id: norte.id }], hasMore: true } },
      {
        body: {
          cursor: 10,
          changes: [{ op: "upsert", entity: "suppliers", data: { ...brisa, city: "Valencia" } }],
          hasMore: false,
        },
      },
    );
    await api.loadWorkspace();
    expect(clients.all()).toEqual([norte]);
    expect(suppliers.all()).toEqual([brisa]);

    await api.pull();
    expect(calls.map((call) => call.url)).toEqual([
      "http://api/v1/workspace",
      "http://api/v1/sync?since=7",
      "http://api/v1/sync?since=9",
    ]);
    expect(clients.all()).toEqual([]);
    expect(suppliers.all()).toEqual([{ ...brisa, city: "Valencia" }]);
  });

  it("sends synced commands and takes the server's version of the records", async () => {
    const { calls, clients } = setup({
      body: { changes: [{ op: "upsert", entity: "clients", data: { ...norte, country: "España" } }] },
    });
    await clients.add(norte);
    expect(calls).toEqual([
      {
        url: "http://api/v1/commands",
        method: "POST",
        body: { commands: [{ type: "create", entity: "clients", data: norte }] },
      },
    ]);
    expect(clients.all()).toEqual([{ ...norte, country: "España" }]);
  });

  it("sends cleared fields as null", async () => {
    const { calls, clients } = setup({ body: { changes: [] } }, { body: { changes: [] } });
    clients.replace([{ ...norte, notes: "Old" }]);
    await clients.update(norte.id, { notes: undefined });
    expect(calls[0]!.body).toEqual({
      commands: [{ type: "update", entity: "clients", id: norte.id, changes: { notes: null } }],
    });
  });

  it("keeps commands for collections the server doesn't store yet local", async () => {
    const { calls } = setup();
    const tags = createCollection<{ id: string; name: string }>("tags", []);
    await tags.add({ id: "t1", name: "Recurrente" });
    expect(calls).toEqual([]);
    expect(tags.all()).toEqual([{ id: "t1", name: "Recurrente" }]);
  });

  it("undoes a change the server rejects", async () => {
    const { clients } = setup({ status: 409, body: { error: { code: "already_exists", message: "Taken." } } });
    await clients.add(norte);
    expect(clients.all()).toEqual([]);
  });

  it("reports API errors with their code", async () => {
    const { api } = setup({ status: 401, body: { error: { code: "unauthorized", message: "Sign in to continue." } } });
    await expect(api.loadWorkspace()).rejects.toEqual(new ApiError(401, "unauthorized", "Sign in to continue."));
  });
});

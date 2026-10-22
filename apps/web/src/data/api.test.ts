import {
  DEFAULT_ORGANIZATION_SETTINGS,
  type ClosedQuarter,
  type Contact,
  type FiledReturn,
  type Me,
  type SalesDocument,
  type Tag,
} from "@cuentalibre/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { createApiBackend, ApiError } from "./api";
import { localBackend, setBackend } from "./backend";
import { createCollection } from "./collection";
import { attachFile, attachmentUrl } from "./files";
import { createStore } from "./store";
import { listTarget, syncCollection, syncMe, syncSettings, syncTarget } from "./sync";

const norte: Contact = { id: "0199f0a0-0000-7000-8000-000000000001", name: "Estudio Norte S.L.", taxId: "B12345674" };
const brisa: Contact = { id: "0199f0a0-0000-7000-8000-000000000002", name: "Agencia Brisa S.L.", taxId: "B87654323" };

const invoice: SalesDocument = {
  id: "0199f0a0-0000-7000-8000-000000000003",
  kind: "invoice",
  number: "2026-0047",
  series: "normal",
  clientId: norte.id,
  issuedOn: "2026-10-18",
  dueOn: null,
  incomeType: "705",
  withholding: "none",
  operationType: "national",
  operationOn: null,
  cashBasis: false,
  rental: false,
  lines: [{ id: "l1", concept: "Diseño", unitPrice: 100, quantity: 1, discount: 0, vatRate: 0.21 }],
  status: "pending",
  publicNotes: "",
  privateNotes: "",
};

interface Call {
  url: string;
  method: string;
  body: unknown;
}

/** A fetch that records the requests and answers each one with the next response. */
function fakeFetch(...responses: { status?: number; body: unknown }[]) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    calls.push({ url, method: init.method ?? "GET", body });
    const next = responses.shift();
    if (!next) throw new Error(`Unexpected request to ${url}`);
    // A 204 can't have a body
    return new Response(next.status === 204 ? null : JSON.stringify(next.body), { status: next.status ?? 200 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function setup(...responses: { status?: number; body: unknown }[]) {
  const clients = createCollection<Contact>("clients", []);
  const suppliers = createCollection<Contact>("suppliers", []);
  const salesDocuments = createCollection<SalesDocument>("salesDocuments", []);
  syncCollection("clients", clients);
  syncCollection("suppliers", suppliers);
  syncCollection("salesDocuments", salesDocuments);
  const { calls, fetchImpl } = fakeFetch(...responses);
  const api = createApiBackend("http://api", fetchImpl);
  setBackend(api);
  return { api, calls, clients, suppliers, salesDocuments };
}

afterEach(() => setBackend(localBackend));

describe("api backend", () => {
  it("replaces the synced collections with the workspace, then follows the feed from its cursor", async () => {
    const { api, calls, clients, suppliers } = setup(
      { body: { cursor: 7, clients: [norte], suppliers: [brisa], salesDocuments: [], closedQuarters: [] } },
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

  it("issues invoices and takes the number the server gives them", async () => {
    const { calls, salesDocuments } = setup({
      body: { changes: [{ op: "upsert", entity: "salesDocuments", data: { ...invoice, number: "2026-0048" } }] },
    });
    const issued = salesDocuments.write(invoice, [{ type: "issue", data: invoice }]);
    expect(salesDocuments.all()).toEqual([invoice]);
    await issued;
    expect(calls[0]!.body).toEqual({ commands: [{ type: "issue", data: invoice }] });
    expect(salesDocuments.all()).toEqual([{ ...invoice, number: "2026-0048" }]);
  });

  it("sends closing and reopening quarters once the server stores them", async () => {
    const { calls } = setup({ body: { changes: [] } });
    const quarters = createStore<ClosedQuarter[]>([]);
    syncTarget<ClosedQuarter>("closedQuarters", {
      receive: (quarter) => quarters.set([quarter]),
      forget: () => quarters.set([]),
      replace: quarters.set,
    });
    await quarters.write(
      [],
      [
        { type: "closeQuarter", period: "2026-T3", closedOn: "2026-10-15" },
        { type: "saveSettings", section: "emailSettings", data: {} },
      ],
    );
    expect(calls[0]!.body).toEqual({
      commands: [{ type: "closeQuarter", period: "2026-T3", closedOn: "2026-10-15" }],
    });
  });

  it("saves the organization's settings and takes the server's version of a section", async () => {
    const { api, calls } = setup(
      { body: { changes: [] } },
      {
        body: {
          cursor: 1,
          clients: [],
          suppliers: [],
          salesDocuments: [],
          settings: {
            ...DEFAULT_ORGANIZATION_SETTINGS,
            signing: { invoice: "company", quote: "none", deliveryNote: "none" },
          },
        },
      },
    );
    const signing = createStore(DEFAULT_ORGANIZATION_SETTINGS.signing);
    syncSettings("signing", signing.set);
    const data = { invoice: "none", quote: "company", deliveryNote: "none" } as const;
    await signing.write(data, [
      { type: "saveSettings", section: "signing", data },
      // Not stored by the server yet
      { type: "saveSettings", section: "emailSettings", data: {} },
    ]);
    expect(calls[0]!.body).toEqual({ commands: [{ type: "saveSettings", section: "signing", data }] });

    await api.loadWorkspace();
    expect(signing.get()).toEqual({ invoice: "company", quote: "none", deliveryNote: "none" });
  });

  it("saves the user's own settings apart from the organization's, and takes them from the account", async () => {
    const { api, calls } = setup(
      { status: 204, body: null },
      {
        body: {
          user: { id: "0199f0a0-0000-7000-8000-000000000020", name: "Ana", email: "ana@example.com" },
          settings: { userProfile: { firstName: "Ana" }, userLocale: { language: "en" } },
        },
      },
    );
    const locale = createStore({ language: "", numberFormat: "", timeZone: "" });
    const seen: Me[] = [];
    syncMe((me) => seen.push(me));
    const data = { language: "en", numberFormat: "US", timeZone: "" };
    await locale.write(data, [{ type: "saveSettings", section: "userLocale", data }]);
    expect(calls).toEqual([{ url: "http://api/v1/me/settings/userLocale", method: "PUT", body: data }]);

    await api.loadMe();
    expect(seen.map((me) => me.settings.userLocale.language)).toEqual(["en"]);
  });

  it("keeps lists inside bigger stores in step with the server", async () => {
    const recurring: Tag = { id: "0199f0a0-0000-7000-8000-000000000010", name: "Recurrente", color: "#1d4ed8" };
    const urgent: Tag = { id: "0199f0a0-0000-7000-8000-000000000011", name: "Urgente", color: "#b91c1c" };
    const { api } = setup({
      body: {
        cursor: 1,
        changes: [
          { op: "upsert", entity: "tags", data: { ...recurring, color: "#15803d" } },
          { op: "upsert", entity: "tags", data: urgent },
          { op: "delete", entity: "tags", id: recurring.id },
        ],
        hasMore: false,
      },
    });
    const state = createStore({ tags: [recurring], other: 1 });
    syncTarget(
      "tags",
      listTarget(
        () => state.get().tags,
        (tags) => state.set({ ...state.get(), tags }),
      ),
    );
    await api.pull();
    expect(state.get()).toEqual({ tags: [urgent], other: 1 });
  });

  it("files the quarter's returns when closing it", async () => {
    const { calls } = setup({ body: { changes: [] } });
    const quarters = createStore<ClosedQuarter[]>([]);
    syncTarget<ClosedQuarter>("closedQuarters", {
      receive: (quarter) => quarters.set([quarter]),
      forget: () => quarters.set([]),
      replace: quarters.set,
    });
    const returns = [
      {
        id: "0199f0a0-0000-7000-8000-000000000020",
        form: "303" as const,
        period: "2026-T3",
        boxes: { "71": 21000 },
        result: 21000 as FiledReturn["result"],
        filedOn: "2026-10-15",
      },
    ];
    await quarters.write([], [{ type: "closeQuarter", period: "2026-T3", closedOn: "2026-10-15", returns }]);
    expect(calls[0]!.body).toEqual({
      commands: [{ type: "closeQuarter", period: "2026-T3", closedOn: "2026-10-15", returns }],
    });
  });

  it("sends one request at a time, in order", async () => {
    const { calls, clients } = setup({ body: { changes: [] } }, { body: { changes: [] } });
    const first = clients.add(norte);
    const second = clients.add(brisa);
    // The second request waits for the answer to the first
    expect(calls).toHaveLength(0);
    await first;
    await second;
    expect(calls.map((call) => (call.body as { commands: { data: Contact }[] }).commands[0]!.data.id)).toEqual([
      norte.id,
      brisa.id,
    ]);
  });

  it("uploads attached files and sends the record that names them once they are stored", async () => {
    const { calls, clients } = setup({ status: 201, body: {} }, { body: { changes: [] } });
    URL.createObjectURL = () => "blob:local";
    const attachment = attachFile(new File(["%PDF"], "contrato.pdf", { type: "application/pdf" }));
    expect(attachment).toMatchObject({ name: "contrato.pdf", size: 4, url: "blob:local" });
    await clients.add({ ...norte, attachments: [attachment] });

    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ["POST", "http://api/v1/files"],
      ["POST", "http://api/v1/commands"],
    ]);
    expect(attachmentUrl({ ...attachment, url: undefined })).toBe(`http://api/v1/files/${attachment.id}`);
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

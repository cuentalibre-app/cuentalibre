import {
  DEFAULT_ORGANIZATION_SETTINGS,
  type ClosedQuarter,
  type Contact,
  type ContactSettings,
  type FiledReturn,
  type Me,
  type SalesDocument,
  type Tag,
} from "@cuentalibre/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BACKGROUND_HEADER, createApiBackend, ApiError, type ApiBackendOptions } from "./api";
import { localBackend, onCommandError, setBackend } from "./backend";
import { createCollection } from "./collection";
import { attachFile, attachmentUrl, discardAttachments } from "./files";
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

type FakeResponse = { status?: number; body: unknown };

function setup(...responses: FakeResponse[]) {
  return setupWith({}, ...responses);
}

function setupWith(options: Omit<ApiBackendOptions, "fetch">, ...responses: FakeResponse[]) {
  const clients = createCollection<Contact>("clients", []);
  const suppliers = createCollection<Contact>("suppliers", []);
  const salesDocuments = createCollection<SalesDocument>("salesDocuments", []);
  syncCollection("clients", clients);
  syncCollection("suppliers", suppliers);
  syncCollection("salesDocuments", salesDocuments);
  const { calls, fetchImpl } = fakeFetch(...responses);
  const api = createApiBackend("http://api", { ...options, fetch: fetchImpl });
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
        { type: "saveSettings", section: "notificationPrefs", data: {} },
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
            contactSettings: { customFieldNames: ["Sector", ""] },
          },
        },
      },
    );
    const contacts = createStore(DEFAULT_ORGANIZATION_SETTINGS.contactSettings);
    syncSettings("contactSettings", contacts.set);
    const data: ContactSettings = { customFieldNames: ["Zona", ""] };
    await contacts.write(data, [
      { type: "saveSettings", section: "contactSettings", data },
      // Not stored by the server yet
      { type: "saveSettings", section: "notificationPrefs", data: {} },
    ]);
    expect(calls[0]!.body).toEqual({ commands: [{ type: "saveSettings", section: "contactSettings", data }] });

    await api.loadWorkspace();
    expect(contacts.get()).toEqual({ customFieldNames: ["Sector", ""] });
  });

  it("saves the user's own settings apart from the organization's, and takes them from the account", async () => {
    const { api, calls } = setup(
      { status: 204, body: null },
      {
        body: {
          user: { id: "0199f0a0-0000-7000-8000-000000000020", name: "Ana", email: "ana@example.com" },
          settings: { userProfile: { firstName: "Ana" }, userTour: { status: "skipped" } },
        },
      },
    );
    const tour = createStore({ status: "pending" });
    const seen: Me[] = [];
    syncMe((me) => seen.push(me));
    const data = { status: "finished" };
    await tour.write(data, [{ type: "saveSettings", section: "userTour", data }]);
    expect(calls).toEqual([{ url: "http://api/v1/me/settings/userTour", method: "PUT", body: data }]);

    await api.loadMe();
    expect(seen.map((me) => me.settings.userTour.status)).toEqual(["skipped"]);
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

  it("uploads attached files when the record that names them is saved, then shows the stored copy", async () => {
    const { calls, clients } = setup({ status: 201, body: {} }, { body: { changes: [] } }, { body: { changes: [] } });
    URL.createObjectURL = () => "blob:local";
    const revoked = vi.fn();
    URL.revokeObjectURL = revoked;
    const attachment = attachFile(new File(["%PDF"], "contrato.pdf", { type: "application/pdf" }));
    expect(attachment).toMatchObject({ name: "contrato.pdf", size: 4, url: "blob:local" });
    // Picking it uploads nothing yet
    expect(calls).toEqual([]);
    await clients.add({ ...norte, attachments: [attachment] });
    expect(revoked).toHaveBeenCalledWith("blob:local");
    // A later change naming it doesn't send it again
    await clients.update(norte.id, { name: "Norte" });

    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ["POST", "http://api/v1/files"],
      ["POST", "http://api/v1/commands"],
      ["POST", "http://api/v1/commands"],
    ]);
    expect(attachmentUrl({ ...attachment, url: undefined })).toBe(`http://api/v1/files/${attachment.id}`);
  });

  it("uploads nothing for a file left out before saving, and lets it go", async () => {
    const { calls, clients } = setup({ body: { changes: [] } });
    URL.createObjectURL = () => "blob:cancelled";
    const revoked = vi.fn();
    URL.revokeObjectURL = revoked;
    const attachment = attachFile(new File(["%PDF"], "contrato.pdf", { type: "application/pdf" }));
    // The form is cancelled, or the attachment removed
    discardAttachments([attachment]);
    expect(revoked).toHaveBeenCalledWith("blob:cancelled");

    // Gone for good: even a record that still named it couldn't send it
    await clients.add({ ...norte, attachments: [attachment] });
    expect(calls.map((call) => call.url)).toEqual(["http://api/v1/commands"]);
  });

  it("keeps a file a sent command named until it is answered, even if its form goes away", async () => {
    const { calls, clients } = setup({ status: 201, body: {} }, { body: { changes: [] } });
    URL.createObjectURL = () => "blob:saved";
    const attachment = attachFile(new File(["%PDF"], "contrato.pdf", { type: "application/pdf" }));
    const saved = clients.add({ ...norte, attachments: [attachment] });
    // The form navigates away at once
    discardAttachments([attachment]);
    await saved;
    expect(calls.map((call) => call.url)).toEqual(["http://api/v1/files", "http://api/v1/commands"]);
  });

  it("fails the record that names a file whose upload failed, with the upload's reason", async () => {
    const { calls, clients } = setup(
      { status: 413, body: { error: { code: "storage_quota_exceeded", message: "Full." } } },
      { status: 201, body: {} },
      { body: { changes: [] } },
    );
    URL.createObjectURL = () => "blob:local";
    const errors: unknown[] = [];
    const stop = onCommandError((error) => errors.push(error));
    const attachment = attachFile(new File(["%PDF"], "contrato.pdf", { type: "application/pdf" }));
    await clients.add({ ...norte, attachments: [attachment] });
    stop();

    expect(calls.map((call) => call.url)).toEqual(["http://api/v1/files"]);
    expect(clients.all()).toEqual([]);
    expect(errors).toEqual([new ApiError(413, "storage_quota_exceeded", "Full.")]);

    // Saving again tries the upload again
    await clients.add({ ...norte, attachments: [attachment] });
    expect(calls.map((call) => call.url)).toEqual([
      "http://api/v1/files",
      "http://api/v1/files",
      "http://api/v1/commands",
    ]);
  });

  it("undoes a change the server rejects", async () => {
    const { clients } = setup({ status: 409, body: { error: { code: "already_exists", message: "Taken." } } });
    await clients.add(norte);
    expect(clients.all()).toEqual([]);
  });

  it("sends the user to sign in when the session ends, without reporting the change as rejected", async () => {
    const me = { user: { id: "0199f0a0-0000-7000-8000-000000000020", name: "Ana", email: "ana@example.com" } };
    const expired = vi.fn();
    const { api, clients } = setupWith(
      { onSessionExpired: expired },
      { body: me },
      { status: 401, body: { error: { code: "unauthorized", message: "Sign in to continue." } } },
    );
    await api.loadMe();
    const errors: unknown[] = [];
    const stop = onCommandError((error) => errors.push(error));

    void clients.add(norte);
    await vi.waitFor(() => expect(expired).toHaveBeenCalledOnce());
    stop();
    expect(errors).toEqual([]);
  });

  it("marks the pulls made in the background, which don't keep the session alive", async () => {
    const page = { body: { cursor: 1, changes: [], hasMore: false } };
    const requests: Headers[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit = {}) => {
      requests.push(new Headers(init.headers));
      return new Response(JSON.stringify(page.body));
    }) as typeof fetch;
    const api = createApiBackend("http://api", { fetch: fetchImpl });
    await api.pull({ background: true });
    await api.pull();
    expect(requests.map((headers) => headers.get(BACKGROUND_HEADER))).toEqual(["1", null]);
  });

  it("fails with a 401 before anyone is signed in", async () => {
    const expired = vi.fn(() => Promise.resolve());
    const { api } = setupWith(
      { onSessionExpired: expired },
      { status: 401, body: { error: { code: "unauthorized", message: "Sign in to continue." } } },
    );
    await expect(api.loadMe()).rejects.toEqual(new ApiError(401, "unauthorized", "Sign in to continue."));
    expect(expired).not.toHaveBeenCalled();
  });

  it("reports API errors with their code", async () => {
    const { api } = setup({ status: 401, body: { error: { code: "unauthorized", message: "Sign in to continue." } } });
    await expect(api.loadWorkspace()).rejects.toEqual(new ApiError(401, "unauthorized", "Sign in to continue."));
  });
});

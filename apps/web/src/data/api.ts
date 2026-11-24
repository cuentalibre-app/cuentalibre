import {
  userSettingsSectionSchema,
  type ApiKey,
  type Billing,
  type BillingInvoice,
  type Change,
  type Changes,
  type CreatedApiKey,
  type EmailMessage,
  type EmailSender,
  type FileListing,
  type Me,
  type OrganizationMember,
  type ExtractionUsage,
  type PurchaseExtraction,
  type StoredFile,
  type SyncCommand,
  type UserSettingsSection,
  type Workspace,
} from "@cuentalibre/contracts";
import { setBackend, type Backend } from "./backend";
import { settleFiles, takeFiles } from "./files";
import type { Command } from "./commands";
import { applyChanges, applyMe, applyWorkspace, isSettingsSynced, isSynced } from "./sync";

/** An error the API answered with. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function errorOf(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
  return new ApiError(response.status, body?.error?.code ?? "http_error", body?.error?.message ?? response.statusText);
}

/** The server-sent events in a response body, as they arrive. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop()!;
    for (const block of blocks) {
      const event = /^event: (.*)$/m.exec(block)?.[1] ?? "message";
      const data = /^data: (.*)$/m.exec(block)?.[1] ?? "";
      yield { event, data };
    }
  }
}

export interface ApiBackend extends Backend {
  /** Downloads the workspace and replaces the synced collections with it. */
  loadWorkspace: () => Promise<void>;
  /** Downloads the signed-in user's account and own settings. */
  loadMe: () => Promise<void>;
  /**
   * Applies what changed on the server since the last download or pull. In the `background`,
   * when the user did nothing, it doesn't keep their session alive.
   */
  pull: (options?: { background?: boolean }) => Promise<void>;
}

export interface ApiBackendOptions {
  fetch?: typeof fetch;
  /**
   * Called when the session ends while the app runs on it, to send the user to sign in again.
   * The request that found out never settles, so nothing reports an error on the way out.
   * Without it, requests fail with a 401.
   */
  onSessionExpired?: () => void;
}

/**
 * The backend that talks to the API. Commands for data the server stores are
 * sent in one request and its answer replaces the optimistic records; the
 * user's own settings are saved apart, since they aren't the organization's.
 * The rest stay local until their part of the API exists.
 */
export function createApiBackend(
  baseUrl: string,
  { fetch: fetchImpl = fetch, onSessionExpired }: ApiBackendOptions = {},
): ApiBackend {
  let cursor = 0;
  /** Whether someone is signed in, once known: until then, a 401 means there was no session to begin with. */
  let signedIn = false;
  let pulling: Promise<void> | undefined;
  let queue = Promise.resolve();
  /** Uploads by attachment ID; one that succeeded stays, so a later command naming the file doesn't send it again. */
  const uploads = new Map<string, Promise<void>>();

  function upload(id: string, file: File) {
    let uploading = uploads.get(id);
    if (!uploading) {
      const form = new FormData();
      form.set("id", id);
      form.set("file", file);
      uploading = request("/v1/files", { method: "POST", body: form }).then(
        () => undefined,
        (error: unknown) => {
          // A command naming it later tries again
          uploads.delete(id);
          throw error;
        },
      );
      uploads.set(id, uploading);
    }
    return uploading;
  }

  async function request<R>(path: string, init: RequestInit = {}, background = false): Promise<R> {
    const headers: Record<string, string> = {};
    // Form data sets its own type, with the multipart boundary
    if (typeof init.body === "string") headers["content-type"] = "application/json";
    if (background) headers[BACKGROUND_HEADER] = "1";
    const response = await fetchImpl(`${baseUrl}${path}`, { ...init, credentials: "include", headers });
    if (response.status === 401 && signedIn && onSessionExpired) {
      onSessionExpired();
      return new Promise<R>(() => {});
    }
    if (!response.ok) throw await errorOf(response);
    // 204 No Content, e.g. after a delete
    if (response.status === 204) return undefined as R;
    return (await response.json()) as R;
  }

  async function pullAll(background: boolean) {
    let more = true;
    while (more) {
      const page = await request<Changes>(`/v1/sync?since=${cursor}`, {}, background);
      applyChanges(page.changes);
      cursor = page.cursor;
      more = page.hasMore;
    }
  }

  return {
    send(commands) {
      const synced = commands.flatMap(toWire);
      const own = commands.flatMap(toUserSettings);
      if (synced.length === 0 && own.length === 0) return Promise.resolve();
      const body = JSON.stringify({ commands: synced });
      // Taken now: the form that picked them may be gone by the time the command goes
      const files = synced.length ? takeFiles(body) : [];
      // One request at a time, in order: an invoice must not reach the server before the client it names
      const sent = queue.then(async () => {
        for (const { section, data } of own)
          await request(`/v1/me/settings/${section}`, { method: "PUT", body: JSON.stringify(data) });
        if (synced.length === 0) return;
        // The files a record names are stored first. If one can't be, the record fails with its reason
        await Promise.all(files.map(({ id, file }) => upload(id, file)));
        const { changes } = await request<{ changes: Change[] }>("/v1/commands", {
          method: "POST",
          body,
        });
        applyChanges(changes);
      });
      const ids = files.map((file) => file.id);
      sent.then(
        () => settleFiles(ids, true),
        () => settleFiles(ids, false),
      );
      queue = sent.catch(() => undefined);
      return sent;
    },

    upload,

    // Bypass attachments cached under the old immutable policy.
    fileUrl: (id) => `${baseUrl}/v1/files/${id}?v=2`,

    files: {
      list: () => request<FileListing>("/v1/files"),
      delete: (id) => request(`/v1/files/${id}`, { method: "DELETE" }),
    },

    async sendEmail(email, files) {
      const attachments = await Promise.all(
        files.map(async (file) => {
          const form = new FormData();
          form.set("file", file);
          return (await request<StoredFile>("/v1/files", { method: "POST", body: form })).id;
        }),
      );
      return request<EmailMessage>("/v1/emails", {
        method: "POST",
        body: JSON.stringify({ ...email, attachments }),
      });
    },

    async emailsOf(documentId) {
      return (await request<{ emails: EmailMessage[] }>(`/v1/emails?documentId=${documentId}`)).emails;
    },

    emailSender: () => request<EmailSender>("/v1/emails/sender"),

    apiKeys: {
      list: async () => (await request<{ apiKeys: ApiKey[] }>("/v1/api-keys")).apiKeys,
      create: (key) => request<CreatedApiKey>("/v1/api-keys", { method: "POST", body: JSON.stringify(key) }),
      revoke: (id) => request(`/v1/api-keys/${id}`, { method: "DELETE" }),
    },

    billing: {
      get: () => request<Billing>("/v1/billing"),
      checkout: async (period) =>
        (await request<{ url: string }>("/v1/billing/checkout", { method: "POST", body: JSON.stringify({ period }) }))
          .url,
      portal: async () => (await request<{ url: string }>("/v1/billing/portal", { method: "POST" })).url,
      invoices: async () => (await request<{ invoices: BillingInvoice[] }>("/v1/billing/invoices")).invoices,
      pdfUrl: (invoiceId) => `${baseUrl}/v1/billing/invoices/${encodeURIComponent(invoiceId)}/pdf`,
    },

    extractPurchase: (fileId) =>
      request<PurchaseExtraction>("/v1/purchases/extract", { method: "POST", body: JSON.stringify({ fileId }) }),
    extractionUsage: () => request<ExtractionUsage>("/v1/purchases/extract/usage"),

    async helpChat(question, onText, signal) {
      const response = await fetchImpl(`${baseUrl}/v1/help-chat`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(question),
        signal,
      });
      if (response.status === 401 && signedIn && onSessionExpired) {
        onSessionExpired();
        return new Promise<void>(() => {});
      }
      if (!response.ok || !response.body) throw await errorOf(response);
      for await (const { event, data } of readEvents(response.body)) {
        if (event === "text") onText(JSON.parse(data) as string);
        else if (event === "done") return;
        else if (event === "error") {
          const error = JSON.parse(data) as { code: string; message: string };
          throw new ApiError(502, error.code, error.message);
        }
      }
      throw new ApiError(502, "ai_failed", "The answer was cut off.");
    },

    async members() {
      return (await request<{ members: OrganizationMember[] }>("/v1/organization/members")).members;
    },

    async loadWorkspace() {
      const workspace = await request<Workspace>("/v1/workspace");
      applyWorkspace(workspace);
      cursor = workspace.cursor;
    },

    async loadMe() {
      applyMe(await request<Me>("/v1/me"));
      signedIn = true;
    },

    pull({ background = false } = {}) {
      pulling ??= pullAll(background).finally(() => (pulling = undefined));
      return pulling;
    },
  };
}

/** The command as the API takes it, or nothing if the server doesn't store that data yet. */
function toWire(command: Command): SyncCommand[] {
  switch (command.type) {
    case "issue":
      return isSynced("salesDocuments") ? [command as SyncCommand] : [];
    case "closeQuarter":
    case "reopenQuarter":
      return isSynced("closedQuarters") ? [command as SyncCommand] : [];
    case "saveSettings":
      return isSettingsSynced(command.section) ? [{ ...command, section: command.section }] : [];
    case "update": {
      if (!isSynced(command.entity)) return [];
      // JSON drops undefined, so a field being cleared is sent as null.
      const changes = Object.fromEntries(Object.entries(command.changes).map(([key, value]) => [key, value ?? null]));
      return [{ ...command, entity: command.entity as SyncedUpdate["entity"], changes }];
    }
    default:
      return isSynced(command.entity) ? [command as SyncCommand] : [];
  }
}

type SyncedUpdate = Extract<SyncCommand, { type: "update" }>;

/** The user's own settings the command saves, if it saves some the server stores. */
function toUserSettings(command: Command): { section: UserSettingsSection; data: unknown }[] {
  if (command.type !== "saveSettings") return [];
  const section = userSettingsSectionSchema.safeParse(command.section);
  return section.success ? [{ section: section.data, data: command.data }] : [];
}

/** Marks a request the app made on its own, which doesn't count as the user being active. */
export const BACKGROUND_HEADER = "x-cuentalibre-background";

/** What counts as someone using the app, between two pulls. */
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/** How connecting to the API went: the app runs on it only when "connected". */
export type ConnectResult = "connected" | "signed-out" | "no-organization" | "unavailable";

/**
 * Loads the workspace from the API and switches to it as the backend, then
 * keeps the data fresh when the window regains focus and every 30 seconds. Those pulls
 * keep the session alive only if the user did something since the last one: a tab left
 * open isn't someone working, and its session ends after 8 hours like any other.
 * The stores must be loaded first, so their collections are registered.
 * Without a session, or without an active organization, the backend stays
 * local and the result says what's missing.
 */
export async function connectApi(
  baseUrl: string,
  onSessionExpired?: ApiBackendOptions["onSessionExpired"],
): Promise<ConnectResult> {
  const api = createApiBackend(baseUrl, { onSessionExpired });
  try {
    await Promise.all([api.loadWorkspace(), api.loadMe()]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return "signed-out";
    if (error instanceof ApiError && error.status === 403) return "no-organization";
    console.warn("cuentalibre API not available:", error);
    return "unavailable";
  }
  setBackend(api);
  let active = false;
  for (const event of ACTIVITY_EVENTS)
    window.addEventListener(event, () => (active = true), { capture: true, passive: true });
  const pull = () => {
    const background = !active;
    active = false;
    void api.pull({ background }).catch((error: unknown) => console.warn("Sync failed:", error));
  };
  window.addEventListener("focus", pull);
  setInterval(pull, 30_000);
  return "connected";
}

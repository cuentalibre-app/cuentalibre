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
  type Me,
  type OrganizationMember,
  type StoredFile,
  type SyncCommand,
  type UserSettingsSection,
  type Workspace,
} from "@cuentalibre/contracts";
import { setBackend, type Backend } from "./backend";
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

export interface ApiBackend extends Backend {
  /** Downloads the workspace and replaces the synced collections with it. */
  loadWorkspace: () => Promise<void>;
  /** Downloads the signed-in user's account and own settings. */
  loadMe: () => Promise<void>;
  /** Applies what changed on the server since the last download or pull. */
  pull: () => Promise<void>;
}

/**
 * The backend that talks to the API. Commands for data the server stores are
 * sent in one request and its answer replaces the optimistic records; the
 * user's own settings are saved apart, since they aren't the organization's.
 * The rest stay local until their part of the API exists.
 */
export function createApiBackend(baseUrl: string, fetchImpl: typeof fetch = fetch): ApiBackend {
  let cursor = 0;
  let pulling: Promise<void> | undefined;
  let queue = Promise.resolve();
  const uploads = new Set<Promise<void>>();
  /** Why an attachment's upload failed, by its ID, so the record that names it fails with that reason. */
  const failedUploads = new Map<string, unknown>();

  async function request<R>(path: string, init: RequestInit = {}): Promise<R> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      credentials: "include",
      // Form data sets its own type, with the multipart boundary
      headers: typeof init.body === "string" ? { "content-type": "application/json" } : undefined,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
      throw new ApiError(
        response.status,
        body?.error?.code ?? "http_error",
        body?.error?.message ?? response.statusText,
      );
    }
    // 204 No Content, e.g. after a delete
    if (response.status === 204) return undefined as R;
    return (await response.json()) as R;
  }

  async function pullAll() {
    let more = true;
    while (more) {
      const page = await request<Changes>(`/v1/sync?since=${cursor}`);
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
      // One request at a time, in order: an invoice must not reach the server before the client it names
      const sent = queue.then(async () => {
        for (const { section, data } of own)
          await request(`/v1/me/settings/${section}`, { method: "PUT", body: JSON.stringify(data) });
        if (synced.length === 0) return;
        // A record may name files still uploading. If one failed, the record fails with its reason
        await Promise.all(uploads);
        const body = JSON.stringify({ commands: synced });
        for (const [id, error] of failedUploads) if (body.includes(id)) throw error;
        const { changes } = await request<{ changes: Change[] }>("/v1/commands", {
          method: "POST",
          body,
        });
        applyChanges(changes);
      });
      queue = sent.catch(() => undefined);
      return sent;
    },

    upload(id, file) {
      const form = new FormData();
      form.set("id", id);
      form.set("file", file);
      const uploading = request("/v1/files", { method: "POST", body: form })
        .then(() => undefined)
        .catch((error: unknown) => {
          console.warn(`Upload of ${file.name} failed:`, error);
          failedUploads.set(id, error);
        })
        .finally(() => uploads.delete(uploading));
      uploads.add(uploading);
    },

    fileUrl: (id) => `${baseUrl}/v1/files/${id}`,

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
    },

    pull() {
      pulling ??= pullAll().finally(() => (pulling = undefined));
      return pulling;
    },
  };
}

/** The command as the API takes it, or nothing if the server doesn't store that data yet. */
function toWire(command: Command): SyncCommand[] {
  switch (command.type) {
    case "issue":
    case "correctRecord":
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

/** How connecting to the API went: the app runs on it only when "connected". */
export type ConnectResult = "connected" | "signed-out" | "no-organization" | "unavailable";

/**
 * Loads the workspace from the API and switches to it as the backend, then
 * keeps the data fresh when the window regains focus and every 30 seconds.
 * The stores must be loaded first, so their collections are registered.
 * Without a session, or without an active organization, the backend stays
 * local and the result says what's missing.
 */
export async function connectApi(baseUrl: string): Promise<ConnectResult> {
  const api = createApiBackend(baseUrl);
  try {
    await Promise.all([api.loadWorkspace(), api.loadMe()]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return "signed-out";
    if (error instanceof ApiError && error.status === 403) return "no-organization";
    console.warn("cuentalibre API not available:", error);
    return "unavailable";
  }
  setBackend(api);
  const pull = () => void api.pull().catch((error: unknown) => console.warn("Sync failed:", error));
  window.addEventListener("focus", pull);
  setInterval(pull, 30_000);
  return "connected";
}

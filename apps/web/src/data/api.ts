import type {
  ApiKey,
  Change,
  Changes,
  CreatedApiKey,
  EmailMessage,
  StoredFile,
  SyncCommand,
  Workspace,
} from "@fiscalia/contracts";
import { setBackend, type Backend } from "./backend";
import type { Command } from "./commands";
import { applyChanges, applyWorkspace, isSettingsSynced, isSynced } from "./sync";

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
  /** Applies what changed on the server since the last download or pull. */
  pull: () => Promise<void>;
}

/**
 * The backend that talks to the API. Commands for data the server stores are
 * sent in one request and its answer replaces the optimistic records; the rest
 * stay local until their part of the API exists.
 */
export function createApiBackend(baseUrl: string, fetchImpl: typeof fetch = fetch): ApiBackend {
  let cursor = 0;
  let pulling: Promise<void> | undefined;
  let queue = Promise.resolve();
  const uploads = new Set<Promise<void>>();

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
      if (synced.length === 0) return Promise.resolve();
      // One request at a time, in order: an invoice must not reach the server before the client it names
      const sent = queue.then(async () => {
        // A record may name files still uploading. If one failed, the server rejects the record.
        await Promise.all(uploads);
        const { changes } = await request<{ changes: Change[] }>("/v1/commands", {
          method: "POST",
          body: JSON.stringify({ commands: synced }),
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
        .catch((error: unknown) => console.warn(`Upload of ${file.name} failed:`, error))
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

    apiKeys: {
      list: async () => (await request<{ apiKeys: ApiKey[] }>("/v1/api-keys")).apiKeys,
      create: (key) => request<CreatedApiKey>("/v1/api-keys", { method: "POST", body: JSON.stringify(key) }),
      revoke: (id) => request(`/v1/api-keys/${id}`, { method: "DELETE" }),
    },

    async loadWorkspace() {
      const workspace = await request<Workspace>("/v1/workspace");
      applyWorkspace(workspace);
      cursor = workspace.cursor;
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
    await api.loadWorkspace();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return "signed-out";
    if (error instanceof ApiError && error.status === 403) return "no-organization";
    console.warn("Fiscalia API not available:", error);
    return "unavailable";
  }
  setBackend(api);
  const pull = () => void api.pull().catch((error: unknown) => console.warn("Sync failed:", error));
  window.addEventListener("focus", pull);
  setInterval(pull, 30_000);
  return "connected";
}

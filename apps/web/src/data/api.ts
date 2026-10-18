import type { Change, Changes, SyncCommand, Workspace } from "@fiscalia/contracts";
import { setBackend, type Backend } from "./backend";
import type { Command } from "./commands";
import { applyChanges, applyWorkspace, isSynced } from "./sync";

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
 * The backend that talks to the API. Commands for collections the server
 * stores are sent in one request and its answer replaces the optimistic
 * records; the rest stay local until their part of the API exists.
 */
export function createApiBackend(baseUrl: string, fetchImpl: typeof fetch = fetch): ApiBackend {
  let cursor = 0;
  let pulling: Promise<void> | undefined;

  async function request<R>(path: string, init: RequestInit = {}): Promise<R> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: init.body ? { "content-type": "application/json" } : undefined,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
      throw new ApiError(
        response.status,
        body?.error?.code ?? "http_error",
        body?.error?.message ?? response.statusText,
      );
    }
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
    async send(commands) {
      const synced = commands.flatMap(toWire);
      if (synced.length === 0) return;
      const { changes } = await request<{ changes: Change[] }>("/v1/commands", {
        method: "POST",
        body: JSON.stringify({ commands: synced }),
      });
      applyChanges(changes);
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

/** The command as the API takes it, or nothing if the server doesn't store that collection yet. */
function toWire(command: Command): SyncCommand[] {
  if (!("entity" in command) || !isSynced(command.entity)) return [];
  if (command.type !== "update") return [command as SyncCommand];
  // JSON drops undefined, so a field being cleared is sent as null.
  const changes = Object.fromEntries(Object.entries(command.changes).map(([key, value]) => [key, value ?? null]));
  return [{ ...command, entity: command.entity, changes }];
}

/**
 * Loads the workspace from the API and switches to it as the backend, then
 * keeps the data fresh when the window regains focus and every 30 seconds.
 * The stores must be loaded first, so their collections are registered.
 * Returns false, and leaves the sample data in place, if the API can't be used
 * (it's down, or nobody is signed in).
 */
export async function connectApi(baseUrl: string): Promise<boolean> {
  const api = createApiBackend(baseUrl);
  try {
    await api.loadWorkspace();
  } catch (error) {
    console.warn("Fiscalia API not available, using the sample data:", error);
    return false;
  }
  setBackend(api);
  const pull = () => void api.pull().catch((error: unknown) => console.warn("Sync failed:", error));
  window.addEventListener("focus", pull);
  setInterval(pull, 30_000);
  return true;
}

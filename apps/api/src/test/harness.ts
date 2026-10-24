import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newId } from "@cuentalibre/core";
import { afterAll, expect, vi } from "vitest";
import { createApp } from "../app";
import { createAuth } from "../auth";
import { createDb } from "../db/client";
import { membership, organization } from "../db/schema";
import type { Mailer, OutgoingEmail } from "../email/mailer";
import { loadEnv } from "../env";
import { diskStorage } from "../storage/disk";
import { testDatabaseUrl } from "./database";

const storageDir = mkdtempSync(join(tmpdir(), "cuentalibre-files-"));

export const env = loadEnv({
  NODE_ENV: "test",
  DATABASE_URL: testDatabaseUrl,
  STORAGE_DIR: storageDir,
  FILE_MAX_BYTES: String(1024 * 1024),
});
export const db = createDb(env.DATABASE_URL);
export const storage = diskStorage(storageDir);

/** Emails the app sent, in order. */
export const sentEmails: OutgoingEmail[] = [];
/** Makes the next sends fail with this error, until cleared. */
export const mailerFailure: { error: Error | null } = { error: null };
export const mailer: Mailer = {
  async send(email) {
    if (mailerFailure.error) throw mailerFailure.error;
    sentEmails.push(email);
  },
};

/** Emails about people's accounts (verification, password reset), apart from the business's. */
export const accountEmails: OutgoingEmail[] = [];
export const accountMailer: Mailer = {
  async send(email) {
    accountEmails.push(email);
  },
};

/**
 * Passwords Have I Been Pwned knows from data breaches. Its range API is answered here,
 * so tests don't reach the internet; with `down`, it fails as if unreachable.
 */
export const pwnedPasswords = { known: new Set(["password1234"]), down: false };
const realFetch = globalThis.fetch;
vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.hostname !== "api.pwnedpasswords.com") return realFetch(input, init);
  if (pwnedPasswords.down) return new Response(null, { status: 503 });
  const prefix = url.pathname.split("/").pop()!.toUpperCase();
  const lines = [...pwnedPasswords.known]
    .map((password) => createHash("sha1").update(password).digest("hex").toUpperCase())
    .filter((hash) => hash.startsWith(prefix))
    .map((hash) => `${hash.slice(5)}:42`);
  return new Response(lines.join("\r\n"), { headers: { "content-type": "text/plain" } });
});

export const app = createApp({ db, auth: createAuth(db, env, accountMailer), env, storage, mailer });

afterAll(async () => {
  await db.$client.end();
  rmSync(storageDir, { recursive: true, force: true });
});

const origin = env.BETTER_AUTH_URL;

/** A signed-in user: sends requests with their session cookie. */
export interface Client {
  /** `body` is sent as JSON; `form` as multipart/form-data. */
  request(path: string, init?: { method?: string; body?: unknown; form?: FormData }): Promise<Response>;
}

let counter = 0;

/**
 * Signs up a new user with a unique email and returns a client holding their session,
 * sending its requests to `target` (the app above, unless a test builds its own).
 */
export async function signUp(
  name = "Ana",
  target: Pick<typeof app, "request"> = app,
): Promise<Client & { email: string }> {
  const email = `user${Date.now()}-${++counter}@example.com`;
  const response = await target.request(`${origin}/v1/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ name, email, password: "a-long-password" }),
  });
  if (!response.ok) throw new Error(`Sign up failed: ${response.status} ${await response.text()}`);
  const cookies = new Map<string, string>();
  storeCookies(cookies, response);

  return {
    email,
    async request(path, init = {}) {
      const res = await target.request(`${origin}${path}`, {
        method: init.method ?? "GET",
        headers: {
          cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
          origin,
          ...(init.body ? { "content-type": "application/json" } : {}),
        },
        body: init.form ?? (init.body ? JSON.stringify(init.body) : undefined),
      });
      // Better Auth refreshes the session cookies on some calls (e.g. switching organization).
      storeCookies(cookies, res);
      return res;
    },
  };
}

function storeCookies(cookies: Map<string, string>, response: Response) {
  for (const header of response.headers.getSetCookie()) {
    const [pair = ""] = header.split(";");
    const index = pair.indexOf("=");
    const name = pair.slice(0, index);
    const value = pair.slice(index + 1);
    if (value) cookies.set(name, value);
    else cookies.delete(name);
  }
}

/** Creates an organization as the client's user, which makes it their active one. */
export async function createOrganization(client: Client, name: string) {
  const slug = `${name.toLowerCase().replace(/\W+/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
  const response = await client.request("/v1/auth/organization/create", { method: "POST", body: { name, slug } });
  expect(response.status).toBe(200);
  return (await response.json()) as { id: string; name: string; slug: string };
}

/**
 * Makes the client's user the owner of another organization, written straight to the database:
 * the API allows one per user until switching organizations arrives (#33). The session stays
 * in the organization it was in.
 */
export async function addOrganization(client: Client, name: string) {
  const me = (await (await client.request("/v1/me")).json()) as { user: { id: string } };
  const id = newId();
  await db.insert(organization).values({ id, name, slug: `org-${id}` });
  await db.insert(membership).values({ id: newId(), organizationId: id, userId: me.user.id, role: "owner" });
  return { id, name };
}

/** A script or agent: sends requests with an API key instead of a session. */
export function withApiKey(key: string): Client {
  return {
    request: async (path, init = {}) =>
      app.request(`${origin}${path}`, {
        method: init.method ?? "GET",
        headers: { authorization: `Bearer ${key}`, ...(init.body ? { "content-type": "application/json" } : {}) },
        body: init.form ?? (init.body ? JSON.stringify(init.body) : undefined),
      }),
  };
}

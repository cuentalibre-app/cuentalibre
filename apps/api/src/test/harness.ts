import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect } from "vitest";
import { createApp } from "../app";
import { createAuth } from "../auth";
import { createDb } from "../db/client";
import { loadEnv } from "../env";
import { diskStorage } from "../storage/disk";
import { testDatabaseUrl } from "./database";

const storageDir = mkdtempSync(join(tmpdir(), "fiscalia-files-"));

export const env = loadEnv({
  NODE_ENV: "test",
  DATABASE_URL: testDatabaseUrl,
  STORAGE_DIR: storageDir,
  FILE_MAX_BYTES: String(1024 * 1024),
});
export const db = createDb(env.DATABASE_URL);
export const app = createApp({ db, auth: createAuth(db, env), env, storage: diskStorage(storageDir) });

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

/** Signs up a new user with a unique email and returns a client holding their session. */
export async function signUp(name = "Ana"): Promise<Client & { email: string }> {
  const email = `user${Date.now()}-${++counter}@example.com`;
  const response = await app.request(`${origin}/v1/auth/sign-up/email`, {
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
      const res = await app.request(`${origin}${path}`, {
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

import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { loadEnv } from "./env";
import { COSTLY_REQUESTS_PER_MINUTE, fixedWindowCounter } from "./rate-limit";
import { accountMailer, db, env, mailer, signUp, storage } from "./test/harness";

const origin = env.BETTER_AUTH_URL;

describe("fixedWindowCounter", () => {
  it("allows up to the limit in a minute, then says when to retry", () => {
    const count = fixedWindowCounter();
    expect(count("ana", 2, 0)).toBeNull();
    expect(count("ana", 2, 1_000)).toBeNull();
    expect(count("ana", 2, 20_000)).toBe(40);
    expect(count("luis", 2, 20_000)).toBeNull();
    expect(count("ana", 2, 60_000)).toBeNull();
  });
});

describe("rate limits", () => {
  it("limits the costly routes per user, with Retry-After", async () => {
    const ana = await signUp();
    for (let i = 0; i < COSTLY_REQUESTS_PER_MINUTE; i++) {
      const response = await ana.request("/v1/help-chat", { method: "POST", body: {} });
      expect(response.status).not.toBe(429);
    }
    const limited = await ana.request("/v1/help-chat", { method: "POST", body: {} });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(((await limited.json()) as { error: { code: string } }).error.code).toBe("rate_limited");

    // Another user, and the same user's cheap routes, still go through
    expect((await (await signUp()).request("/v1/help-chat", { method: "POST", body: {} })).status).not.toBe(429);
    expect((await ana.request("/v1/me")).status).toBe(200);
  });
});

describe("body limit", () => {
  it("rejects JSON bodies over 1 MB", async () => {
    const ana = await signUp();
    const response = await ana.request("/v1/commands", {
      method: "POST",
      body: { commands: [], padding: "x".repeat(1024 * 1024) },
    });
    expect(response.status).toBe(413);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("payload_too_large");
  });

  it("caps sign-up bodies too", async () => {
    const response = await createTestApp().request(`${origin}/v1/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ name: "x".repeat(1024 * 1024), email: "big@example.com", password: "a-long-password" }),
    });
    expect(response.status).toBe(413);
  });
});

function createTestApp(overrides: Record<string, string> = {}) {
  const testEnv = loadEnv({
    ...process.env,
    NODE_ENV: env.NODE_ENV,
    DATABASE_URL: env.DATABASE_URL,
    STORAGE_DIR: env.STORAGE_DIR,
    ...overrides,
  });
  return createApp({ db, auth: createAuth(db, testEnv, accountMailer), env: testEnv, storage, mailer });
}

describe("sign-in limits", () => {
  // Better Auth only limits in production
  const app = createTestApp({ NODE_ENV: "production", BETTER_AUTH_SECRET: "a-production-secret-of-32-characters!!" });

  const signIn = (forwardedFor: string) =>
    app.request(`${origin}/v1/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, "x-forwarded-for": forwardedFor },
      body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password" }),
    });

  it("counts by the address the proxy appended, not the ones the client made up", async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
    for (let i = 0; i < 10; i++) expect((await signIn(`10.0.0.${i}, ${ip}`)).status).toBe(401);
    expect((await signIn(`10.0.0.99, ${ip}`)).status).toBe(429);
    expect((await signIn("198.51.100.7")).status).toBe(401);
  });
});

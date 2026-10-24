import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { BREACHED_PASSWORD } from "./breached-passwords";
import { account } from "./db/schema";
import { app, db, env, pwnedPasswords, signUp, storage } from "./test/harness";
import { errorCode } from "./test/sync";

const BREACHED = "password1234";
const origin = env.BETTER_AUTH_URL;

const post = (path: string, body: unknown, target = app) =>
  target.request(`${origin}/v1/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });

const signUpWith = (password: string, target = app) =>
  post("/sign-up/email", { name: "Ana", email: `breach${Date.now()}${Math.random()}@example.com`, password }, target);

/** Better Auth's errors carry the code at the top level. */
const authErrorCode = async (response: Response) => ((await response.json()) as { code: string }).code;

afterEach(() => {
  pwnedPasswords.down = false;
});

describe("breached passwords", () => {
  it("are refused on sign-up", async () => {
    const response = await signUpWith(BREACHED);
    expect(response.status).toBe(400);
    expect(await authErrorCode(response)).toBe(BREACHED_PASSWORD);
    expect((await signUpWith("a-long-password")).status).toBe(200);
  });

  it("are refused when changing the password", async () => {
    const ana = await signUp();
    const response = await ana.request("/v1/auth/change-password", {
      method: "POST",
      body: { currentPassword: "a-long-password", newPassword: BREACHED },
    });
    expect(response.status).toBe(400);
    expect(await authErrorCode(response)).toBe(BREACHED_PASSWORD);
  });

  it("are refused when resetting the password", async () => {
    const response = await post("/reset-password", { token: "any", newPassword: BREACHED });
    expect(response.status).toBe(400);
    expect(await authErrorCode(response)).toBe(BREACHED_PASSWORD);
  });

  it("are refused when someone who signs in with Google creates one", async () => {
    const ana = await signUp();
    const me = (await (await ana.request("/v1/me")).json()) as { user: { id: string } };
    await db.delete(account).where(eq(account.userId, me.user.id));

    const response = await ana.request("/v1/me/password", { method: "POST", body: { newPassword: BREACHED } });
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe(BREACHED_PASSWORD);
  });

  it("are let through when Have I Been Pwned can't be reached", async () => {
    pwnedPasswords.down = true;
    expect((await signUpWith(BREACHED)).status).toBe(200);
  });

  it("are let through when the check is off", async () => {
    const offline = { ...env, PASSWORD_BREACH_CHECK: "off" as const };
    const target = createApp({ db, auth: createAuth(db, offline, null), env: offline, storage, mailer: null });
    expect((await signUpWith(BREACHED, target)).status).toBe(200);
  });
});

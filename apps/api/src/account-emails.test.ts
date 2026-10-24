import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { accountEmails, app, db, env, signUp, storage, type Client } from "./test/harness";

const origin = env.BETTER_AUTH_URL;
const web = env.WEB_ORIGIN;

const post = (path: string, body: unknown, target = app) =>
  target.request(`${origin}/v1/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });

/** The link in the last account email sent to `email`. */
function linkSentTo(email: string) {
  const sent = accountEmails.findLast((message) => message.to.includes(email));
  expect(sent).toBeDefined();
  return sent!.text.match(/https?:\/\/\S+/)![0];
}

/** The code in the last account email sent to `email`. */
function codeSentTo(email: string) {
  const sent = accountEmails.findLast((message) => message.to.includes(email));
  expect(sent).toBeDefined();
  return sent!.text.match(/^\d{6}$/m)![0];
}

async function account(someone: Client) {
  const response = await someone.request("/v1/me");
  return ((await response.json()) as { user: { email: string; emailVerified: boolean } }).user;
}

const verify = (someone: Client & { email: string }, otp: string) =>
  someone.request("/v1/auth/email-otp/verify-email", { method: "POST", body: { email: someone.email, otp } });

describe("verifying an email", () => {
  it("sends a code on sign-up that verifies the email", async () => {
    const ana = await signUp("Ana");
    expect((await account(ana)).emailVerified).toBe(false);
    const code = codeSentTo(ana.email);
    expect(accountEmails.findLast((message) => message.to.includes(ana.email))).toMatchObject({
      fromName: "cuentalibre",
      subject: `${code} es tu código de cuentalibre`,
    });

    // The designed version carries the code too, and escapes the user's name
    const html = accountEmails.findLast((message) => message.to.includes(ana.email))!.html!;
    expect(html).toContain(code);
    expect(html).toContain("Hola, Ana:");

    expect((await verify(ana, code)).status).toBe(200);
    expect((await account(ana)).emailVerified).toBe(true);
    // A code only works once
    expect((await verify(ana, code)).status).toBe(400);
  });

  it("allows three tries per code", async () => {
    const ana = await signUp("Ana");
    const code = codeSentTo(ana.email);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 3; i++) {
      const response = await verify(ana, wrong);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "INVALID_OTP" });
    }
    const response = await verify(ana, code);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
    expect((await account(ana)).emailVerified).toBe(false);
  });

  it("sends a new code when the user asks for it", async () => {
    const ana = await signUp("Ana");
    const before = accountEmails.length;
    const response = await ana.request("/v1/auth/send-verification-email", {
      method: "POST",
      body: { email: ana.email },
    });
    expect(response.status).toBe(200);
    expect(accountEmails.length).toBe(before + 1);
    expect((await verify(ana, codeSentTo(ana.email))).status).toBe(200);
  });

  it("switches to another email with a code sent to it, which verifies it", async () => {
    const ana = await signUp("Ana");
    const newEmail = `fixed-${ana.email}`;
    const requested = await ana.request("/v1/auth/email-otp/request-email-change", {
      method: "POST",
      body: { newEmail },
    });
    expect(requested.status).toBe(200);
    expect(accountEmails.findLast((message) => message.to.includes(newEmail))!.text).toContain("Hola, Ana:");

    const changed = await ana.request("/v1/auth/email-otp/change-email", {
      method: "POST",
      body: { newEmail, otp: codeSentTo(newEmail) },
    });
    expect(changed.status).toBe(200);
    expect(await account(ana)).toMatchObject({ email: newEmail, emailVerified: true });
  });

  it("doesn't sign in or reset passwords with a code", async () => {
    for (const path of [
      "/sign-in/email-otp",
      "/forget-password/email-otp",
      "/email-otp/request-password-reset",
      "/email-otp/reset-password",
      "/email-otp/send-verification-otp",
      "/email-otp/check-verification-otp",
    ]) {
      expect((await post(path, { email: "someone@example.com", otp: "123456", type: "sign-in" })).status).toBe(404);
    }
  });
});

describe("resetting a password", () => {
  it("emails a link to choose a new one, which signs everyone out and verifies the email", async () => {
    const ana = await signUp("Ana");
    expect((await post("/request-password-reset", { email: ana.email, redirectTo: `${web}/restablecer` })).status).toBe(
      200,
    );

    const reset = await app.request(linkSentTo(ana.email));
    expect(reset.status).toBe(302);
    const target = new URL(reset.headers.get("location")!);
    expect(`${target.origin}${target.pathname}`).toBe(`${web}/restablecer`);
    const token = target.searchParams.get("token");

    expect((await post("/reset-password", { token, newPassword: "a-new-long-password" })).status).toBe(200);
    expect((await ana.request("/v1/me")).status).toBe(401);
    expect((await post("/sign-in/email", { email: ana.email, password: "a-long-password" })).status).toBe(401);
    const signedIn = await post("/sign-in/email", { email: ana.email, password: "a-new-long-password" });
    expect(signedIn.status).toBe(200);
    expect(((await signedIn.json()) as { user: { emailVerified: boolean } }).user.emailVerified).toBe(true);

    // The link only works once
    expect((await post("/reset-password", { token, newPassword: "another-long-password" })).status).toBe(400);
  });

  it("answers the same for an email without an account, and sends nothing", async () => {
    const before = accountEmails.length;
    const response = await post("/request-password-reset", { email: "nobody@example.com", redirectTo: web });
    expect(response.status).toBe(200);
    expect(accountEmails.length).toBe(before);
  });
});

describe("an instance that can't send email", () => {
  const withoutEmail = createApp({ db, auth: createAuth(db, env, null), env, storage, mailer: null });

  it("says so, and neither verifies emails nor resets passwords", async () => {
    expect(await (await withoutEmail.request("/v1/sign-in-methods")).json()).toEqual({ google: false, email: false });

    const before = accountEmails.length;
    const email = `noemail${Date.now()}@example.com`;
    const signedUp = await post("/sign-up/email", { name: "Ana", email, password: "a-long-password" }, withoutEmail);
    expect(signedUp.status).toBe(200);
    expect(accountEmails.length).toBe(before);

    expect((await post("/request-password-reset", { email, redirectTo: web }, withoutEmail)).status).toBe(400);
  });
});

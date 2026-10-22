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

async function emailVerified(someone: Client) {
  const response = await someone.request("/v1/me");
  return ((await response.json()) as { user: { emailVerified: boolean } }).user.emailVerified;
}

describe("verifying an email", () => {
  it("sends a link on sign-up that verifies the email", async () => {
    const ana = await signUp("Ana");
    expect(await emailVerified(ana)).toBe(false);
    const sent = accountEmails.findLast((message) => message.to.includes(ana.email))!;
    expect(sent).toMatchObject({ fromName: "cuentalibre", subject: "Confirma tu email en cuentalibre" });

    const link = new URL(linkSentTo(ana.email));
    link.searchParams.set("callbackURL", `${web}/configuracion/credenciales?verificado=1`);
    const response = await app.request(link.toString());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${web}/configuracion/credenciales?verificado=1`);
    expect(await emailVerified(ana)).toBe(true);
  });

  it("sends the link again when the user asks for it", async () => {
    const ana = await signUp("Ana");
    const before = accountEmails.length;
    const response = await ana.request("/v1/auth/send-verification-email", {
      method: "POST",
      body: { email: ana.email, callbackURL: `${web}/configuracion/credenciales` },
    });
    expect(response.status).toBe(200);
    expect(accountEmails.length).toBe(before + 1);
    expect(linkSentTo(ana.email)).toContain(encodeURIComponent(`${web}/configuracion/credenciales`));
  });

  it("sends people back with an error when the link is wrong", async () => {
    const callback = `${web}/configuracion/credenciales?verificado=1`;
    const response = await app.request(
      `${origin}/v1/auth/verify-email?token=nope&callbackURL=${encodeURIComponent(callback)}`,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${callback}&error=INVALID_TOKEN`);
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

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { SESSION_EXPIRES_IN } from "./auth";
import { BACKGROUND_HEADER } from "./middleware";
import { session } from "./db/schema";
import { db, signUp, type Client } from "./test/harness";
import { member } from "./test/sync";

const HOUR = 60 * 60 * 1000;

async function userIdOf(someone: Client) {
  const response = await someone.request("/v1/me");
  return ((await response.json()) as { user: { id: string } }).user.id;
}

/** Moves the user's session as if its last extension was `ago` milliseconds back. */
async function lastExtended(userId: string, ago: number) {
  await db
    .update(session)
    .set({ expiresAt: new Date(Date.now() + SESSION_EXPIRES_IN * 1000 - ago) })
    .where(eq(session.userId, userId));
}

async function expiresAtOf(userId: string) {
  const [row] = await db.select({ expiresAt: session.expiresAt }).from(session).where(eq(session.userId, userId));
  return row!.expiresAt.getTime();
}

const sessionCookie = (response: Response) =>
  response.headers.getSetCookie().find((cookie) => cookie.startsWith("better-auth.session_token="));

describe("sessions", () => {
  it("last eight hours without activity", async () => {
    const ana = await signUp();
    const anaId = await userIdOf(ana);
    const expiresIn = (await expiresAtOf(anaId)) - Date.now();
    expect(expiresIn).toBeGreaterThan(8 * HOUR - 60_000);
    expect(expiresIn).toBeLessThanOrEqual(8 * HOUR);
  });

  it("are extended by a request, with a fresh cookie, at most every five minutes", async () => {
    const ana = await signUp();
    const anaId = await userIdOf(ana);

    await lastExtended(anaId, 60_000);
    const soon = await ana.request("/v1/me");
    expect(soon.status).toBe(200);
    expect(sessionCookie(soon)).toBeUndefined();

    await lastExtended(anaId, 2 * HOUR);
    const later = await ana.request("/v1/me");
    expect(later.status).toBe(200);
    expect(sessionCookie(later)).toMatch(new RegExp(`Max-Age=${SESSION_EXPIRES_IN}`));
    expect((await expiresAtOf(anaId)) - Date.now()).toBeGreaterThan(8 * HOUR - 60_000);
  });

  it("aren't extended by what the app does in the background", async () => {
    const ana = await member();
    const anaId = await userIdOf(ana);
    await lastExtended(anaId, 2 * HOUR);
    const before = await expiresAtOf(anaId);

    const sync = await ana.request("/v1/sync?since=0", { headers: { [BACKGROUND_HEADER]: "1" } });
    expect(sync.status).toBe(200);
    expect(sessionCookie(sync)).toBeUndefined();
    expect(await expiresAtOf(anaId)).toBe(before);
  });

  it("end after eight hours without activity", async () => {
    const ana = await signUp();
    const anaId = await userIdOf(ana);
    await lastExtended(anaId, 8 * HOUR + 60_000);
    expect((await ana.request("/v1/me")).status).toBe(401);
  });
});

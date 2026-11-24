import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { reportError } from "./error-reporting";
import { ApiError } from "./errors";
import { app, db, env, mailer, storage } from "./test/harness";

vi.mock("./error-reporting", () => ({ reportError: vi.fn() }));

describe("error reporting", () => {
  app.get("/v1/test-only/crash/:id", () => {
    throw new Error("boom");
  });
  app.get("/v1/test-only/query", () => {
    const cause = Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
      table: "contact",
      constraint: "contact_tax_id_unique",
      detail: "Key (tax_id)=(B12345678) already exists.",
    });
    throw new DrizzleQueryError('insert into "contact" ("tax_id") values ($1)', ["B12345678"], cause);
  });
  app.get("/v1/test-only/refuse", () => {
    throw new ApiError(409, "conflict", "Refused.");
  });

  it("reports an unexpected error with its route, not its path", async () => {
    const response = await app.request("/v1/test-only/crash/42");
    expect(response.status).toBe(500);
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }), {
      method: "GET",
      route: "/v1/test-only/crash/:id",
    });
  });

  it("reports and logs a failed query without its parameters or the database's detail", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(reportError).mockClear();
    expect((await app.request("/v1/test-only/query")).status).toBe(500);

    const [reported] = vi.mocked(reportError).mock.calls[0]!;
    expect(reported).toMatchObject({
      message:
        'Failed query: insert into "contact" ("tax_id") values ($1) (code 23505, table contact, constraint contact_tax_id_unique)',
    });
    const logged = log.mock.calls
      .flat()
      .map((arg) => (arg instanceof Error ? `${arg.stack} ${String(arg.cause)}` : String(arg)));
    expect(logged.join(" ")).not.toContain("B12345678");
    expect(JSON.stringify(reported) + (reported as Error).stack).not.toContain("B12345678");
    log.mockRestore();
  });

  it("redacts failed queries logged by Better Auth", async () => {
    const auth = createAuth(db, env, null);
    const { logger } = await auth.$context;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const query = 'select * from "session" where "token" = $1';
      const token = "test-session-token";
      const cause = Object.assign(new Error("query failed for " + token), { code: "XX000" });
      logger.error("INTERNAL_SERVER_ERROR", new DrizzleQueryError(query, [token], cause));
      expect(log).toHaveBeenCalledWith(
        "[Better Auth] INTERNAL_SERVER_ERROR",
        expect.objectContaining({ message: `Failed query: ${query} (code XX000)` }),
      );
      const logged = log.mock.calls[0]![1] as Error;
      expect(logged.stack).not.toContain(token);
      expect(logged.cause).toBeUndefined();
    } finally {
      log.mockRestore();
    }
  });

  it("redacts database errors from Better Auth's HTTP router", async () => {
    const auth = createAuth(db, env, null);
    const authApp = createApp({ db, auth, env, storage, mailer });
    const { internalAdapter } = await auth.$context;
    const email = "test@example.com";
    const query = 'select "table_column" from "user" where "email" = $1';
    const findUser = vi.spyOn(internalAdapter, "findUserByEmail").mockRejectedValueOnce(
      new DrizzleQueryError(query, [email], new Error("Failed to look up " + email)),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(reportError).mockClear();
    try {
      const response = await authApp.request(new URL("/v1/auth/sign-in/email", env.BETTER_AUTH_URL).href, {
        method: "POST",
        headers: { "content-type": "application/json", origin: env.WEB_ORIGIN },
        body: JSON.stringify({ email, password: "a-long-password" }),
      });

      expect(findUser).toHaveBeenCalledOnce();
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ error: { code: "internal_error" } });
      expect(log).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: `Failed query: ${query}` }));
      const [logged] = log.mock.calls[0]!;
      expect(logged.stack).not.toContain(email);
      expect(logged.cause).toBeUndefined();
      expect(reportError).toHaveBeenCalledWith(logged, { method: "POST", route: "/v1/auth/*" });
    } finally {
      findUser.mockRestore();
      log.mockRestore();
    }
  });

  it("doesn't report the errors the API answers on purpose", async () => {
    vi.mocked(reportError).mockClear();
    expect((await app.request("/v1/test-only/refuse")).status).toBe(409);
    expect((await app.request("/v1/no-such-thing")).status).toBe(404);
    expect(reportError).not.toHaveBeenCalled();
  });
});

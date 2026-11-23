import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors";
import { reportError } from "./error-reporting";
import { app } from "./test/harness";

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

  it("doesn't report the errors the API answers on purpose", async () => {
    vi.mocked(reportError).mockClear();
    expect((await app.request("/v1/test-only/refuse")).status).toBe(409);
    expect((await app.request("/v1/no-such-thing")).status).toBe(404);
    expect(reportError).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors";
import { reportError } from "./error-reporting";
import { app } from "./test/harness";

vi.mock("./error-reporting", () => ({ reportError: vi.fn() }));

describe("error reporting", () => {
  app.get("/v1/test-only/crash/:id", () => {
    throw new Error("boom");
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

  it("doesn't report the errors the API answers on purpose", async () => {
    vi.mocked(reportError).mockClear();
    expect((await app.request("/v1/test-only/refuse")).status).toBe(409);
    expect((await app.request("/v1/no-such-thing")).status).toBe(404);
    expect(reportError).not.toHaveBeenCalled();
  });
});

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { serveWeb } from "./web";

const dir = mkdtempSync(join(tmpdir(), "cuentalibre-web-"));
mkdirSync(join(dir, "assets"));
writeFileSync(join(dir, "index.html"), "<!doctype html><title>cuentalibre</title>");
writeFileSync(join(dir, "assets", "index-3f2a.js"), "console.log('cuentalibre');\n".repeat(200));
writeFileSync(join(dir, "favicon.svg"), "<svg/>");
writeFileSync(
  join(dir, "_headers"),
  [
    "# What the build writes",
    "/*",
    "  Content-Security-Policy: default-src 'self'; frame-ancestors 'none'",
    "  X-Frame-Options: DENY",
    "/assets/*",
    "  X-Only-Assets: yes",
    "",
  ].join("\n"),
);

const app = new Hono();
app.use("*", serveWeb(dir));
app.get("/v1/health", (c) => c.json({ status: "ok" }));
app.notFound((c) => c.json({ error: { code: "not_found" } }, 404));

describe("serveWeb", () => {
  it("serves the app at the root and on its pages", async () => {
    for (const path of ["/", "/ventas/facturas", "/demo/compras"]) {
      const response = await app.request(path);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/^text\/html/);
      expect(response.headers.get("cache-control")).toBe("no-cache");
      expect(await response.text()).toContain("<title>cuentalibre</title>");
    }
  });

  it("serves built files, caching the hashed ones for good", async () => {
    const script = await app.request("/assets/index-3f2a.js");
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toMatch(/javascript/);
    expect(script.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");

    const icon = await app.request("/favicon.svg");
    expect(icon.status).toBe(200);
    expect(icon.headers.get("cache-control")).toBe("no-cache");
  });

  it("sends the headers of _headers with every file", async () => {
    for (const path of ["/", "/ventas/facturas", "/assets/index-3f2a.js", "/favicon.svg"]) {
      const response = await app.request(path);
      expect(response.headers.get("content-security-policy")).toBe("default-src 'self'; frame-ancestors 'none'");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("x-only-assets")).toBeNull();
    }
  });

  it("doesn't serve _headers itself", async () => {
    expect((await app.request("/_headers")).status).toBe(404);
  });

  it("answers a missing file with a 404, not the app", async () => {
    const response = await app.request("/assets/index-gone.js");
    expect(response.status).toBe(404);
  });

  it("leaves the API alone", async () => {
    expect(await (await app.request("/v1/health")).json()).toEqual({ status: "ok" });
    const missing = await app.request("/v1/nothing-here");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: { code: "not_found" } });
  });

  it("only serves reads", async () => {
    expect((await app.request("/", { method: "POST" })).status).toBe(404);
  });

  it("compresses when the browser accepts it", async () => {
    const response = await app.request("/assets/index-3f2a.js", { headers: { "accept-encoding": "gzip" } });
    expect(response.headers.get("content-encoding")).toBe("gzip");
  });
});

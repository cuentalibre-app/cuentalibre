import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import type { MiddlewareHandler } from "hono";
import { compress } from "hono/compress";

/** Vite names these files after their content, so they never change. */
const IMMUTABLE = "public, max-age=31536000, immutable";

const isApi = (path: string) => path === "/v1" || path.startsWith("/v1/");

/** A path to a file (`/assets/index-3f2a.js`) rather than a page of the app (`/ventas/facturas`). */
const isFile = (path: string) => /\.[^/]+$/.test(path);

/**
 * The headers the build writes to `_headers` for every path (`/*`), the ones
 * Cloudflare sends when it hosts the app: its Content-Security-Policy and the rest.
 */
function readHeaders(dir: string): [string, string][] {
  const file = join(dir, "_headers");
  if (!existsSync(file)) return [];
  const headers: [string, string][] = [];
  let everyPath = false;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) everyPath = line.trim() === "/*";
    else if (everyPath && line.includes(":")) {
      const at = line.indexOf(":");
      headers.push([line.slice(0, at).trim(), line.slice(at + 1).trim()]);
    }
  }
  return headers;
}

/**
 * Serves the built web app from `dir`, so self-hosting needs one origin and no web
 * server in front. Pages of the app fall back to `index.html`, which the browser
 * checks every time so an update shows on the next load; a missing file is a 404,
 * not the app, so a stale tab doesn't take HTML for a script. Every file carries
 * the headers of `_headers`.
 */
export function serveWeb(dir: string): MiddlewareHandler {
  const file = serveStatic({ root: dir });
  const app = serveStatic({ root: dir, path: "index.html" });
  const zip = compress();
  const headers = readHeaders(dir);

  return async (c, next) => {
    if (!["GET", "HEAD"].includes(c.req.method) || isApi(c.req.path) || c.req.path === "/_headers") return next();
    await zip(c, async () => {
      const serve = isFile(c.req.path) ? file : app;
      const response = await serve(c, next);
      if (response) {
        response.headers.set("cache-control", c.req.path.startsWith("/assets/") ? IMMUTABLE : "no-cache");
        for (const [name, value] of headers) response.headers.set(name, value);
        c.res = response;
      }
    });
  };
}

import { serveStatic } from "@hono/node-server/serve-static";
import type { MiddlewareHandler } from "hono";
import { compress } from "hono/compress";

/** Vite names these files after their content, so they never change. */
const IMMUTABLE = "public, max-age=31536000, immutable";

const isApi = (path: string) => path === "/v1" || path.startsWith("/v1/");

/** A path to a file (`/assets/index-3f2a.js`) rather than a page of the app (`/ventas/facturas`). */
const isFile = (path: string) => /\.[^/]+$/.test(path);

/**
 * Serves the built web app from `dir`, so self-hosting needs one origin and no web
 * server in front. Pages of the app fall back to `index.html`, which the browser
 * checks every time so an update shows on the next load; a missing file is a 404,
 * not the app, so a stale tab doesn't take HTML for a script.
 */
export function serveWeb(dir: string): MiddlewareHandler {
  const file = serveStatic({ root: dir });
  const app = serveStatic({ root: dir, path: "index.html" });
  const zip = compress();

  return async (c, next) => {
    if (!["GET", "HEAD"].includes(c.req.method) || isApi(c.req.path)) return next();
    await zip(c, async () => {
      const serve = isFile(c.req.path) ? file : app;
      const response = await serve(c, next);
      if (response) {
        response.headers.set("cache-control", c.req.path.startsWith("/assets/") ? IMMUTABLE : "no-cache");
        c.res = response;
      }
    });
  };
}

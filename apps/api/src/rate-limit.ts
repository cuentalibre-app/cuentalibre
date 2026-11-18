import type { IncomingMessage } from "node:http";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./context";
import { errorResponse } from "./errors";

/** Requests a signed-in user, or a signed-out IP address, may make in a minute. API keys have their own limit. */
export const REQUESTS_PER_MINUTE = 600;

/** Of them, those that write a batch, upload a file, send email or ask an AI model, with or without an API key. */
export const COSTLY_REQUESTS_PER_MINUTE = 60;

const COSTLY_ROUTES = new Set([
  "POST /v1/commands",
  "POST /v1/files",
  "POST /v1/emails",
  "POST /v1/purchases/extract",
  "POST /v1/help-chat",
]);

/** Largest body any route but uploads reads: 500 sync commands fit with room to spare. */
export const BODY_MAX_BYTES = 1024 * 1024;

/**
 * The header the client's IP reaches Better Auth in, set by `identifyClient` on every
 * request, so whatever a client sends in it is overwritten.
 */
export const CLIENT_IP_HEADER = "x-cuentalibre-client-ip";

const WINDOW_MS = 60_000;

/**
 * Who sent the request: the last address in the header the proxy in front sets (proxies
 * append the address they saw, so earlier ones may be made up), or the connection's own
 * address when nothing sits in front.
 */
export function clientIpOf(c: Context, header: string): string {
  const forwarded = c.req
    .header(header)
    ?.split(",")
    .map((ip) => ip.trim())
    .filter(Boolean)
    .at(-1);
  if (forwarded) return forwarded;
  const incoming = (c.env as { incoming?: IncomingMessage } | undefined)?.incoming;
  return incoming?.socket.remoteAddress ?? "unknown";
}

/** Puts the client's IP on the context and in `CLIENT_IP_HEADER`, for Better Auth's limits. */
export const identifyClient = (header: string) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const ip = clientIpOf(c, header);
    c.set("clientIp", ip);
    c.req.raw.headers.set(CLIENT_IP_HEADER, ip);
    await next();
  });

/** Rejects bodies over `BODY_MAX_BYTES`, except uploads, which have their own limit. */
export const limitBody = createMiddleware<AppEnv>((c, next) =>
  c.req.method === "POST" && c.req.path === "/v1/files"
    ? next()
    : bodyLimit({
        maxSize: BODY_MAX_BYTES,
        onError: (c) => errorResponse(c, 413, "payload_too_large", "The request body is larger than 1 MB."),
      })(c, next),
);

/**
 * Counts requests per minute in this process's memory: one API process serves every
 * request, and a minute's counts lost on a deploy don't matter. Returns null when the
 * request is allowed, or the seconds until it would be.
 */
export function fixedWindowCounter() {
  const windows = new Map<string, { count: number; resetAt: number }>();
  let nextSweep = 0;
  return (key: string, max: number, now = Date.now()): number | null => {
    if (now >= nextSweep) {
      for (const [k, window] of windows) if (now >= window.resetAt) windows.delete(k);
      nextSweep = now + WINDOW_MS;
    }
    let window = windows.get(key);
    if (!window || now >= window.resetAt) {
      window = { count: 0, resetAt: now + WINDOW_MS };
      windows.set(key, window);
    }
    if (window.count >= max) return Math.ceil((window.resetAt - now) / 1000);
    window.count++;
    return null;
  };
}

/**
 * Limits requests per user, or per IP address when signed out, after `loadSession`.
 * Requests with an API key only count towards the costly routes' limit: the key has its own.
 */
export function rateLimit() {
  const count = fixedWindowCounter();
  return createMiddleware<AppEnv>(async (c, next) => {
    const who = c.get("user")?.id ?? `ip:${c.get("clientIp")}`;
    const costly = COSTLY_ROUTES.has(`${c.req.method} ${c.req.path}`);
    const retryAfter =
      (c.get("apiKeyId") ? null : count(who, REQUESTS_PER_MINUTE)) ??
      (costly ? count(`${who}:costly`, COSTLY_REQUESTS_PER_MINUTE) : null);
    if (retryAfter !== null) {
      c.header("Retry-After", String(retryAfter));
      return errorResponse(c, 429, "rate_limited", "Too many requests; try again shortly.");
    }
    await next();
  });
}

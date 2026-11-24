import * as Sentry from "@sentry/node";
import type { Env } from "./env";
import { logError, redactError } from "./errors";

/**
 * Sends unexpected errors to Sentry when `SENTRY_DSN` is set; without it, nothing
 * leaves the server. Only the error, its stack and the route: no request bodies,
 * headers, cookies, IPs, users or breadcrumbs, and no performance tracing. Every
 * error goes through `reportError`, so none is sent without being redacted.
 */
export function startErrorReporting(env: Env) {
  if (!env.SENTRY_DSN) return;
  Sentry.initWithoutDefaultIntegrations({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: env.SENTRY_RELEASE || undefined,
    // Every default collects; most only matter to integrations left out below, but turn them all off.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    maxBreadcrumbs: 0,
    // Only for instrumenting libraries, which none of the integrations below do.
    enableRuntimeChannelInjection: false,
    // Not Sentry's handlers for uncaught errors: they send and log them unredacted.
    integrations: [
      Sentry.linkedErrorsIntegration(),
      Sentry.dedupeIntegration(),
      Sentry.functionToStringIntegration(),
      Sentry.eventFiltersIntegration(),
      Sentry.nodeContextIntegration(),
    ],
    beforeSend(event) {
      delete event.request;
      delete event.user;
      return event;
    },
  });
}

/**
 * Reports an error a request or job ended in, or that nothing caught, without a failed
 * query's data. Does nothing when reporting is off.
 */
export function reportError(error: unknown, request?: { method: string; route: string }) {
  Sentry.captureException(redactError(error), request && { tags: { method: request.method, route: request.route } });
}

/**
 * Logs and reports the errors nothing caught, redacted, instead of Node printing them
 * whole. An uncaught exception still ends the process; a rejection doesn't.
 */
export function handleUncaughtErrors() {
  process.on("unhandledRejection", (reason) => {
    logError("Unhandled rejection:", reason);
    reportError(reason);
  });
  process.on("uncaughtException", (error) => {
    logError("Uncaught exception:", error);
    reportError(error);
    void stopErrorReporting().finally(() => process.exit(1));
  });
}

/** Sends what's still queued before the process exits. */
export async function stopErrorReporting() {
  await Sentry.close(2000);
}

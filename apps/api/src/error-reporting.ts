import * as Sentry from "@sentry/node";
import type { Env } from "./env";
import { redactError } from "./errors";

/**
 * Sends unexpected errors to Sentry when `SENTRY_DSN` is set; without it, nothing
 * leaves the server. Only the error, its stack and the route: no request bodies,
 * headers, cookies, IPs, users or breadcrumbs, and no performance tracing.
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
    integrations: [
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
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

/** Reports an error a request or job ended in, without a failed query's data. Does nothing when reporting is off. */
export function reportError(error: unknown, request: { method: string; route: string }) {
  Sentry.captureException(redactError(error), { tags: { method: request.method, route: request.route } });
}

/** Sends what's still queued before the process exits. */
export async function stopErrorReporting() {
  await Sentry.close(2000);
}

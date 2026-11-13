import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { AiProvider } from "./ai";
import { hasGoogleSignIn, type Auth } from "./auth";
import type { Billing } from "./billing";
import type { AppEnv } from "./context";
import type { Db } from "./db/client";
import type { Mailer } from "./email/mailer";
import type { Env } from "./env";
import { reportError } from "./error-reporting";
import { ApiError, describeIssues, errorResponse } from "./errors";
import { loadSession } from "./middleware";
import { accountRoutes } from "./routes/account";
import { apiKeyRoutes } from "./routes/api-keys";
import { billingRoutes } from "./routes/billing";
import { contactRoutes } from "./routes/contacts";
import { emailRoutes } from "./routes/emails";
import { fileRoutes } from "./routes/files";
import { recordRoutes } from "./routes/records";
import { metaRoutes } from "./routes/meta";
import { purchaseRoutes } from "./routes/purchases";
import { syncRoutes } from "./routes/sync";
import type { FileStorage } from "./storage";
import { serveWeb } from "./web";

interface Deps {
  db: Db;
  auth: Auth;
  env: Env;
  storage: FileStorage;
  /** Null when the instance can't send email. */
  mailer: Mailer | null;
  /** Null when the instance doesn't bill: self-hosted ones never do. */
  billing?: Billing | null;
  /** Null when the instance has no AI model to read documents with. */
  ai?: AiProvider | null;
}

/**
 * Builds the HTTP app. Everything lives under `/v1`, since the API will be public;
 * with `WEB_DIR`, the rest of the paths serve the web app.
 */
export function createApp({ db, auth, env, storage, mailer, billing = null, ai = null }: Deps) {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success)
        return errorResponse(c, 400, "invalid_request", describeIssues(result.error.issues) ?? "Invalid request.");
    },
  });

  // The API answers with data and uploaded files, never a page: nothing in it may run, load or be framed.
  app.use(
    "/v1/*",
    secureHeaders({
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], sandbox: [] },
      xFrameOptions: "DENY",
      strictTransportSecurity: "max-age=31536000; includeSubDomains",
    }),
  );
  // Preflights are remembered: the web app's background syncs send a header that needs one
  app.use("/v1/*", cors({ origin: env.WEB_ORIGIN, credentials: true, maxAge: 600 }));
  app.use("/v1/*", async (c, next) => {
    c.set("db", db);
    c.set("storage", storage);
    c.set("mailer", mailer);
    c.set("billing", billing);
    c.set("ai", ai);

    c.set("emailQuota", { daily: env.EMAIL_DAILY_RECIPIENTS, monthly: env.EMAIL_MONTHLY_RECIPIENTS });
    c.set("fileMaxBytes", env.FILE_MAX_BYTES);
    c.set("fileQuotaBytes", env.FILE_QUOTA_BYTES);
    c.set("checkBreachedPasswords", env.PASSWORD_BREACH_CHECK === "on");
    await next();
  });
  app.on(["GET", "POST"], "/v1/auth/*", (c) => auth.handler(c.req.raw));
  app.use("/v1/*", loadSession(auth));

  if (env.WEB_DIR) app.use("*", serveWeb(env.WEB_DIR));

  app.notFound((c) => errorResponse(c, 404, "not_found", "Not found."));
  app.onError((error, c) => {
    if (error instanceof ApiError) return errorResponse(c, error.status, error.code, error.message);
    // Hono's own rejections, such as a body that isn't valid JSON
    if (error instanceof HTTPException && error.status < 500) {
      return errorResponse(c, error.status, "invalid_request", error.message);
    }
    console.error(error);
    reportError(error, { method: c.req.method, route: c.req.routePath });
    return errorResponse(c, 500, "internal_error", "Something went wrong.");
  });

  // Not basePath(): OpenAPIHono's copy of the app drops the notFound handler.
  const routes = app
    .route(
      "/v1",
      metaRoutes(
        {
          google: hasGoogleSignIn(env),
          email: Boolean(mailer),
          billing: Boolean(billing),
        },
        env.SENTRY_RELEASE,
      ),
    )
    .route("/v1", accountRoutes)
    .route("/v1", syncRoutes)
    .route("/v1", contactRoutes)
    .route("/v1", recordRoutes)
    .route("/v1", purchaseRoutes)
    .route("/v1", fileRoutes)
    .route("/v1", emailRoutes)
    .route("/v1", apiKeyRoutes(auth));
  if (billing) routes.route("/v1", billingRoutes(billing, env.WEB_ORIGIN));
  routes.openAPIRegistry.registerComponent("securitySchemes", "apiKey", {
    type: "http",
    scheme: "bearer",
    description:
      "An API key (`fsk_…`) created in the app or with `POST /v1/api-keys`. The web app uses its session cookie.",
  });
  routes.doc31("/v1/openapi.json", {
    openapi: "3.1.0",
    info: { title: "cuentalibre API", version: "1" },
    security: [{ apiKey: [] }],
  });

  return routes;
}

/** Type of the app, for a typed client in the web app (`hc<AppType>`). */
export type AppType = ReturnType<typeof createApp>;

import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { hasGoogleSignIn, type Auth } from "./auth";
import type { AppEnv } from "./context";
import type { Db } from "./db/client";
import type { Mailer } from "./email/mailer";
import type { Env } from "./env";
import { ApiError, errorResponse } from "./errors";
import { loadSession } from "./middleware";
import { accountRoutes } from "./routes/account";
import { apiKeyRoutes } from "./routes/api-keys";
import { contactRoutes } from "./routes/contacts";
import { emailRoutes } from "./routes/emails";
import { fileRoutes } from "./routes/files";
import { recordRoutes } from "./routes/records";
import { metaRoutes } from "./routes/meta";
import { syncRoutes } from "./routes/sync";
import type { FileStorage } from "./storage";

interface Deps {
  db: Db;
  auth: Auth;
  env: Env;
  storage: FileStorage;
  /** Null when the instance can't send email. */
  mailer: Mailer | null;
}

/** Builds the HTTP app. Everything lives under `/v1`, since the API will be public. */
export function createApp({ db, auth, env, storage, mailer }: Deps) {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) return errorResponse(c, 400, "invalid_request", result.error.message);
    },
  });

  app.use("/v1/*", cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use("/v1/*", async (c, next) => {
    c.set("db", db);
    c.set("storage", storage);
    c.set("mailer", mailer);
    c.set("verifactuEnvironment", env.VERIFACTU_ENV === "test" ? "test" : "production");
    c.set("fileMaxBytes", env.FILE_MAX_BYTES);
    await next();
  });
  app.on(["GET", "POST"], "/v1/auth/*", (c) => auth.handler(c.req.raw));
  app.use("/v1/*", loadSession(auth));

  app.notFound((c) => errorResponse(c, 404, "not_found", "Not found."));
  app.onError((error, c) => {
    if (error instanceof ApiError) return errorResponse(c, error.status, error.code, error.message);
    console.error(error);
    return errorResponse(c, 500, "internal_error", "Something went wrong.");
  });

  // Not basePath(): OpenAPIHono's copy of the app drops the notFound handler.
  const routes = app
    .route("/v1", metaRoutes({ google: hasGoogleSignIn(env), email: Boolean(mailer) }))
    .route("/v1", accountRoutes)
    .route("/v1", syncRoutes)
    .route("/v1", contactRoutes)
    .route("/v1", recordRoutes)
    .route("/v1", fileRoutes)
    .route("/v1", emailRoutes)
    .route("/v1", apiKeyRoutes(auth));
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

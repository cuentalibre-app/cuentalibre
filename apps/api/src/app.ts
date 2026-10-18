import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import type { Auth } from "./auth";
import type { AppEnv } from "./context";
import type { Db } from "./db/client";
import type { Env } from "./env";
import { errorResponse } from "./errors";
import { loadSession } from "./middleware";
import { accountRoutes } from "./routes/account";
import { metaRoutes } from "./routes/meta";

interface Deps {
  db: Db;
  auth: Auth;
  env: Env;
}

/** Builds the HTTP app. Everything lives under `/v1`, since the API will be public. */
export function createApp({ db, auth, env }: Deps) {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) return errorResponse(c, 400, "invalid_request", result.error.message);
    },
  });

  app.use("/v1/*", cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use("/v1/*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.on(["GET", "POST"], "/v1/auth/*", (c) => auth.handler(c.req.raw));
  app.use("/v1/*", loadSession(auth));

  app.notFound((c) => errorResponse(c, 404, "not_found", "Not found."));
  app.onError((error, c) => {
    console.error(error);
    return errorResponse(c, 500, "internal_error", "Something went wrong.");
  });

  // Not basePath(): OpenAPIHono's copy of the app drops the notFound handler.
  const routes = app.route("/v1", metaRoutes).route("/v1", accountRoutes);
  routes.doc31("/v1/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Fiscalia API", version: "1" },
  });

  return routes;
}

/** Type of the app, for a typed client in the web app (`hc<AppType>`). */
export type AppType = ReturnType<typeof createApp>;

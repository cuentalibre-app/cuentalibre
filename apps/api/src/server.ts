import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { createDb } from "./db/client";
import { loadEnv } from "./env";
import { createStorage } from "./storage";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const app = createApp({ db, auth: createAuth(db, env), env, storage: createStorage(env) });

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}/v1`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { createBilling } from "./billing";
import { createDb } from "./db/client";
import { createAccountMailer, createMailer } from "./email/mailer";
import { emailHandler } from "./email/messages";
import { loadEnv } from "./env";
import { startErrorReporting, stopErrorReporting } from "./error-reporting";
import { startWorker } from "./outbox/worker";
import { createStorage } from "./storage";
import { censusHandler } from "./verifactu/check";
import { verifactuHandler } from "./verifactu/submit";
import { createVerifactuTransport } from "./verifactu/transport";

const env = loadEnv();
startErrorReporting(env);
const db = createDb(env.DATABASE_URL);
const storage = createStorage(env);
const mailer = createMailer(env);
const app = createApp({
  db,
  auth: createAuth(db, env, createAccountMailer(env)),
  env,
  storage,
  mailer,
  billing: createBilling(env),
});

const verifactuTransport = createVerifactuTransport(env);
const stopWorker = startWorker(db, {
  verifactu: verifactuHandler(db, verifactuTransport, {
    producerName: env.VERIFACTU_PRODUCER_NAME ?? "",
    producerTaxId: env.VERIFACTU_PRODUCER_TAX_ID ?? "",
    name: "cuentalibre",
    id: "FI",
    version: "1.0",
  }),
  census: censusHandler(db, verifactuTransport),
  email: emailHandler(db, storage, mailer),
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}/v1`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () =>
    server.close(() => void Promise.all([stopWorker(), stopErrorReporting()]).then(() => process.exit(0))),
  );
}

import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { createDb } from "./db/client";
import { createMailer } from "./email/mailer";
import { emailHandler } from "./email/messages";
import { loadEnv } from "./env";
import { startWorker } from "./outbox/worker";
import { createStorage } from "./storage";
import { verifactuHandler } from "./verifactu/submit";
import { createVerifactuTransport } from "./verifactu/transport";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const storage = createStorage(env);
const mailer = createMailer(env);
const app = createApp({ db, auth: createAuth(db, env, mailer), env, storage, mailer });

const stopWorker = startWorker(db, {
  verifactu: verifactuHandler(db, createVerifactuTransport(env), {
    producerName: env.VERIFACTU_PRODUCER_NAME ?? "",
    producerTaxId: env.VERIFACTU_PRODUCER_TAX_ID ?? "",
    name: "cuentalibre",
    id: "FI",
    version: "1.0",
  }),
  email: emailHandler(db, storage, mailer),
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}/v1`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => void stopWorker().then(() => process.exit(0))));
}

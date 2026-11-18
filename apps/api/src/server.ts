import { serve } from "@hono/node-server";
import { createAiProvider, createChatProvider } from "./ai";
import { loadHelpPrompt } from "./ai/help-guide";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { createBilling } from "./billing";
import { startRetention } from "./billing/retention-job";
import { createDb } from "./db/client";
import { createAccountMailer, createMailer } from "./email/mailer";
import { emailHandler } from "./email/messages";
import { loadEnv } from "./env";
import { startErrorReporting, stopErrorReporting } from "./error-reporting";
import { startWorker } from "./outbox/worker";
import { createStorage } from "./storage";

const env = loadEnv();
startErrorReporting(env);
const db = createDb(env.DATABASE_URL);
const storage = createStorage(env);
const mailer = createMailer(env);
const accountMailer = createAccountMailer(env);
const billing = createBilling(env);
const chatProvider = createChatProvider(env);
const app = createApp({
  db,
  auth: createAuth(db, env, accountMailer),
  env,
  storage,
  mailer,
  billing,
  ai: createAiProvider(env),
  chat: chatProvider && {
    provider: chatProvider,
    prompt: loadHelpPrompt(env.AI_CHAT_DOCS_DIR),
    dailyQuestions: env.AI_CHAT_DAILY_QUESTIONS,
  },
});

const stopWorker = startWorker(db, {
  email: emailHandler(db, storage, mailer),
});

// Only Cloud deletes organizations left read-only too long: self-hosted ones never go read-only
const stopRetention = billing
  ? startRetention({ db, storage, billing, mailer: accountMailer, webOrigin: env.WEB_ORIGIN })
  : async () => {};

const server = serve(
  {
    fetch: app.fetch,
    port: env.PORT,
    // A slow client can't hold a connection: its headers must arrive within 15 seconds and
    // the whole request, a 10 MB upload included, within two minutes.
    serverOptions: { headersTimeout: 15_000, requestTimeout: 120_000 },
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}/v1`);
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () =>
    server.close(
      () => void Promise.all([stopWorker(), stopRetention(), stopErrorReporting()]).then(() => process.exit(0)),
    ),
  );
}

import { serve } from "@hono/node-server";
import { createAiProvider, createChatProvider } from "./ai";
import { loadHelpPrompt } from "./ai/help-guide";
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

const env = loadEnv();
startErrorReporting(env);
const db = createDb(env.DATABASE_URL);
const storage = createStorage(env);
const mailer = createMailer(env);
const chatProvider = createChatProvider(env);
const app = createApp({
  db,
  auth: createAuth(db, env, createAccountMailer(env)),
  env,
  storage,
  mailer,
  billing: createBilling(env),
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

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}/v1`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () =>
    server.close(() => void Promise.all([stopWorker(), stopErrorReporting()]).then(() => process.exit(0))),
  );
}

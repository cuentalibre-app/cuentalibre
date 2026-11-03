import { emailHandler } from "../email/messages";
import { runDueJobs, type Handlers } from "../outbox/worker";
import { db, mailer, storage } from "./harness";

/** Runs the outbox jobs that are due. */
export function runJobs() {
  const handlers: Handlers = { email: emailHandler(db, storage, mailer) };
  return runDueJobs(db, handlers);
}

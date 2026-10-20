import type { EmailMessage, EmailRequest } from "@fiscalia/contracts";
import { currentBackend } from "./backend";

/*
 * Email sent by the server. Without a backend that sends it (the demo, or
 * before signing in), the app falls back to the user's mail client.
 */

/** Whether the server sends email for the app. */
export const canSendEmail = () => currentBackend().sendEmail !== undefined;

export function sendEmail(email: Omit<EmailRequest, "attachments">, files: File[]): Promise<EmailMessage> {
  const backend = currentBackend();
  if (!backend.sendEmail) return Promise.reject(new Error("Email isn't available."));
  return backend.sendEmail(email, files);
}

/** The emails that sent a document, newest first; none without a server. */
export function emailsOf(documentId: string): Promise<EmailMessage[]> {
  return currentBackend().emailsOf?.(documentId) ?? Promise.resolve([]);
}

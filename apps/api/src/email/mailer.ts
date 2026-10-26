import { createTransport } from "nodemailer";
import type { Env } from "../env";

export interface OutgoingEmail {
  /** The sender's display name; the address is the instance's. */
  fromName: string;
  replyTo?: string;
  to: string[];
  cc: string[];
  bcc?: string[];
  subject: string;
  text: string;
  /** A designed version of `text`, for clients that show HTML. */
  html?: string;
  attachments: { filename: string; contentType: string; content: Uint8Array }[];
}

/** A server's refusal that retrying won't change, such as an unknown mailbox. */
export class PermanentEmailError extends Error {}

/** Sends email: over SMTP, or into memory in tests. */
export interface Mailer {
  /** The address emails go out from. */
  readonly address: string;
  send(email: OutgoingEmail): Promise<void>;
}

/** Over SMTP, from `EMAIL_FROM`. */
export function smtpMailer(url: string, fromAddress: string): Mailer {
  const transport = createTransport(url);
  return {
    address: fromAddress,
    async send(email) {
      try {
        await transport.sendMail({
          from: { name: email.fromName, address: fromAddress },
          replyTo: email.replyTo,
          to: email.to,
          cc: email.cc,
          bcc: email.bcc,
          subject: email.subject,
          text: email.text,
          html: email.html,
          attachments: email.attachments.map((file) => ({
            filename: file.filename,
            contentType: file.contentType,
            content: Buffer.from(file.content),
          })),
        });
      } catch (error) {
        // 5xx SMTP replies are final; anything else (network, 4xx) is worth retrying
        const code = (error as { responseCode?: number }).responseCode;
        if (code && code >= 500) throw new PermanentEmailError((error as Error).message);
        throw error;
      }
    },
  };
}

export function createMailer(env: Env): Mailer | null {
  return env.SMTP_URL && env.EMAIL_FROM ? smtpMailer(env.SMTP_URL, env.EMAIL_FROM) : null;
}

/** For emails about people's accounts, from `ACCOUNT_EMAIL_FROM`: they come from cuentalibre, not a business. */
export function createAccountMailer(env: Env): Mailer | null {
  const from = env.ACCOUNT_EMAIL_FROM ?? env.EMAIL_FROM;
  return env.SMTP_URL && from ? smtpMailer(env.SMTP_URL, from) : null;
}

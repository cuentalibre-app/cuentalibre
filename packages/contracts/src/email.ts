import { z } from "zod";
import { id } from "./common";
import { salesKindSchema } from "./sales";

/** An email sent from cuentalibre, such as an invoice to its client. Its attachments are uploaded files. */
export const emailRequestSchema = z.object({
  /** The sales document the email sends: every email sends one, so the route can't carry anything else. */
  documentId: z.uuid(),
  to: z.array(z.email()).min(1).max(10),
  cc: z.array(z.email()).max(10).default([]),
  /** Where replies go; by default the business's email, or the user's. */
  replyTo: z.email().optional(),
  /** Also sends a blind copy to the user who sends it (the API key's user). */
  bccMe: z.boolean().default(false),
  subject: z.string().trim().min(1).max(200),
  body: z.string().max(20_000),
  /** IDs of uploaded files (`POST /v1/files`). */
  attachments: z.array(z.uuid()).max(10).default([]),
});
export type EmailRequest = z.input<typeof emailRequestSchema>;

/** Emails are queued and sent in the background. */
export const emailStatusSchema = z.enum(["queued", "sent", "failed"]);
export type EmailStatus = z.infer<typeof emailStatusSchema>;

export const emailMessageSchema = z.object({
  id: z.uuid(),
  documentId: z.uuid().nullable(),
  to: z.array(z.email()),
  cc: z.array(z.email()),
  bcc: z.array(z.email()),
  replyTo: z.string().nullable(),
  subject: z.string(),
  status: emailStatusSchema,
  /** Why it failed, or why the last attempt did. */
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
  sentAt: z.iso.datetime().nullable(),
});
export type EmailMessage = z.infer<typeof emailMessageSchema>;

/** Who emails go out from: the business's name at the instance's address, so they pass spam checks. */
export const emailSenderSchema = z.object({
  name: z.string(),
  address: z.email(),
  /** Where replies go unless the email says otherwise. */
  replyTo: z.string().nullable(),
});
export type EmailSender = z.infer<typeof emailSenderSchema>;

/**
 * A saved subject and message for emailing one kind of sales document. Its
 * `{{placeholders}}` (the document's number, total, client…) are filled in
 * when the email is written.
 */
export const emailTemplateSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  kind: salesKindSchema,
  subject: z.string().max(200),
  body: z.string().max(20_000),
});
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;

export const emailTemplateSettingsSchema = z
  .object({
    templates: z.array(emailTemplateSchema).max(100),
    /** The template each kind of document starts with; absent means cuentalibre's own text. */
    defaults: z.partialRecord(salesKindSchema, id),
  })
  .superRefine((settings, ctx) => {
    for (const [kind, templateId] of Object.entries(settings.defaults)) {
      if (!settings.templates.some((t) => t.id === templateId && t.kind === kind))
        ctx.addIssue({
          code: "custom",
          path: ["defaults", kind],
          message: `The default ${kind} template must be one of the ${kind} templates.`,
        });
    }
  });
export type EmailTemplateSettings = z.infer<typeof emailTemplateSettingsSchema>;

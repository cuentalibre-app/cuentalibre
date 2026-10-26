import { useEffect, useRef, useState } from "react";
import { CircleAlert, Loader2, Paperclip } from "lucide-react";
import { Link } from "react-router";
import type { EmailMessage, EmailSender, SalesDocument } from "@cuentalibre/contracts";
import { Badge, type BadgeProps } from "@cuentalibre/ui/components/badge";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Checkbox, Input, Textarea } from "@cuentalibre/ui/components/input";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { ApiError } from "@/data/api";
import { emailSender, emailsOf, sendEmail } from "@/data/email";
import { VerifyEmailDialog } from "@/features/auth/email-code";
import { userStore, useEmailVerified, useUserSettings } from "@/features/settings/user-store";
import { EMAIL_TEMPLATES_PATH, businessName } from "@/features/settings/settings-model";
import { useSettings } from "@/features/settings/settings-store";
import { formatDate } from "@/lib/format";
import { TagsField } from "./document-editor";
import { BUILT_IN_TEMPLATE, defaultTemplateId, templatesFor, writeEmail } from "./email-templates";
import { useEmailTemplates } from "./email-templates-store";
import { Field, GroupedSelect } from "./form-fields";
import { STATUS, clientOf, displayStatus, documentFileName, documentTotals, KINDS, withPayments } from "./sales-model";
import { salesStore, useSalesDocuments } from "./sales-store";
import { PaymentsDialog } from "./payments-dialog";

/* Dialogs opened from a document's actions menu in the lists. */

interface DialogProps {
  doc: SalesDocument;
  onOpenChange: (open: boolean) => void;
}

/** Collections of an invoice. Changes apply at once. */
export function PaymentDialog({ doc, onOpenChange }: DialogProps) {
  const current = useSalesDocuments().find((d) => d.id === doc.id) ?? doc;
  const { total } = documentTotals(current);
  const status = STATUS[displayStatus(current, new Date())];
  return (
    <PaymentsDialog
      side="collection"
      description={`Cobros de la factura ${current.number}, por un total de ${formatEUR(total)}. Registra lo cobrado, todo o una parte.`}
      total={total}
      payments={current.payments ?? []}
      status={<Badge tone={status.tone}>{status.label}</Badge>}
      onChange={(next) => salesStore.update(current.id, withPayments(current, next))}
      onOpenChange={onOpenChange}
    />
  );
}

export function TagsDialog({ doc, title, onOpenChange }: DialogProps & { title: string }) {
  const [tags, setTags] = useState(doc.tags ?? []);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Etiquetas de {title}</DialogTitle>
        <DialogDescription>
          Escribe una etiqueta y pulsa Intro. Las de Configuración › Etiquetas aparecen como sugerencias.
        </DialogDescription>
        <TagsField tags={tags} onChange={setTags} />
        <div className="flex justify-end gap-2.5 pt-1">
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            onClick={() => {
              salesStore.update(doc.id, { tags: tags.length ? tags : undefined });
              onOpenChange(false);
            }}
          >
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const EMAIL_STATUS: Record<EmailMessage["status"], { label: string; tone: BadgeProps["tone"] }> = {
  queued: { label: "Enviando", tone: "primary" },
  sent: { label: "Enviado", tone: "success" },
  failed: { label: "No enviado", tone: "danger" },
};

const splitEmails = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Without a server that sends email: download the PDF and open the mail client to attach it. */
export function sendWithMailClient(doc: SalesDocument) {
  void import("./sales-pdf").then((m) => m.downloadDocumentPdf(doc));
  const subject = `${KINDS[doc.kind].singular} ${doc.number ?? ""}`.trim();
  window.location.href = `mailto:${clientOf(doc).email ?? ""}?subject=${encodeURIComponent(subject)}`;
}

/** Emails a document to its client with its PDF attached. The server sends it in the background. */
export function SendDialog({ doc, onOpenChange }: DialogProps) {
  const { profile } = useSettings();
  const config = KINDS[doc.kind];
  const name =
    `${doc.series === "rectifying" ? "factura rectificativa" : config.singular.toLowerCase()} ${doc.number ?? ""}`.trim();
  const [to, setTo] = useState(clientOf(doc).email ?? "");
  const [cc, setCc] = useState("");
  // Null until edited: then it follows the server's default
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [bccMe, setBccMe] = useState(true);
  const toInput = useRef<HTMLInputElement>(null);
  const templates = useEmailTemplates();
  const [templateId, setTemplateId] = useState(() => defaultTemplateId(templates, doc.kind));
  const [subject, setSubject] = useState(() => writeEmail(templates, templateId, doc, profile).subject);
  const [body, setBody] = useState(() => writeEmail(templates, templateId, doc, profile).body);
  const pickTemplate = (id: string) => {
    const email = writeEmail(templates, id, salesStore.get(doc.id) ?? doc, profile);
    setTemplateId(id);
    setSubject(email.subject);
    setBody(email.body);
  };
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<EmailMessage[]>([]);
  const [sender, setSender] = useState<EmailSender | null>(null);
  // The server only sends for users who verified their email
  const verified = useEmailVerified();
  const { profile: account } = useUserSettings();
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let live = true;
    emailsOf(doc.id)
      .then((emails) => live && setHistory(emails))
      .catch(() => undefined);
    emailSender()
      .then((found) => live && setSender(found))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [doc.id]);

  const recipients = splitEmails(to);
  const copies = splitEmails(cc);
  const replyAddress = (replyTo ?? sender?.replyTo ?? "").trim();
  const errors = {
    to:
      recipients.length === 0
        ? "Indica al menos un destinatario."
        : recipients.some((e) => !EMAIL_RE.test(e))
          ? "Algún email no es válido."
          : undefined,
    cc: copies.some((e) => !EMAIL_RE.test(e)) ? "Algún email no es válido." : undefined,
    replyTo: replyAddress && !EMAIL_RE.test(replyAddress) ? "El email no es válido." : undefined,
    subject: subject.trim() ? undefined : "Escribe un asunto.",
  };
  const shown: Partial<typeof errors> = submitted ? errors : {};

  const submit = async () => {
    setSubmitted(true);
    if (!verified || errors.to || errors.cc || errors.replyTo || errors.subject) return;
    setSending(true);
    setError(null);
    try {
      // The current version: an issued invoice may have just got its number from the server
      const current = salesStore.get(doc.id) ?? doc;
      const { documentPdfFile } = await import("./sales-pdf");
      await sendEmail(
        {
          documentId: current.id,
          to: recipients,
          cc: copies,
          ...(replyAddress && { replyTo: replyAddress }),
          bccMe,
          subject: subject.trim(),
          body,
        },
        [documentPdfFile(current)],
      );
      onOpenChange(false);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : null;
      setError(
        code === "email_unavailable"
          ? "Este servidor no tiene configurado el envío de correo."
          : code === "subscription_required"
            ? "Tu empresa está en solo lectura. Suscríbete para volver a enviar documentos."
            : code === "email_unverified"
              ? "Verifica tu email para enviar documentos desde cuentalibre."
              : code === "email_quota_exceeded"
                ? "Has llegado al límite de destinatarios de tu empresa por hoy o por este mes. Inténtalo más adelante."
                : code === "storage_quota_exceeded"
                  ? "Tu empresa ha llegado al límite de espacio para archivos, así que no se puede adjuntar el PDF."
                  : "No se ha podido enviar. Inténtalo de nuevo en un momento.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        onOpenAutoFocus={(e) => {
          // The recipient is what people fill first, though the sender's fields come above it
          e.preventDefault();
          toInput.current?.focus();
        }}
      >
        <DialogTitle>Enviar {name}</DialogTitle>
        <DialogDescription>Se envía con el PDF adjunto, a nombre de tu negocio.</DialogDescription>
        <TooltipProvider delayDuration={300} skipDelayDuration={300}>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {!verified && (
              <div
                role="status"
                className="flex flex-col gap-3 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-foreground sm:flex-row sm:items-center"
              >
                <p className="m-0 flex flex-1 gap-2">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.8} aria-hidden="true" />
                  <span>Verifica tu email para enviar documentos desde cuentalibre.</span>
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="self-start sm:self-auto"
                  onClick={() => setVerifying(true)}
                >
                  Verificar mi email
                </Button>
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">De</span>
              <p className="m-0 min-w-0 truncate text-sm">
                {sender?.name ?? businessName(profile)}
                {sender && <span className="text-muted-foreground"> &lt;{sender.address}&gt;</span>}
              </p>
            </div>
            <Field
              label="Responder a"
              error={shown.replyTo}
              help="El email al que llegan las respuestas si quien recibe el correo contesta."
            >
              {(p) => <Input {...p} type="email" value={replyAddress} onChange={(e) => setReplyTo(e.target.value)} />}
            </Field>
            <label className="-mt-1 flex cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox className="mt-px" checked={bccMe} onChange={(e) => setBccMe(e.target.checked)} />
              <span className="min-w-0">
                Enviarme una copia oculta
                {account.email && <span className="text-muted-foreground"> a {account.email}</span>}
              </span>
            </label>
            <Field
              label="Plantilla"
              action={
                <Link to={EMAIL_TEMPLATES_PATH} className="text-sm text-primary">
                  Gestionar plantillas
                </Link>
              }
            >
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={templateId}
                  onChange={pickTemplate}
                  groups={[
                    {
                      options: [
                        { value: BUILT_IN_TEMPLATE, label: "Texto de cuentalibre" },
                        ...templatesFor(templates, doc.kind).map((t) => ({ value: t.id, label: t.name })),
                      ],
                    },
                  ]}
                />
              )}
            </Field>
            <Field label="Para" required error={shown.to} hint="Separa varios emails con comas.">
              {(p) => (
                <Input {...p} ref={toInput} type="email" multiple value={to} onChange={(e) => setTo(e.target.value)} />
              )}
            </Field>
            <Field label="CC" error={shown.cc}>
              {(p) => <Input {...p} type="email" multiple value={cc} onChange={(e) => setCc(e.target.value)} />}
            </Field>
            <Field label="Asunto" required error={shown.subject}>
              {(p) => <Input {...p} value={subject} onChange={(e) => setSubject(e.target.value)} />}
            </Field>
            <Field label="Mensaje">
              {(p) => <Textarea {...p} rows={6} value={body} onChange={(e) => setBody(e.target.value)} />}
            </Field>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">Adjunto</span>
              <button
                type="button"
                title="Ver el PDF"
                onClick={() => {
                  // Opened now, while the click still counts, and filled once the PDF code loads
                  const tab = window.open("", "_blank");
                  const current = salesStore.get(doc.id) ?? doc;
                  if (tab) void import("./sales-pdf").then((m) => m.showDocumentPdf(current, tab));
                }}
                className="flex min-w-0 cursor-pointer items-center gap-2 self-start rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Paperclip className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
                <span className="min-w-0 truncate">{documentFileName(doc, "pdf")}</span>
              </button>
            </div>

            {history.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                <span className="text-xs font-medium text-muted-foreground">Envíos anteriores</span>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
                  {history.map((email) => (
                    <li key={email.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Badge tone={EMAIL_STATUS[email.status].tone}>{EMAIL_STATUS[email.status].label}</Badge>
                      <span className="min-w-0 truncate">{email.to.join(", ")}</span>
                      <span className="text-muted-foreground">{formatDate(email.createdAt.slice(0, 10))}</span>
                      {email.status === "failed" && email.error && (
                        <span className="w-full text-xs text-destructive">{email.error}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <p role="alert" className="m-0 rounded-lg bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2.5 pt-1">
              <DialogClose asChild>
                <Button variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={sending || !verified}>
                {sending && <Loader2 className="animate-spin" aria-hidden="true" />}
                Enviar
              </Button>
            </div>
          </form>
        </TooltipProvider>
        <VerifyEmailDialog
          email={account.email}
          open={verifying}
          onOpenChange={setVerifying}
          onVerified={(verifiedEmail) => {
            userStore.emailVerified(verifiedEmail);
            setError(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

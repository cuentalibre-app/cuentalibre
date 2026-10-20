import { useEffect, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import type { EmailMessage, SalesDocument } from "@fiscalia/contracts";
import { Badge, type BadgeProps } from "@fiscalia/ui/components/badge";
import { Button } from "@fiscalia/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@fiscalia/ui/components/dialog";
import { Input, Textarea } from "@fiscalia/ui/components/input";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { ApiError } from "@/data/api";
import { emailsOf, sendEmail } from "@/data/email";
import { businessName } from "@/features/settings/settings-model";
import { useSettings } from "@/features/settings/settings-store";
import { formatDate } from "@/lib/format";
import { TagsField } from "./document-editor";
import { Field } from "./form-fields";
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
  const [subject, setSubject] = useState(`${name.charAt(0).toUpperCase()}${name.slice(1)} · ${businessName(profile)}`);
  const [body, setBody] = useState(
    `Hola,\n\nTe adjunto la ${name} por importe de ${formatEUR(documentTotals(doc).total)}.\n\nUn saludo,\n${businessName(profile)}`,
  );
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<EmailMessage[]>([]);

  useEffect(() => {
    let live = true;
    emailsOf(doc.id)
      .then((emails) => live && setHistory(emails))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [doc.id]);

  const recipients = splitEmails(to);
  const copies = splitEmails(cc);
  const errors = {
    to:
      recipients.length === 0
        ? "Indica al menos un destinatario."
        : recipients.some((e) => !EMAIL_RE.test(e))
          ? "Algún email no es válido."
          : undefined,
    cc: copies.some((e) => !EMAIL_RE.test(e)) ? "Algún email no es válido." : undefined,
    subject: subject.trim() ? undefined : "Escribe un asunto.",
  };
  const shown: Partial<typeof errors> = submitted ? errors : {};

  const submit = async () => {
    setSubmitted(true);
    if (errors.to || errors.cc || errors.subject) return;
    setSending(true);
    setError(null);
    try {
      // The current version: an issued invoice may have just got its number from the server
      const current = salesStore.get(doc.id) ?? doc;
      const { documentPdfFile } = await import("./sales-pdf");
      await sendEmail({ documentId: current.id, to: recipients, cc: copies, subject: subject.trim(), body }, [
        documentPdfFile(current),
      ]);
      onOpenChange(false);
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "email_unavailable"
          ? "Este servidor no tiene configurado el envío de correo. Usa tu programa de correo."
          : "No se ha podido enviar. Inténtalo de nuevo en un momento.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Enviar {name}</DialogTitle>
        <DialogDescription>
          Se envía con el PDF adjunto, a tu nombre. Las respuestas llegan a {profile.email.trim() || "tu email"}.
        </DialogDescription>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Para" required error={shown.to} hint="Separa varios emails con comas.">
            {(p) => <Input {...p} type="email" multiple value={to} onChange={(e) => setTo(e.target.value)} />}
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
          <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
            <Paperclip className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            {documentFileName(doc, "pdf")}
          </p>

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
            <Button variant="ghost" className="mr-auto" onClick={() => sendWithMailClient(doc)}>
              Usar mi programa de correo
            </Button>
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={sending}>
              {sending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Enviar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

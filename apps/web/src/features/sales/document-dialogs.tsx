import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { amountOutstanding, newId, toIsoDate } from "@fiscalia/core";
import type { EmailMessage, Payment, SalesDocument } from "@fiscalia/contracts";
import { Badge, type BadgeProps } from "@fiscalia/ui/components/badge";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import { cn } from "@fiscalia/ui/lib/cn";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@fiscalia/ui/components/dialog";
import { Input, Textarea } from "@fiscalia/ui/components/input";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { ApiError } from "@/data/api";
import { emailsOf, sendEmail } from "@/data/email";
import {
  businessName,
  defaultPaymentMethodId,
  paymentMethodName,
  paymentMethodOptions,
} from "@/features/settings/settings-model";
import { useSettings } from "@/features/settings/settings-store";
import { formatDate, formatEurosInput, parseEuros } from "@/lib/format";
import { TagsField } from "./document-editor";
import { Field, GroupedSelect } from "./form-fields";
import {
  STATUS,
  clientOf,
  displayStatus,
  documentFileName,
  documentTotals,
  KINDS,
  outstandingOf,
  withPayments,
} from "./sales-model";
import { salesStore, useSalesDocuments } from "./sales-store";

/* Dialogs opened from a document's actions menu in the lists. */

interface DialogProps {
  doc: SalesDocument;
  onOpenChange: (open: boolean) => void;
}

/**
 * Collections of an invoice, as in Contasimple: register what was collected (all of
 * it, or part), see the collections so far and remove a wrong one. Changes apply at once.
 */
export function PaymentDialog({ doc, onOpenChange }: DialogProps) {
  const current = useSalesDocuments().find((d) => d.id === doc.id) ?? doc;
  const payments = current.payments ?? [];
  const pending = outstandingOf(current);
  const { total } = documentTotals(current);
  const status = displayStatus(current, new Date());
  const [amount, setAmount] = useState(formatEurosInput(pending));
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [methodId, setMethodId] = useState(payments.at(-1)?.paymentMethodId ?? defaultPaymentMethodId());
  const [submitted, setSubmitted] = useState(false);

  const parsed = parseEuros(amount);
  const error =
    parsed === null || parsed === 0
      ? "Indica la cantidad cobrada."
      : Math.sign(parsed) !== Math.sign(total) || Math.abs(parsed) > Math.abs(pending)
        ? `No puede superar lo pendiente de cobro (${formatEUR(pending)}).`
        : undefined;

  const save = (next: Payment[]) => {
    salesStore.update(current.id, withPayments(current, next));
    setAmount(
      formatEurosInput(
        amountOutstanding(
          total,
          next.map((p) => p.amount),
        ),
      ),
    );
    setSubmitted(false);
  };
  const register = () => {
    setSubmitted(true);
    if (error || parsed === null || !date || !methodId) return;
    save([...payments, { id: newId(), date, amount: parsed, paymentMethodId: methodId }]);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Gestión de cobros</DialogTitle>
        <DialogDescription>
          Cobros de la factura {current.number}, por un total de {formatEUR(total)}. Registra lo cobrado, todo o una
          parte.
        </DialogDescription>
        {pending === 0 ? (
          <p className="m-0 rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success">
            La factura está cobrada por completo. Si un cobro está mal, quítalo y vuelve a registrarlo.
          </p>
        ) : (
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              register();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cantidad cobrada" required error={submitted ? error : undefined}>
                {(p) => (
                  <span className="relative flex items-center">
                    <Input
                      {...p}
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pr-7 text-right amount"
                    />
                    <span
                      className="pointer-events-none absolute right-3 text-sm text-muted-foreground"
                      aria-hidden="true"
                    >
                      €
                    </span>
                  </span>
                )}
              </Field>
              <Field label="Fecha" required>
                {(p) => <Input {...p} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}
              </Field>
              <Field label="Método de cobro" required>
                {(p) => (
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1 [&>*]:w-full">
                      <GroupedSelect
                        {...p}
                        value={methodId}
                        onChange={setMethodId}
                        groups={[{ options: paymentMethodOptions(methodId) }]}
                      />
                    </div>
                    <Link
                      to="/configuracion/metodos-de-pago"
                      className={cn(buttonVariants({ variant: "ghost", size: "md" }), "shrink-0 px-2.5 text-primary")}
                    >
                      <Plus aria-hidden="true" />
                      Nuevo método
                    </Link>
                  </div>
                )}
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Estado de la factura</span>
                <span className="flex min-h-10 flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
                  {pending !== 0 && pending !== total && <span>Quedan {formatEUR(pending)}</span>}
                </span>
              </div>
            </div>
            <div className="flex justify-center">
              <Button type="submit">Registrar</Button>
            </div>
          </form>
        )}

        <section aria-labelledby="cobros-realizados" className="overflow-hidden rounded-lg border border-border">
          <h3 id="cobros-realizados" className="m-0 border-b border-border px-3 py-2.5 text-sm font-semibold">
            Cobros realizados hasta la fecha
          </h3>
          {payments.length === 0 ? (
            <p className="m-0 px-3 py-4 text-center text-sm text-muted-foreground">Todavía no hay cobros.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Fecha</th>
                  <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                  <th className="px-3 py-2 text-left font-medium">Método de cobro</th>
                  <th className="w-12 px-3 py-2">
                    <span className="sr-only">Operaciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-1.5">{formatDate(p.date)}</td>
                    <td className="px-3 py-1.5 text-right amount">{formatEUR(p.amount)}</td>
                    <td className="px-3 py-1.5">{paymentMethodName(p.paymentMethodId) ?? "Sin método"}</td>
                    <td className="px-1.5 py-1 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Quitar el cobro del ${formatDate(p.date)}`}
                        onClick={() => save(payments.filter((x) => x.id !== p.id))}
                        className="size-8 px-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 strokeWidth={1.8} aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className="flex justify-end">
          <DialogClose asChild>
            <Button variant="secondary">Cerrar</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
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

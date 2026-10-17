import { useState, type CSSProperties } from "react";
import { AtSign, CircleCheck, Inbox, Loader2, Mail, Server, Unplug, type LucideIcon } from "lucide-react";
import { Button } from "@fiscalia/ui/components/button";
import { Input } from "@fiscalia/ui/components/input";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { CheckField, Field, GroupedSelect, Section } from "@/features/sales/form-fields";
import type { Option } from "@/features/sales/sales-model";
import type { EmailProvider, EmailSettings, SmtpSecurity, SmtpSettings } from "@/mocks/users";
import { SaveButton, SettingsHeader, useDraft } from "./settings-parts";
import { useSettings } from "./settings-store";
import { useEmailSettings, usersStore } from "./users-store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PROVIDERS: { value: EmailProvider; title: string; description: string; icon: LucideIcon }[] = [
  {
    value: "fiscalia",
    title: "Fiscalia",
    description:
      "Los correos se envían desde una dirección de Fiscalia, con tu nombre como remitente y tu email para las respuestas.",
    icon: Mail,
  },
  { value: "gmail", title: "Gmail", description: "Para cuentas de Gmail o Google Workspace.", icon: AtSign },
  { value: "outlook", title: "Outlook", description: "Para cuentas de Outlook, Hotmail y Live.", icon: Inbox },
  {
    value: "smtp",
    title: "Servidor propio",
    description: "Para enviar desde el servidor de correo de tu dominio.",
    icon: Server,
  },
];

const SECURITY: Option<SmtpSecurity>[] = [
  { value: "none", label: "Ninguno" },
  { value: "auto", label: "Auto" },
  { value: "implicit", label: "TLS/SSL implícito" },
  { value: "explicit", label: "TLS/SSL explícito (STARTTLS)" },
];

type SmtpErrors = Partial<Record<keyof SmtpSettings, string>>;

function smtpErrors(smtp: SmtpSettings): SmtpErrors {
  const errors: SmtpErrors = {};
  const required = "Este campo es obligatorio.";
  if (!smtp.displayName.trim()) errors.displayName = required;
  if (!smtp.email.trim()) errors.email = required;
  else if (!EMAIL_RE.test(smtp.email.trim())) errors.email = "El email no es válido.";
  if (!smtp.username.trim()) errors.username = required;
  if (!smtp.password) errors.password = required;
  if (!smtp.server.trim()) errors.server = required;
  const port = Number(smtp.port);
  if (!smtp.port.trim()) errors.port = required;
  else if (!Number.isInteger(port) || port < 1 || port > 65535) errors.port = "Escribe un puerto entre 1 y 65535.";
  return errors;
}

/** Outgoing email: who sends the invoices, quotes and reminders you email from Fiscalia. */
export function EmailSettingsPage() {
  const saved = useEmailSettings();
  const { profile } = useSettings();
  const { draft, setDraft, set, dirty, justSaved, markSaved } = useDraft<EmailSettings>(saved);
  const [submitted, setSubmitted] = useState(false);
  const [test, setTest] = useState<"idle" | "testing" | "ok">("idle");

  const setSmtp = <K extends keyof SmtpSettings>(key: K, value: SmtpSettings[K]) => {
    setDraft((d) => ({ ...d, smtp: { ...d.smtp, [key]: value } }));
    setTest("idle");
  };
  const errors = draft.provider === "smtp" ? smtpErrors(draft.smtp) : {};
  const shownErrors = submitted ? errors : {};
  const oauth = draft.provider === "gmail" || draft.provider === "outlook" ? draft.provider : null;
  const notConnected = oauth !== null && !draft.connected[oauth];

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0 || notConnected) return;
    usersStore.updateEmail(draft);
    markSaved();
  };

  // No OAuth without a backend: connecting signs in with the business email
  const connect = (provider: "gmail" | "outlook", email: string | null) =>
    setDraft((d) => ({ ...d, connected: { ...d.connected, [provider]: email } }));

  const testConnection = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    setTest("testing");
    setTimeout(() => setTest("ok"), 900);
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-6 lg:px-8">
        <SettingsHeader
          title="Configuración de correo"
          description="Desde qué dirección se envían las facturas, presupuestos y avisos que mandas por email."
        >
          <SaveButton dirty={dirty} justSaved={justSaved} onSave={save} />
        </SettingsHeader>

        <Section title="Configura tu proveedor de correo" index={0}>
          <div role="radiogroup" aria-label="Proveedor de correo" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PROVIDERS.map((p, i) => {
              const selected = draft.provider === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    set("provider", p.value);
                    setSubmitted(false);
                  }}
                  className={cn(
                    "flex animate-rise-in cursor-pointer flex-col items-start gap-2 rounded-xl border bg-transparent p-4 text-left text-foreground transition-[background-color,border-color] duration-150 hover:bg-accent",
                    selected ? "border-primary ring-1 ring-primary" : "border-border",
                  )}
                  style={{ "--i": i } as CSSProperties}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg",
                        selected ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary",
                      )}
                    >
                      <p.icon className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-[18px] rounded-full border-2",
                        selected ? "border-[5px] border-primary" : "border-input",
                      )}
                    />
                  </span>
                  <span className="font-semibold">{p.title}</span>
                  <span className="text-sm text-muted-foreground">{p.description}</span>
                </button>
              );
            })}
          </div>

          {oauth && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
              {draft.connected[oauth] ? (
                <>
                  <span className="flex items-center gap-2 text-sm">
                    <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
                    Conectada como <strong className="font-semibold">{draft.connected[oauth]}</strong>
                  </span>
                  <Button variant="secondary" size="md" onClick={() => connect(oauth, null)}>
                    <Unplug aria-hidden="true" />
                    Desconectar
                  </Button>
                </>
              ) : (
                <>
                  <span className={cn("text-sm", submitted ? "text-destructive" : "text-muted-foreground")}>
                    Conecta tu cuenta de {oauth === "gmail" ? "Google" : "Microsoft"} para enviar los correos desde
                    ella.
                  </span>
                  <Button size="md" onClick={() => connect(oauth, profile.email)}>
                    Conectar cuenta
                  </Button>
                </>
              )}
            </div>
          )}

          {draft.provider === "smtp" && (
            <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre a mostrar" required error={shownErrors.displayName}>
                  {(p) => (
                    <Input
                      {...p}
                      value={draft.smtp.displayName}
                      placeholder="Lucía Martín"
                      onChange={(e) => setSmtp("displayName", e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Correo electrónico" required error={shownErrors.email}>
                  {(p) => (
                    <Input
                      {...p}
                      type="email"
                      spellCheck={false}
                      value={draft.smtp.email}
                      placeholder="facturas@midominio.es"
                      onChange={(e) => setSmtp("email", e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Nombre de usuario" required error={shownErrors.username}>
                  {(p) => (
                    <Input
                      {...p}
                      autoComplete="off"
                      spellCheck={false}
                      value={draft.smtp.username}
                      onChange={(e) => setSmtp("username", e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Contraseña" required error={shownErrors.password}>
                  {(p) => (
                    <Input
                      {...p}
                      type="password"
                      autoComplete="new-password"
                      value={draft.smtp.password}
                      onChange={(e) => setSmtp("password", e.target.value)}
                    />
                  )}
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)]">
                <Field label="Servidor de salida (SMTP)" required error={shownErrors.server}>
                  {(p) => (
                    <Input
                      {...p}
                      spellCheck={false}
                      value={draft.smtp.server}
                      placeholder="smtp.midominio.es"
                      onChange={(e) => setSmtp("server", e.target.value)}
                    />
                  )}
                </Field>
                <Field
                  label="Puerto"
                  required
                  error={shownErrors.port}
                  help="Normalmente 587 con STARTTLS, 465 con TLS/SSL implícito o 25 sin cifrado."
                >
                  {(p) => (
                    <Input
                      {...p}
                      inputMode="numeric"
                      value={draft.smtp.port}
                      placeholder="587"
                      onChange={(e) => setSmtp("port", e.target.value.replace(/\D/g, ""))}
                    />
                  )}
                </Field>
                <Field label="TLS/SSL">
                  {(p) => (
                    <GroupedSelect
                      {...p}
                      value={draft.smtp.security}
                      onChange={(v) => setSmtp("security", v as SmtpSecurity)}
                      groups={[{ options: SECURITY }]}
                    />
                  )}
                </Field>
              </div>
              <CheckField
                label="Guardar copia del mensaje enviado en el servidor"
                hint="Los correos aparecerán en la carpeta de enviados de tu cuenta."
                checked={draft.smtp.saveCopy}
                onChange={(v) => setSmtp("saveCopy", v)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="md" onClick={testConnection} disabled={test === "testing"}>
                  {test === "testing" && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Probar conexión
                </Button>
                {test === "ok" && (
                  <span role="status" className="flex items-center gap-1.5 text-sm text-success">
                    <CircleCheck className="size-4" aria-hidden="true" />
                    Conexión correcta
                  </span>
                )}
              </div>
            </div>
          )}
        </Section>
      </div>
    </TooltipProvider>
  );
}

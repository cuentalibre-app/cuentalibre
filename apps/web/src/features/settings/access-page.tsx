import { useState, type FormEvent, type ReactNode } from "react";
import { Check, KeyRound, ShieldCheck } from "lucide-react";
import type { LinkedProvider } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { Field, Section } from "@/features/sales/form-fields";
import { ConfirmDialog, SettingsHeader } from "./settings-parts";
import { userStore, useUserSettings } from "./user-store";

const MIN_PASSWORD = 8;

const PROVIDERS: { value: LinkedProvider; label: string }[] = [
  { value: "google", label: "Cuenta de Google" },
  { value: "apple", label: "Cuenta de Apple" },
];

const dateFormat = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" });

export function AccessPage() {
  const { profile, access } = useUserSettings();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [unlink, setUnlink] = useState<LinkedProvider | null>(null);
  const [linking, setLinking] = useState<LinkedProvider | null>(null);
  const [notice, setNotice] = useState("");

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-6 lg:px-8">
        <SettingsHeader title="Credenciales de acceso" description="Configura cómo accedes a cuentalibre." />

        {notice && (
          <p role="status" className="m-0 flex items-center gap-2 text-sm text-success">
            <Check className="size-4" aria-hidden="true" />
            {notice}
          </p>
        )}

        <Section title="Datos de acceso" index={0}>
          <dl className="m-0 flex flex-col divide-y divide-divider">
            <Row label="Correo electrónico">
              <span className="font-medium break-all">{profile.email}</span>
            </Row>
            <Row
              label="Contraseña"
              action={
                <Button variant="secondary" size="md" onClick={() => setPasswordOpen(true)}>
                  <KeyRound aria-hidden="true" />
                  Cambiar contraseña
                </Button>
              }
            >
              <span className="font-mono tracking-widest" aria-label="Contraseña oculta">
                ••••••••
              </span>
              <span className="text-sm text-muted-foreground">
                Cambiada el {dateFormat.format(new Date(access.passwordChangedAt))}
              </span>
            </Row>
            <Row
              label="Autenticación por código"
              action={
                access.twoFactor ? (
                  <Button variant="secondary" size="md" onClick={() => setDisableOpen(true)}>
                    Desactivar
                  </Button>
                ) : (
                  <Button variant="secondary" size="md" onClick={() => setTwoFactorOpen(true)}>
                    <ShieldCheck aria-hidden="true" />
                    Activar
                  </Button>
                )
              }
            >
              <Badge tone={access.twoFactor ? "success" : "neutral"} className="self-start">
                {access.twoFactor ? "Activada" : "Desactivada"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Además de la contraseña, te pediremos un código que enviamos a tu correo cada vez que entres.
              </span>
            </Row>
          </dl>
        </Section>

        <Section title="Cuentas vinculadas" index={1}>
          <p className="m-0 max-w-3xl text-muted-foreground">
            Si lo prefieres, puedes vincular tu cuenta de Google o Apple para entrar a cuentalibre en un solo clic.
          </p>
          <dl className="m-0 flex flex-col divide-y divide-divider">
            {PROVIDERS.map(({ value, label }) => {
              const email = access.linked[value];
              return (
                <Row
                  key={value}
                  label={label}
                  action={
                    email ? (
                      <Button variant="secondary" size="md" onClick={() => setUnlink(value)}>
                        Desvincular
                      </Button>
                    ) : (
                      <Button variant="secondary" size="md" onClick={() => setLinking(value)}>
                        Vincular
                      </Button>
                    )
                  }
                >
                  {email ? (
                    <>
                      <span className="text-sm text-muted-foreground">Correo electrónico</span>
                      <span className="font-medium break-all">{email}</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Sin vincular</span>
                  )}
                </Row>
              );
            })}
          </dl>
        </Section>
      </div>

      <PasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        onChanged={() => {
          userStore.updateAccess({ passwordChangedAt: new Date().toISOString().slice(0, 10) });
          setNotice("Contraseña cambiada.");
        }}
      />
      <TwoFactorDialog
        open={twoFactorOpen}
        onOpenChange={setTwoFactorOpen}
        email={profile.email}
        onEnabled={() => {
          userStore.updateAccess({ twoFactor: true });
          setNotice("Autenticación por código activada.");
        }}
      />
      <ConfirmDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="¿Desactivar la autenticación por código?"
        confirmLabel="Desactivar"
        danger
        onConfirm={() => {
          userStore.updateAccess({ twoFactor: false });
          setNotice("Autenticación por código desactivada.");
        }}
      >
        <p className="m-0">Para entrar solo te pediremos la contraseña. Tu cuenta quedará menos protegida.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={unlink !== null}
        onOpenChange={(open) => !open && setUnlink(null)}
        title={`¿Desvincular tu ${unlink === "apple" ? "cuenta de Apple" : "cuenta de Google"}?`}
        confirmLabel="Desvincular"
        danger
        onConfirm={() => {
          if (!unlink) return;
          const linked = { ...access.linked };
          delete linked[unlink];
          userStore.updateAccess({ linked });
          setNotice("Cuenta desvinculada.");
        }}
      >
        <p className="m-0">Ya no podrás entrar con ella; seguirás pudiendo entrar con tu correo y contraseña.</p>
      </ConfirmDialog>
      <LinkDialog
        provider={linking}
        defaultEmail={profile.email}
        onOpenChange={(open) => !open && setLinking(null)}
        onLinked={(provider, email) => {
          userStore.updateAccess({ linked: { ...access.linked, [provider]: email } });
          setNotice("Cuenta vinculada.");
        }}
      />
    </TooltipProvider>
  );
}

function Row({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <dt className="text-sm font-medium text-muted-foreground sm:w-56 sm:shrink-0">{label}</dt>
      <dd className="m-0 flex min-w-0 flex-1 flex-col gap-1">{children}</dd>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function DialogActions({ submitLabel }: { submitLabel: string }) {
  return (
    <div className="flex justify-end gap-2.5 pt-1">
      <DialogClose asChild>
        <Button variant="secondary">Cancelar</Button>
      </DialogClose>
      <Button type="submit">{submitLabel}</Button>
    </div>
  );
}

function PasswordDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const empty = { current: "", next: "", repeat: "" };
  const [form, setForm] = useState(empty);
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    current: form.current ? undefined : "Introduce tu contraseña actual.",
    next: !form.next
      ? "Introduce la nueva contraseña."
      : form.next.length < MIN_PASSWORD
        ? `Debe tener al menos ${MIN_PASSWORD} caracteres.`
        : form.next === form.current
          ? "Debe ser distinta de la actual."
          : undefined,
    repeat: form.repeat === form.next ? undefined : "Las contraseñas no coinciden.",
  };
  const visible: Partial<typeof errors> = submitted ? errors : {};

  const change = (open: boolean) => {
    if (!open) {
      setForm(empty);
      setSubmitted(false);
    }
    onOpenChange(open);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (errors.current || errors.next || errors.repeat) return;
    onChanged();
    change(false);
  };
  const field = (key: keyof typeof empty, label: string, autoComplete: string, hint?: string) => (
    <Field label={label} required error={visible[key]} hint={hint}>
      {(p) => (
        <Input
          {...p}
          type="password"
          autoComplete={autoComplete}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      )}
    </Field>
  );

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-w-md">
        <DialogTitle>Cambiar contraseña</DialogTitle>
        <DialogDescription>Al cambiarla se cerrará la sesión en el resto de dispositivos.</DialogDescription>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {field("current", "Contraseña actual", "current-password")}
          {field("next", "Nueva contraseña", "new-password", `Mínimo ${MIN_PASSWORD} caracteres.`)}
          {field("repeat", "Repite la nueva contraseña", "new-password")}
          <DialogActions submitLabel="Cambiar contraseña" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Mock setup: a code is "sent" to the email and any six digits confirm it until there is a backend. */
function TwoFactorDialog({
  open,
  onOpenChange,
  email,
  onEnabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onEnabled: () => void;
}) {
  const [code, setCode] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const error = /^\d{6}$/.test(code) ? undefined : "El código tiene 6 cifras.";

  const change = (open: boolean) => {
    if (!open) {
      setCode("");
      setSubmitted(false);
    }
    onOpenChange(open);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (error) return;
    onEnabled();
    change(false);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-w-md">
        <DialogTitle>Activar la autenticación por código</DialogTitle>
        <DialogDescription>
          Te hemos enviado un código de 6 cifras a <strong className="font-semibold text-foreground">{email}</strong>.
          Escríbelo para confirmar que recibes los correos.
        </DialogDescription>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Código de verificación" required error={submitted ? error : undefined}>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="font-mono tracking-[0.3em]"
              />
            )}
          </Field>
          <DialogActions submitLabel="Activar" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Stands in for the provider's sign-in window until there is a backend. */
function LinkDialog({
  provider,
  defaultEmail,
  onOpenChange,
  onLinked,
}: {
  provider: LinkedProvider | null;
  defaultEmail: string;
  onOpenChange: (open: boolean) => void;
  onLinked: (provider: LinkedProvider, email: string) => void;
}) {
  const name = provider === "apple" ? "Apple" : "Google";
  return (
    <Dialog open={provider !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Vincular tu cuenta de {name}</DialogTitle>
        <DialogDescription>
          Se abrirá la ventana de {name} para que inicies sesión y autorices a cuentalibre. Después podrás entrar con un
          solo clic.
        </DialogDescription>
        <div className="flex justify-end gap-2.5 pt-1">
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            onClick={() => {
              if (provider) onLinked(provider, defaultEmail);
              onOpenChange(false);
            }}
          >
            Continuar con {name}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

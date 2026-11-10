import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Check, KeyRound, ShieldCheck } from "lucide-react";
import type { LinkedProvider } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button } from "@cuentalibre/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import {
  authErrorMessage,
  changePassword,
  createPassword,
  currentUser,
  linkGoogle,
  linkedAccounts,
  MIN_PASSWORD_LENGTH,
  oauthErrorMessage,
  signInMethods,
  unlinkAccount,
  type LinkedAccount,
} from "@/features/auth/auth-api";
import { VerifyEmailDialog } from "@/features/auth/email-code";
import { ForgotPasswordLink } from "@/features/auth/forgot-password-link";
import { PasswordMeter, newPasswordHint } from "@/features/auth/password-meter";
import { sessionState } from "@/features/auth/session";
import { Field, Section } from "@/features/sales/form-fields";
import { ACCESS_PATH } from "./settings-model";
import { ConfirmDialog, SettingsHeader } from "./settings-parts";
import { userStore, useUserSettings } from "./user-store";
import { Page } from "@/components/page";

const PROVIDERS: { value: LinkedProvider; label: string }[] = [
  { value: "google", label: "Cuenta de Google" },
  { value: "apple", label: "Cuenta de Apple" },
];

const dateFormat = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" });

export function AccessPage() {
  const { profile, access } = useUserSettings();
  const connected = sessionState() === "connected";
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [unlink, setUnlink] = useState<LinkedProvider | null>(null);
  const [linking, setLinking] = useState<LinkedProvider | null>(null);
  const [notice, setNotice] = useState("");

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <SettingsHeader title="Credenciales de acceso" description="Configura cómo accedes a cuentalibre." />

        {notice && (
          <p role="status" className="m-0 flex items-center gap-2 text-sm text-success">
            <Check className="size-4" aria-hidden="true" />
            {notice}
          </p>
        )}

        <Section title="Datos de acceso" index={0}>
          <dl className="m-0 flex flex-col divide-y divide-divider">
            {connected ? (
              <AccountEmailRow />
            ) : (
              <Row label="Correo electrónico">
                <span className="font-medium break-all">{profile.email}</span>
              </Row>
            )}
            {connected ? (
              <AccountPasswordRow />
            ) : (
              <PasswordRow
                changedAt={access.passwordChangedAt}
                change={async () => {
                  userStore.updateAccess({ passwordChangedAt: new Date().toISOString().slice(0, 10) });
                }}
              />
            )}
            {/* Only a mock-up: hidden on real accounts until the API asks for the code when signing in */}
            {!connected && (
              <Row
                label="Autenticación por código"
                action={
                  access.twoFactor ? (
                    <Button variant="secondary" onClick={() => setDisableOpen(true)}>
                      Desactivar
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => setTwoFactorOpen(true)}>
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
            )}
          </dl>
        </Section>

        {connected ? (
          <LinkedAccountsSection />
        ) : (
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
                        <Button variant="secondary" onClick={() => setUnlink(value)}>
                          Desvincular
                        </Button>
                      ) : (
                        <Button variant="secondary" onClick={() => setLinking(value)}>
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
        )}
      </Page>

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

/**
 * The user's email, and whether it is verified, with a way to verify it with a
 * code. Verifying it lets Google link itself to the account when signing in.
 */
function AccountEmailRow() {
  const [state, setState] = useState<{ email: string; verified: boolean; canSend: boolean } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([currentUser(), signInMethods()])
      .then(
        ([user, methods]) =>
          active && setState({ email: user.email, verified: user.emailVerified, canSend: methods.email }),
      )
      .catch((failure: unknown) => active && setError(authErrorMessage(failure)));
    return () => {
      active = false;
    };
  }, []);

  // Instances that can't send email don't verify, so there is nothing to say about it
  const showStatus = state && (state.verified || state.canSend);

  return (
    <Row
      label="Correo electrónico"
      action={
        state &&
        !state.verified &&
        state.canSend && (
          <Button variant="secondary" onClick={() => setVerifying(true)}>
            Verificar email
          </Button>
        )
      }
    >
      <span className="font-medium break-all">{state?.email ?? "…"}</span>
      {showStatus && (
        <Badge tone={state.verified ? "success" : "warning"} className="self-start">
          {state.verified ? "Verificado" : "Sin verificar"}
        </Badge>
      )}
      {showStatus && !state.verified && (
        <span className="text-sm text-muted-foreground">
          Verifícalo para poder entrar con Google sin vincularlo antes y para recuperar tu contraseña si la olvidas.
        </span>
      )}
      {notice && (
        <span role="status" className="flex items-center gap-2 text-sm text-success">
          <Check className="size-4" aria-hidden="true" />
          {notice}
        </span>
      )}
      {error && (
        <span role="alert" className="rounded-xl bg-destructive-soft px-3.5 py-3 text-sm text-destructive">
          {error}
        </span>
      )}
      {state && (
        <VerifyEmailDialog
          email={state.email}
          open={verifying}
          onOpenChange={setVerifying}
          onVerified={(email) => {
            setState({ ...state, email, verified: true });
            setNotice("Email verificado.");
            userStore.emailVerified(email);
          }}
        />
      )}
    </Row>
  );
}

/** The user's real password, if they have one: people who only sign in with Google don't. */
function AccountPasswordRow() {
  const [state, setState] = useState<{ hasPassword: boolean; changedAt: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    let active = true;
    currentUser()
      .then((user) => active && setState({ hasPassword: user.hasPassword, changedAt: user.passwordChangedAt }))
      .catch((failure: unknown) => active && setError(authErrorMessage(failure)));
    return () => {
      active = false;
    };
  }, []);

  if (state?.hasPassword) {
    return (
      <PasswordRow
        notice={created ? "Contraseña creada. Ya puedes entrar también con tu email y esta contraseña." : ""}
        changedAt={state.changedAt}
        change={async (current, next) => {
          await changePassword(current, next);
          setState({ hasPassword: true, changedAt: new Date().toISOString() });
        }}
      />
    );
  }
  return (
    <Row
      label="Contraseña"
      action={
        state && (
          <Button variant="secondary" onClick={() => setCreating(true)}>
            <KeyRound aria-hidden="true" />
            Crear contraseña
          </Button>
        )
      }
    >
      <span className="text-muted-foreground">{state ? "No tienes contraseña: entras con Google." : "…"}</span>
      {state && (
        <span className="text-sm text-muted-foreground">
          Crea una para poder entrar también con tu email, por si algún día no puedes usar Google.
        </span>
      )}
      {error && (
        <span role="alert" className="rounded-xl bg-destructive-soft px-3.5 py-3 text-sm text-destructive">
          {error}
        </span>
      )}
      <PasswordDialog
        creating
        open={creating}
        onOpenChange={setCreating}
        change={(_, next) => createPassword(next)}
        onChanged={() => {
          setState({ hasPassword: true, changedAt: new Date().toISOString() });
          setCreated(true);
        }}
      />
    </Row>
  );
}

function PasswordRow({
  changedAt,
  change,
  notice: initialNotice = "",
}: {
  changedAt: string | null;
  change: (current: string, next: string) => Promise<void>;
  /** What to say when it shows, such as that the password was just created. */
  notice?: string;
}) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(initialNotice);
  return (
    <Row
      label="Contraseña"
      action={
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <KeyRound aria-hidden="true" />
          Cambiar contraseña
        </Button>
      }
    >
      <span className="font-mono tracking-widest" aria-label="Contraseña oculta">
        ••••••••
      </span>
      {changedAt && (
        <span className="text-sm text-muted-foreground">Cambiada el {dateFormat.format(new Date(changedAt))}</span>
      )}
      {notice && (
        <span role="status" className="flex items-center gap-2 text-sm text-success">
          <Check className="size-4" aria-hidden="true" />
          {notice}
        </span>
      )}
      <PasswordDialog
        open={open}
        onOpenChange={setOpen}
        change={change}
        onChanged={() => setNotice("Contraseña cambiada. Hemos cerrado la sesión en el resto de dispositivos.")}
      />
    </Row>
  );
}

/** The user's real sign-in methods, from the API: for now, Google. */
function LinkedAccountsSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<{ google: boolean; email: string; accounts: LinkedAccount[] } | null>(null);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [pending, setPending] = useState(false);
  // Google sends people back here with ?vinculada=google, or ?error= if linking failed
  const [notice, setNotice] = useState(searchParams.get("vinculada") ? "Cuenta de Google vinculada." : "");
  const [error, setError] = useState(() => oauthErrorMessage(searchParams.get("error")));

  useEffect(() => {
    if (searchParams.size) setSearchParams({}, { replace: true, preventScrollReset: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;
    Promise.all([signInMethods(), currentUser(), linkedAccounts()])
      .then(([methods, user, accounts]) => active && setState({ google: methods.google, email: user.email, accounts }))
      .catch((failure: unknown) => active && setError(authErrorMessage(failure)));
    return () => {
      active = false;
    };
  }, []);

  const google = state?.accounts.find((account) => account.providerId === "google");

  const link = async () => {
    setPending(true);
    setError(null);
    try {
      await linkGoogle(ACCESS_PATH);
    } catch (failure) {
      setError(authErrorMessage(failure));
      setPending(false);
    }
  };

  const unlink = async () => {
    if (!google || !state) return;
    setError(null);
    setNotice("");
    try {
      await unlinkAccount(google.id);
      setState({ ...state, accounts: state.accounts.filter((account) => account.id !== google.id) });
      setNotice("Cuenta de Google desvinculada.");
    } catch (failure) {
      setError(authErrorMessage(failure));
    }
  };

  return (
    <Section title="Cuentas vinculadas" index={1}>
      <p className="m-0 max-w-3xl text-muted-foreground">
        Si lo prefieres, puedes vincular tu cuenta de Google para entrar a cuentalibre en un solo clic. Debe usar el
        mismo email que tu cuenta.
      </p>
      {notice && (
        <p role="status" className="m-0 flex items-center gap-2 text-sm text-success">
          <Check className="size-4" aria-hidden="true" />
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 max-w-3xl rounded-xl bg-destructive-soft px-3.5 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {state && (state.google || google) && (
        <dl className="m-0 flex flex-col divide-y divide-divider">
          <Row
            label="Cuenta de Google"
            action={
              google ? (
                <Button variant="secondary" onClick={() => setUnlinkOpen(true)}>
                  Desvincular
                </Button>
              ) : (
                <Button variant="secondary" disabled={pending} onClick={() => void link()}>
                  {pending ? "Un momento…" : "Vincular"}
                </Button>
              )
            }
          >
            {google ? (
              <>
                <span className="text-sm text-muted-foreground">Correo electrónico</span>
                <span className="font-medium break-all">{state.email}</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Sin vincular</span>
            )}
          </Row>
        </dl>
      )}
      {state && !state.google && !google && (
        <p className="m-0 text-sm text-muted-foreground">Este servidor no tiene activado el acceso con Google.</p>
      )}
      <ConfirmDialog
        open={unlinkOpen}
        onOpenChange={setUnlinkOpen}
        title="¿Desvincular tu cuenta de Google?"
        confirmLabel="Desvincular"
        danger
        onConfirm={() => void unlink()}
      >
        <p className="m-0">Ya no podrás entrar con ella; seguirás pudiendo entrar con tu correo y contraseña.</p>
      </ConfirmDialog>
    </Section>
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

function DialogActions({ submitLabel, disabled }: { submitLabel: string; disabled?: boolean }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="secondary">Cancelar</Button>
      </DialogClose>
      <Button type="submit" disabled={disabled}>
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}

/** Changes the password, or with `creating`, gives one to a user who has none, without asking for it. */
function PasswordDialog({
  open,
  onOpenChange,
  change: changeTo,
  onChanged,
  creating = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  change: (current: string, next: string) => Promise<void>;
  onChanged: () => void;
  creating?: boolean;
}) {
  const title = creating ? "Crear contraseña" : "Cambiar contraseña";
  const empty = { current: "", next: "", repeat: "" };
  const [form, setForm] = useState(empty);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = {
    current: form.current || creating ? undefined : "Introduce tu contraseña actual.",
    next: !form.next
      ? "Introduce la nueva contraseña."
      : form.next.length < MIN_PASSWORD_LENGTH
        ? `Debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
        : form.next === form.current && !creating
          ? "Debe ser distinta de la actual."
          : undefined,
    repeat: form.repeat === form.next ? undefined : "Las contraseñas no coinciden.",
  };
  const visible: Partial<typeof errors> = submitted ? errors : {};

  const change = (open: boolean) => {
    if (!open) {
      setForm(empty);
      setSubmitted(false);
      setError(null);
    }
    onOpenChange(open);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (errors.current || errors.next || errors.repeat) return;
    setPending(true);
    setError(null);
    try {
      await changeTo(form.current, form.next);
      onChanged();
      change(false);
    } catch (failure) {
      setError(authErrorMessage(failure));
    }
    setPending(false);
  };
  const field = (key: keyof typeof empty, label: string, autoComplete: string, hint?: string, action?: ReactNode) => (
    <Field label={label} required error={visible[key]} hint={hint} action={action}>
      {(p) => (
        <>
          <Input
            {...p}
            type="password"
            autoComplete={autoComplete}
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
          {key === "next" && <PasswordMeter password={form.next} />}
        </>
      )}
    </Field>
  );

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-w-md">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {creating
            ? "Con ella podrás entrar también con tu email, además de con Google."
            : "Al cambiarla se cerrará la sesión en el resto de dispositivos."}
        </DialogDescription>
        <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          {!creating && field("current", "Contraseña actual", "current-password", undefined, <ForgotPasswordLink />)}
          {field("next", "Nueva contraseña", "new-password", newPasswordHint(form.next))}
          {field("repeat", "Repite la nueva contraseña", "new-password")}
          {error && (
            <p role="alert" className="m-0 rounded-xl bg-destructive-soft px-3.5 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogActions submitLabel={pending ? (creating ? "Creando…" : "Cambiando…") : title} disabled={pending} />
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
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

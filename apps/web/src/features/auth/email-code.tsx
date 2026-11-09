import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { cn } from "@cuentalibre/ui/lib/cn";
import { Field } from "@/features/sales/form-fields";
import {
  AuthError,
  authErrorMessage,
  changeEmail,
  requestEmailChange,
  sendVerificationEmail,
  verifyEmail,
} from "./auth-api";
import { AuthButton } from "./auth-layout";

const CODE_LENGTH = 6;
/** How long "Reenviar código" waits after a code is sent: the API takes three per minute. */
const RESEND_AFTER = 30;

interface EmailCodeProps {
  /** The account's email, where the code went. */
  email: string;
  /** Verified `email`, which is a new one if the user changed it. */
  onVerified: (email: string) => void;
  /** Sends a code first, when the one sent on signing up may have expired. */
  sendFirst?: boolean;
  /** Leaves it for later; without it there is no such option. */
  onLater?: () => void;
  /** With the auth screens' main button, instead of the app's. */
  large?: boolean;
}

/**
 * Asks for the 6-digit code sent to the user's email, with ways to send it
 * again or, if the email is wrong, to switch to another one with a code sent there.
 */
export function EmailCode({ email, onVerified, sendFirst = false, onLater, large = false }: EmailCodeProps) {
  // Where the code went: the account's email, or the one the user is switching to
  const [target, setTarget] = useState(email);
  const [changing, setChanging] = useState(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [wait, setWait] = useState(sendFirst ? RESEND_AFTER : 0);
  const input = useRef<HTMLInputElement>(null);
  const switching = target !== email;

  // Once: a second code would replace the first while its email is on the way
  const sent = useRef(false);
  useEffect(() => {
    if (!sendFirst || sent.current) return;
    sent.current = true;
    sendVerificationEmail(email).catch((failure: unknown) => setError(authErrorMessage(failure)));
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setError(null);
    setNotice("");
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof AuthError && failure.code === "SESSION_NOT_FRESH"
          ? "Por seguridad, sal y vuelve a entrar para cambiar tu email."
          : authErrorMessage(failure),
      );
    }
    setPending(false);
  };

  const verify = (value: string) =>
    run(async () => {
      try {
        await (switching ? changeEmail(target, value) : verifyEmail(target, value));
      } catch (failure) {
        setCode("");
        input.current?.focus();
        throw failure;
      }
      onVerified(target);
    });

  const typeCode = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    // Typed or pasted in full: no need to press the button
    if (digits.length === CODE_LENGTH && !pending) void verify(digits);
  };

  const resend = () =>
    run(async () => {
      await (switching ? requestEmailChange(target) : sendVerificationEmail(target));
      setWait(RESEND_AFTER);
      setNotice("Te hemos enviado un código nuevo.");
      input.current?.focus();
    });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.length < CODE_LENGTH) {
      setError(`Escribe las ${CODE_LENGTH} cifras del código.`);
      input.current?.focus();
    } else void verify(code);
  };

  const Submit = large ? AuthButton : Button;

  if (changing)
    return (
      <ChangeEmail
        current={email}
        large={large}
        onCancel={() => setChanging(false)}
        onSent={(next) => {
          setTarget(next);
          setChanging(false);
          setCode("");
          setError(null);
          setNotice("");
          setWait(RESEND_AFTER);
        }}
      />
    );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="m-0 text-pretty">
        Te hemos enviado un código de {CODE_LENGTH} cifras a <strong className="break-all">{target}</strong>. Si no lo
        ves, mira en la carpeta de spam.{" "}
        <Button variant="link" disabled={pending} onClick={() => setChanging(true)}>
          ¿No es tu email? Cámbialo
        </Button>
      </p>
      <Field label="Código" error={error ?? undefined}>
        {(p) => (
          <Input
            {...p}
            ref={input}
            autoFocus
            value={code}
            onChange={(e) => typeCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            maxLength={CODE_LENGTH + 2}
            // The tracking also follows the last digit: the padding on the left evens it out
            className="h-14 pl-[calc(0.75rem+0.5em)] text-center font-mono text-2xl tracking-[0.5em]"
          />
        )}
      </Field>
      {notice && (
        <p role="status" className="m-0 flex items-center gap-2 text-sm text-success">
          <Check className="size-4" aria-hidden="true" />
          {notice}
        </p>
      )}
      <Submit type="submit" disabled={pending} className={cn(large && "mt-1")}>
        {pending ? "Un momento…" : "Verificar email"}
      </Submit>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Button variant="secondary" size="sm" disabled={pending || wait > 0} onClick={() => void resend()}>
          {wait > 0 ? `Reenviar código (${wait} s)` : "Reenviar código"}
        </Button>
        {onLater && (
          <Button variant="secondary" size="sm" disabled={pending} onClick={onLater}>
            Lo haré más tarde
          </Button>
        )}
      </div>
    </form>
  );
}

/** Asks for the right email and sends a code there; the account switches to it once the code is entered. */
function ChangeEmail({
  current,
  large,
  onCancel,
  onSent,
}: {
  current: string;
  large: boolean;
  onCancel: () => void;
  onSent: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) return setError("Escribe un email válido.");
    if (next === current.toLowerCase()) return setError("Es el mismo email que ya tienes.");
    setPending(true);
    setError(null);
    try {
      await requestEmailChange(next);
      onSent(next);
    } catch (failure) {
      setError(
        failure instanceof AuthError && failure.code === "SESSION_NOT_FRESH"
          ? "Por seguridad, sal y vuelve a entrar para cambiar tu email."
          : authErrorMessage(failure),
      );
      setPending(false);
    }
  };

  const Submit = large ? AuthButton : Button;

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
      <p className="m-0 text-pretty">
        Ahora usas <strong className="break-all">{current}</strong>. Te enviaremos un código al nuevo para comprobar que
        es tuyo; al escribirlo, tu cuenta pasa a usarlo.
      </p>
      <Field label="Email correcto" error={error ?? undefined}>
        {(p) => (
          <Input
            {...p}
            autoFocus
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Submit type="submit" disabled={pending} className={cn(large && "mt-1")}>
        {pending ? "Enviando…" : "Enviar código"}
      </Submit>
      <Button variant="secondary" size="sm" disabled={pending} onClick={onCancel} className="self-start">
        Cancelar
      </Button>
    </form>
  );
}

/** The code entry in a dialog, from the app: sends a fresh code when it opens. */
export function VerifyEmailDialog({
  email,
  open,
  onOpenChange,
  onVerified,
}: {
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (email: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Verifica tu email</DialogTitle>
        <DialogDescription>
          Así podrás recuperar tu cuenta si olvidas la contraseña, y entrar con Google sin vincularlo antes.
        </DialogDescription>
        <EmailCode
          sendFirst
          email={email}
          onVerified={(verified) => {
            onVerified(verified);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

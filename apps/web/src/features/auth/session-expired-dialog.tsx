import { useState, useSyncExternalStore } from "react";
import { Button } from "@cuentalibre/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { Input } from "@cuentalibre/ui/components/input";
import { Field } from "@/features/sales/form-fields";
import { authErrorMessage, signIn, signInWithGoogle } from "./auth-api";
import { AuthForm, runAction } from "./auth-layout";
import { PasswordInput } from "./password-input";
import { SIGN_IN_PATH, expiredSession, onSessionExpiry, reloadAt, resumeSession } from "./session";

/**
 * Asks the user to sign in again when the session ends while they work. With their
 * password the app carries on where it was, and the changes waiting are saved; leaving
 * for the sign-in page, or Google, starts it again.
 */
export function SessionExpiredDialog() {
  const me = useSyncExternalStore(onSessionExpiry, expiredSession);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!me) return null;

  const { email, hasPassword } = me.user;
  const submit = () =>
    runAction(
      async () => {
        await signIn(email, password);
        setPassword("");
        setPending(false);
        resumeSession();
      },
      setPending,
      setError,
      authErrorMessage,
    );
  const withGoogle = () => runAction(() => signInWithGoogle("sign-in"), setPending, setError, authErrorMessage);

  return (
    <Dialog open>
      <DialogContent
        closeButton={false}
        className="max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogTitle>Tu sesión ha caducado</DialogTitle>
        <DialogDescription>
          Han pasado 8 horas sin actividad. Vuelve a entrar para seguir donde lo dejaste.
        </DialogDescription>
        {hasPassword ? (
          <AuthForm onSubmit={submit} submitLabel="Entrar" pending={pending} error={error}>
            <Field label="Email">
              {(props) => <Input {...props} type="email" autoComplete="username" readOnly value={email} />}
            </Field>
            <Field label="Contraseña">
              {(props) => (
                <PasswordInput
                  {...props}
                  autoComplete="current-password"
                  autoFocus
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              )}
            </Field>
          </AuthForm>
        ) : (
          <div className="flex flex-col gap-3">
            {error && (
              <p role="alert" className="m-0 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button size="xl" className="w-full button-brand rounded-full" disabled={pending} onClick={withGoogle}>
              {pending ? "Un momento…" : "Continuar con Google"}
            </Button>
          </div>
        )}
        <button
          type="button"
          onClick={() => reloadAt(SIGN_IN_PATH)}
          className="cursor-pointer self-center border-0 bg-transparent p-0 text-sm font-medium text-primary hover:text-primary-hover"
        >
          Entrar con otra cuenta
        </button>
      </DialogContent>
    </Dialog>
  );
}

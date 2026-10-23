import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Field } from "@/features/sales/form-fields";
import { MIN_PASSWORD_LENGTH, authErrorMessage, oauthErrorMessage, resetPassword } from "./auth-api";
import { PasswordInput } from "./password-input";
import { AuthButton, AuthForm, AuthLayout, runAction } from "./auth-layout";
import { FORGOT_PASSWORD_PATH, SIGN_IN_PATH, reloadAt } from "./session";

/** Where the emailed link lands, with `?token=`, or `?error=` if it no longer works. */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(() =>
    token ? null : oauthErrorMessage(searchParams.get("error") ?? "INVALID_TOKEN"),
  );

  const submit = () =>
    runAction(
      async () => {
        await resetPassword(token!, password);
        setDone(true);
      },
      setPending,
      setError,
      authErrorMessage,
    );

  if (done)
    return (
      <AuthLayout
        title="Contraseña cambiada"
        description="Hemos cerrado todas las sesiones abiertas. Entra con tu nueva contraseña."
      >
        {/* A full load, in case this tab had a session: it has just ended */}
        <AuthButton onClick={() => reloadAt(SIGN_IN_PATH)}>Entrar</AuthButton>
      </AuthLayout>
    );

  return (
    <AuthLayout
      title="Elige una contraseña nueva"
      description="Al cambiarla se cerrarán todas las sesiones abiertas."
      footer={
        <Link to={FORGOT_PASSWORD_PATH} className="font-medium text-primary hover:text-primary-hover">
          Pedir otro enlace
        </Link>
      }
    >
      {token ? (
        <AuthForm onSubmit={submit} submitLabel="Cambiar contraseña" pending={pending} error={error}>
          <Field label="Contraseña nueva" hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres.`}>
            {(props) => (
              <PasswordInput
                {...props}
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>
        </AuthForm>
      ) : (
        <p role="alert" className="m-0 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </AuthLayout>
  );
}

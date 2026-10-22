import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Input } from "@cuentalibre/ui/components/input";
import { Field } from "@/features/sales/form-fields";
import { authErrorMessage, oauthErrorMessage, signIn } from "./auth-api";
import { AuthForm, AuthLayout, runAction } from "./auth-layout";
import { GoogleSignIn } from "./google-sign-in";
import { DEMO_PATH, SIGN_UP_PATH, leaveDemo, reloadAt } from "./session";

export function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [searchParams] = useSearchParams();
  const [pending, setPending] = useState(false);
  // Google sends people back here with ?error= when signing in with it fails
  const [error, setError] = useState(() => oauthErrorMessage(searchParams.get("error")));

  const submit = () =>
    runAction(
      async () => {
        await signIn(email.trim(), password);
        leaveDemo();
        reloadAt("/");
      },
      setPending,
      setError,
      authErrorMessage,
    );

  return (
    <AuthLayout
      title="Hola de nuevo"
      description="Entra para seguir con tus facturas e impuestos."
      footer={
        <>
          <span>
            ¿No tienes cuenta?{" "}
            <Link to={SIGN_UP_PATH} className="font-medium text-primary hover:text-primary-hover">
              Crear cuenta
            </Link>
          </span>
          <a href={DEMO_PATH} className="font-medium text-primary hover:text-primary-hover">
            Probar la demo sin cuenta
          </a>
        </>
      }
    >
      <GoogleSignIn intent="sign-in" onError={setError} />
      <AuthForm onSubmit={submit} submitLabel="Entrar" pending={pending} error={error}>
        <Field label="Email">
          {(props) => (
            <Input
              {...props}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>
        <Field label="Contraseña">
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
      </AuthForm>
    </AuthLayout>
  );
}

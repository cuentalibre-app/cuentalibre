import { useState } from "react";
import { buttonVariants } from "@cuentalibre/ui/components/button";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Input } from "@cuentalibre/ui/components/input";
import { Field } from "@/features/sales/form-fields";
import { MIN_PASSWORD_LENGTH, authErrorMessage, oauthErrorMessage, signUp } from "./auth-api";
import { PasswordMeter, newPasswordHint } from "./password-meter";
import { PasswordInput } from "./password-input";
import { AuthForm, AuthLayout, runAction } from "./auth-layout";
import { GoogleSignIn } from "./google-sign-in";
import { LegalConsent } from "./legal-consent";
import { DEMO_PATH, ONBOARDING_PATH, SIGN_IN_PATH, leaveDemo } from "./session";

export function SignUpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  // Google sends people back here with ?error= when signing in with it fails
  const [error, setError] = useState(() => oauthErrorMessage(searchParams.get("error")));

  const submit = () =>
    runAction(
      async () => {
        // Signing up also signs in; the organization is created next.
        await signUp(name.trim(), email.trim(), password);
        leaveDemo();
        navigate(ONBOARDING_PATH);
      },
      setPending,
      setError,
      authErrorMessage,
    );

  return (
    <AuthLayout
      panel="product"
      title="Crear cuenta"
      description="Empieza a llevar tus facturas e impuestos en cuentalibre."
      footer={
        <>
          <span>
            ¿Ya tienes cuenta?{" "}
            <Link to={SIGN_IN_PATH} className={buttonVariants({ variant: "link" })}>
              Entrar
            </Link>
          </span>
          <a href={DEMO_PATH} className={buttonVariants({ variant: "link" })}>
            Probar la demo sin cuenta
          </a>
        </>
      }
    >
      <GoogleSignIn intent="sign-up" onError={setError} />
      <AuthForm onSubmit={submit} submitLabel="Crear cuenta" pending={pending} error={error}>
        <Field label="Nombre">
          {(props) => (
            <Input
              {...props}
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
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
        <Field label="Contraseña" hint={newPasswordHint(password)}>
          {(props) => (
            <>
              <PasswordInput
                {...props}
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <PasswordMeter password={password} />
            </>
          )}
        </Field>
        <LegalConsent lead="Al crear la cuenta aceptas los" />
      </AuthForm>
    </AuthLayout>
  );
}

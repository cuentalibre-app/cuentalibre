import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Input } from "@cuentalibre/ui/components/input";
import { legalUrl } from "@/components/legal-links";
import { Field } from "@/features/sales/form-fields";
import { MIN_PASSWORD_LENGTH, authErrorMessage, signUp } from "./auth-api";
import { AuthForm, AuthLayout, runAction } from "./auth-layout";
import { DEMO_PATH, ONBOARDING_PATH, SIGN_IN_PATH, leaveDemo } from "./session";

export function SignUpPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      title="Crear cuenta"
      description="Empieza a llevar tus facturas e impuestos en cuentalibre."
      footer={
        <>
          <span>
            ¿Ya tienes cuenta?{" "}
            <Link to={SIGN_IN_PATH} className="font-medium text-primary hover:text-primary-hover">
              Entrar
            </Link>
          </span>
          <a href={DEMO_PATH} className="font-medium text-primary hover:text-primary-hover">
            Probar la demo sin cuenta
          </a>
        </>
      }
    >
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
        <Field label="Contraseña" hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres.`}>
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        <LegalConsent />
      </AuthForm>
    </AuthLayout>
  );
}

/** Creating an account accepts the terms; only shown where there are terms to accept. */
function LegalConsent() {
  const terms = legalUrl("terminos");
  const privacy = legalUrl("privacidad");
  if (!terms || !privacy) return null;
  const link = "font-medium text-primary hover:text-primary-hover";
  return (
    <p className="m-0 text-sm text-muted-foreground">
      Al crear la cuenta aceptas los{" "}
      <a href={terms} target="_blank" rel="noreferrer" className={link}>
        términos del servicio
      </a>{" "}
      y la{" "}
      <a href={privacy} target="_blank" rel="noreferrer" className={link}>
        política de privacidad
      </a>
      .
    </p>
  );
}

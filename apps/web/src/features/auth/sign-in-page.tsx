import { useState } from "react";
import { Link } from "react-router";
import { Input } from "@cuentalibre/ui/components/input";
import { Field } from "@/features/sales/form-fields";
import { authErrorMessage, signIn } from "./auth-api";
import { AuthForm, AuthLayout, runAction } from "./auth-layout";
import { DEMO_PATH, SIGN_UP_PATH, leaveDemo, reloadAt } from "./session";

export function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      title="Entrar"
      description="Accede a tu contabilidad."
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

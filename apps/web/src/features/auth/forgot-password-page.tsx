import { useState } from "react";
import { Link } from "react-router";
import { Check } from "lucide-react";
import { Input } from "@cuentalibre/ui/components/input";
import { Field } from "@/features/sales/form-fields";
import { authErrorMessage, requestPasswordReset } from "./auth-api";
import { AuthForm, AuthLayout, runAction } from "./auth-layout";
import { SIGN_IN_PATH } from "./session";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () =>
    runAction(
      async () => {
        await requestPasswordReset(email.trim());
        setSentTo(email.trim());
        setPending(false);
      },
      setPending,
      setError,
      authErrorMessage,
    );

  return (
    <AuthLayout
      title="¿Has olvidado tu contraseña?"
      description="Escribe tu email y te enviaremos un enlace para elegir una nueva."
      footer={
        <Link to={SIGN_IN_PATH} className="font-medium text-primary hover:text-primary-hover">
          Volver a entrar
        </Link>
      }
    >
      {sentTo ? (
        <p role="status" className="m-0 flex gap-2 text-md text-pretty">
          <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden="true" />
          <span>
            Si hay una cuenta con <span className="font-medium break-all">{sentTo}</span>, te hemos enviado el enlace.
            Caduca en una hora; mira también en la carpeta de spam.
          </span>
        </p>
      ) : (
        <AuthForm onSubmit={submit} submitLabel="Enviar enlace" pending={pending} error={error}>
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
        </AuthForm>
      )}
    </AuthLayout>
  );
}

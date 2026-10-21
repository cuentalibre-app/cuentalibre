import { useState } from "react";
import { Input } from "@cuentalibre/ui/components/input";
import { Field } from "@/features/sales/form-fields";
import { authErrorMessage, createOrganization } from "./auth-api";
import { AuthForm, AuthLayout, runAction } from "./auth-layout";
import { reloadAt } from "./session";

/** After signing up: the user creates the business their data belongs to. */
export function OnboardingPage() {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () =>
    runAction(
      async () => {
        await createOrganization(name.trim());
        reloadAt("/");
      },
      setPending,
      setError,
      authErrorMessage,
    );

  return (
    <AuthLayout title="Tu negocio" description="¿Con qué nombre trabajas? Podrás cambiarlo más adelante.">
      <AuthForm onSubmit={submit} submitLabel="Empezar" pending={pending} error={error}>
        <Field label="Nombre comercial o razón social">
          {(props) => (
            <Input
              {...props}
              autoComplete="organization"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
      </AuthForm>
    </AuthLayout>
  );
}

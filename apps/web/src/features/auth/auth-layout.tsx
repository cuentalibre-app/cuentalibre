import type { FormEvent, ReactNode } from "react";
import { Button } from "@cuentalibre/ui/components/button";
import { LegalLinks } from "@/components/legal-links";
import { LogoMark } from "@/components/logo";

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Shown under the card: links to the other screens. */
  footer?: ReactNode;
}

/** The centred card the sign-in, sign-up and onboarding screens share. */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <span className="flex items-baseline gap-2.5">
        <LogoMark className="h-6" />
        <span className="text-xl font-semibold tracking-tight">cuentalibre</span>
      </span>
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-xl border border-border bg-card p-6 text-card-foreground">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-xl font-semibold">{title}</h1>
          {description && <p className="m-0 text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
      {footer && <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">{footer}</div>}
      <LegalLinks className="justify-center" />
    </main>
  );
}

interface AuthFormProps {
  onSubmit: () => Promise<void>;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  children: ReactNode;
}

export function AuthForm({ onSubmit, submitLabel, pending, error, children }: AuthFormProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {children}
      {error && (
        <p role="alert" className="m-0 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Un momento…" : submitLabel}
      </Button>
    </form>
  );
}

/** Runs a form action, keeping track of whether it's pending and the error to show. */
export async function runAction(
  action: () => Promise<void>,
  setPending: (pending: boolean) => void,
  setError: (message: string | null) => void,
  message: (error: unknown) => string,
) {
  setPending(true);
  setError(null);
  try {
    await action();
  } catch (error) {
    setError(message(error));
    setPending(false);
  }
}

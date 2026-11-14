import type { ComponentProps, FormEvent, ReactNode } from "react";
import { Button } from "@cuentalibre/ui/components/button";
import { cn } from "@cuentalibre/ui/lib/cn";
import { LegalLinks, SITE_URL } from "@/components/legal-links";
import { LogoMark } from "@/components/logo";
import { DeadlinePanel, ProductPanel } from "./brand-panels";

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Shown under the form: links to the other screens. */
  footer?: ReactNode;
  /** Shown above the title, such as the step of a wizard. */
  eyebrow?: ReactNode;
  /** A wider column, for forms with fields side by side. */
  wide?: boolean;
  /** What the panel beside the form shows: the next filing deadline, or the app, to people signing up. */
  panel?: "deadline" | "product";
}

/**
 * The screens around the app (sign-in, sign-up, onboarding). On wide screens they speak like the public
 * site: serif headline and a brand panel beside the form. On phones they look like the app itself:
 * the brand wash behind, a sans headline and the form on a card.
 */
export function AuthLayout({ title, description, children, footer, eyebrow, wide = false, panel = "deadline" }: AuthLayoutProps) {
  return (
    <div className="relative isolate grid min-h-dvh bg-canvas lg:grid-cols-2 lg:bg-background">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-aurora lg:hidden" />
      <main className="flex flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-10 sm:py-8">
        <Brand />
        <div className="flex flex-1 justify-center pt-6 pb-2 lg:items-center lg:py-10">
          <div className={cn("flex w-full animate-rise-in flex-col gap-5 lg:gap-7", wide ? "max-w-[480px]" : "max-w-[400px]")}>
            <div className="flex flex-col gap-2">
              {eyebrow}
              <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance lg:font-display lg:text-[clamp(32px,5vw,40px)] lg:leading-[1.08] lg:tracking-[-0.025em]">
                {title}
              </h1>
              {description && <p className="m-0 text-md text-pretty text-muted-foreground">{description}</p>}
            </div>
            {/* A card on phones, like the app's panels; on wide screens the form sits on the page */}
            <div className="surface flex flex-col gap-5 p-5 lg:contents">{children}</div>
            {footer && <div className="flex flex-col items-center gap-2 text-base text-muted-foreground">{footer}</div>}
          </div>
        </div>
        {/* Phones reach these from the consent line and from the app's menu */}
        <LegalLinks className="hidden lg:flex" />
      </main>
      {panel === "product" ? <ProductPanel /> : <DeadlinePanel />}
    </div>
  );
}

/** Logo and name: back to the public site, or to the app's start on instances without one. */
function Brand() {
  return (
    <a
      href={SITE_URL ?? "/"}
      aria-label="cuentalibre, página de inicio"
      className="flex items-baseline gap-2.5 self-start rounded-lg text-foreground"
    >
      <LogoMark className="h-6" />
      <span className="font-brand text-xl font-semibold tracking-[-0.01em]">cuentalibre</span>
    </a>
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
      <AuthButton type="submit" disabled={pending} className="mt-1">
        {pending ? "Un momento…" : submitLabel}
      </AuthButton>
    </form>
  );
}

/** The main action of an auth screen: full width, in the brand gradient like the site's. */
export function AuthButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button variant="brand" size="xl" className={cn("w-full", className)} {...props} />;
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

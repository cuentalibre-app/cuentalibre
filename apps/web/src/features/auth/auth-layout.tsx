import type { ComponentProps, FormEvent, ReactNode } from "react";
import { Code, HandCoins, LockKeyhole, type LucideIcon } from "lucide-react";
import { Button } from "@cuentalibre/ui/components/button";
import { cn } from "@cuentalibre/ui/lib/cn";
import { LegalLinks, SITE_URL } from "@/components/legal-links";
import { LogoMark } from "@/components/logo";
import appScreen from "./assets/inicio.webp";

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
}

/**
 * The screens around the app (sign-in, sign-up, onboarding) speak like the
 * public site: serif headline, brand gradient, and a panel that shows the app.
 */
export function AuthLayout({ title, description, children, footer, eyebrow, wide = false }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-2">
      <main className="flex flex-col px-4 py-5 sm:px-10 sm:py-8">
        <Brand />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className={cn("flex w-full animate-rise-in flex-col gap-7", wide ? "max-w-[480px]" : "max-w-[400px]")}>
            <div className="flex flex-col gap-2">
              {eyebrow}
              <h1 className="m-0 font-display text-[clamp(32px,5vw,40px)] leading-[1.08] font-semibold tracking-[-0.025em] text-balance">
                {title}
              </h1>
              {description && <p className="m-0 text-md text-pretty text-muted-foreground">{description}</p>}
            </div>
            {children}
            {footer && <div className="flex flex-col items-center gap-2 text-base text-muted-foreground">{footer}</div>}
          </div>
        </div>
        <LegalLinks className="justify-center lg:justify-start" />
      </main>
      <BrandPanel />
    </div>
  );
}

/** Logo and name: back to the public site, or to the app's start on instances without one. */
function Brand() {
  return (
    <a
      href={SITE_URL ?? "/"}
      aria-label="cuentalibre, página de inicio"
      className="flex items-baseline gap-2.5 self-center rounded-lg text-foreground lg:self-start"
    >
      <LogoMark className="h-6" />
      <span className="text-xl font-semibold tracking-tight">cuentalibre</span>
    </a>
  );
}

const reasons: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Code, title: "Código abierto", text: "Cada cálculo de IVA e IRPF, a la vista." },
  { icon: LockKeyhole, title: "Privado por defecto", text: "Tus datos fiscales no son nuestro negocio." },
  { icon: HandCoins, title: "Gratis de verdad", text: "Facturas y gastos ilimitados." },
];

/** The site's promise beside the form, over a glimpse of the app. Only on wide screens. */
function BrandPanel() {
  return (
    <aside className="relative m-3 hidden overflow-hidden rounded-[24px] border border-border bg-brand-glow lg:flex lg:flex-col">
      <div className="relative z-10 flex flex-col gap-8 p-12 xl:p-16">
        <p className="m-0 font-display text-[clamp(36px,3.6vw,52px)] leading-[1.04] font-semibold tracking-[-0.025em] text-balance">
          Impuestos al día.
          <br />
          <span className="text-gradient-brand">100&nbsp;% código abierto.</span>
        </p>
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {reasons.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-primary">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="flex flex-col">
                <span className="text-md font-semibold">{title}</span>
                <span className="text-base text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {/* Decorative: the app's home screen, peeking in from the bottom-right corner */}
      <img
        src={appScreen}
        alt=""
        loading="lazy"
        decoding="async"
        width={1400}
        height={875}
        className="pointer-events-none absolute top-[min(60%,420px)] left-12 w-[1100px] max-w-none rounded-tl-[14px] border border-border bg-background shadow-[-10px_-10px_36px_-14px_rgb(17_18_20/0.28)] select-none xl:left-16"
      />
    </aside>
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

/** The main action of an auth screen: a full-width pill in the brand gradient, like the site's. */
export function AuthButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button size="xl" className={cn("w-full button-brand rounded-full", className)} {...props} />;
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

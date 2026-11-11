import type { ComponentProps, FormEvent, ReactNode } from "react";
import {
  Code,
  DatabaseBackup,
  HandCoins,
  Lock,
  LockKeyhole,
  MonitorSmartphone,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@cuentalibre/ui/components/button";
import { cn } from "@cuentalibre/ui/lib/cn";
import { LegalLinks, SITE_URL } from "@/components/legal-links";
import { LogoMark } from "@/components/logo";
import appScreen from "./assets/inicio.webp";
import appScreenDark from "./assets/inicio-oscuro.webp";

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
 * The screens around the app (sign-in, sign-up, onboarding). On wide screens they speak like the public
 * site: serif headline and a brand panel that shows the app. On phones they look like the app itself:
 * the brand wash behind, a sans headline and the form on a card.
 */
export function AuthLayout({ title, description, children, footer, eyebrow, wide = false }: AuthLayoutProps) {
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
      className="flex items-baseline gap-2.5 self-start rounded-lg text-foreground"
    >
      <LogoMark className="h-6" />
      <span className="font-brand text-xl font-semibold tracking-[-0.01em]">cuentalibre</span>
    </a>
  );
}

interface Pitch {
  headline: string;
  accent: string;
  reasons: { icon: LucideIcon; title: string; text: string }[];
}

/**
 * Beside the form. cuentalibre online (the instance with a public site) is a hosted, paid
 * service: it speaks of what its customers get. A self-hosted instance keeps the project's promise.
 */
const pitch: Pitch = SITE_URL
  ? {
      headline: "Impuestos al día.",
      accent: "Sin instalar nada.",
      reasons: [
        { icon: MonitorSmartphone, title: "Desde cualquier navegador", text: "En el ordenador o en el móvil, con los mismos datos." },
        { icon: RefreshCw, title: "Siempre actualizada", text: "Las mejoras llegan solas, sin que hagas nada." },
        { icon: DatabaseBackup, title: "Copia de seguridad diaria", text: "Y exportas tus datos cuando quieras." },
      ],
    }
  : {
      headline: "Impuestos al día.",
      accent: "100\u00a0% código abierto.",
      reasons: [
        { icon: Code, title: "Código abierto", text: "Cada cálculo de IVA e IRPF, a la vista." },
        { icon: LockKeyhole, title: "Privado por defecto", text: "Tus datos fiscales no salen de tu servidor." },
        { icon: HandCoins, title: "Gratis de verdad", text: "Facturas y gastos ilimitados." },
      ],
    };

/** The promise beside the form, over the app's home screen in a browser window. Only on wide screens. */
function BrandPanel() {
  return (
    <aside className="relative m-3 hidden overflow-hidden rounded-[20px] border border-border bg-brand-glow lg:flex lg:flex-col">
      <div className="relative z-10 flex flex-col gap-8 p-12 xl:p-16">
        <p className="m-0 font-display text-[clamp(36px,3.6vw,52px)] leading-[1.04] font-semibold tracking-[-0.025em] text-balance">
          {pitch.headline}
          <br />
          <span className="text-gradient-brand">{pitch.accent}</span>
        </p>
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {pitch.reasons.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-background text-primary">
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
      <AppWindow />
    </aside>
  );
}

/**
 * Decorative: the app's home screen in a Safari window, as on the site, peeking in from the
 * panel's bottom-right corner. Sized in container units of the window's width, like the site's.
 */
function AppWindow() {
  const light = "size-[1cqw] rounded-full";
  const shot = "block aspect-[1440/900] h-auto w-full bg-background select-none";
  return (
    <div
      aria-hidden="true"
      className="@container pointer-events-none absolute top-[min(60%,420px)] left-12 w-[1100px] xl:left-16"
    >
      <div className="overflow-hidden rounded-[1cqw] border border-border bg-background shadow-window">
        <div className="flex h-[3.6cqw] items-center gap-[1.6cqw] border-b border-border bg-sidebar px-[1.4cqw]">
          <span className="flex gap-[0.65cqw]">
            <span className={cn(light, "bg-window-close")} />
            <span className={cn(light, "bg-window-minimize")} />
            <span className={cn(light, "bg-window-zoom")} />
          </span>
          <span className="ml-[16%] flex h-[2.3cqw] w-[38%] items-center justify-center gap-[0.5cqw] rounded-[0.7cqw] bg-muted text-[1cqw] font-medium tracking-[-0.01em] text-foreground">
            <Lock className="size-[0.9cqw] text-muted-foreground" strokeWidth={2.4} />
            {window.location.host}
          </span>
        </div>
        <img src={appScreen} alt="" loading="lazy" decoding="async" width={2000} height={1250} className={cn(shot, "dark:hidden")} />
        <img src={appScreenDark} alt="" loading="lazy" decoding="async" width={2000} height={1250} className={cn(shot, "hidden dark:block")} />
      </div>
    </div>
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

/** Full-width actions are tall for thumbs on phones; on wide screens they match the site's buttons. */
export const AUTH_ACTION = "w-full lg:h-11 lg:rounded-[10px]";

/** The main action of an auth screen: full width, in the brand gradient like the site's. */
export function AuthButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button variant="brand" size="xl" className={cn(AUTH_ACTION, className)} {...props} />;
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

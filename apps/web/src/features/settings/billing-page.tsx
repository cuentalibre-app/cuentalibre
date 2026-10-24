import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import type { Billing, BillingPeriod } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button } from "@cuentalibre/ui/components/button";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { ApiError } from "@/data/api";
import { currentBackend } from "@/data/backend";
import { signInMethods } from "@/features/auth/auth-api";
import { Section } from "@/features/sales/form-fields";
import { formatDate } from "@/lib/format";
import {
  isLive,
  localDate,
  perMonth,
  periodOf,
  PERIODS,
  planHeadline,
  planState,
  type PlanState,
  savingOf,
  TRIAL_DAYS,
  trialDaysLeft,
  withVat,
} from "./billing-model";
import { setBilling as setSharedBilling } from "./billing-store";
import { SettingsHeader } from "./settings-parts";

const READ_ONLY =
  "Tus datos están a salvo: puedes consultarlos y exportarlos. Suscríbete para volver a emitir facturas y registrar gastos.";

/** How long to wait for Stripe's webhook after paying, checking every two seconds. */
const ACTIVATION_TRIES = 15;

function failureMessage(failure: unknown) {
  if (failure instanceof ApiError && failure.code === "forbidden")
    return "Solo quien administra la empresa puede cambiar su plan.";
  if (failure instanceof ApiError && failure.code === "already_subscribed")
    return "La empresa ya tiene una suscripción. Gestiónala desde aquí abajo.";
  return "No se ha podido conectar con el sistema de pago. Inténtalo de nuevo.";
}

/** The company's Cloud plan: its trial, paying for it and managing the subscription in Stripe. */
export function BillingPage() {
  const api = currentBackend().billing;
  const [searchParams, setSearchParams] = useSearchParams();
  // Stripe sends people back here with ?suscripcion=ok once they paid
  const [justPaid] = useState(() => searchParams.get("suscripcion") === "ok");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.size) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;
    void signInMethods().then(({ billing: on }) => active && setEnabled(on && Boolean(api)));
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    if (!enabled || !api) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async (tries: number) => {
      try {
        const next = await api.get();
        if (!active) return;
        setBilling(next);
        // So the read-only banner goes away as soon as the subscription is active
        setSharedBilling(next);
        // The webhook may land a moment after Stripe sends people back
        if (justPaid && !isLive(next.subscription) && tries > 1) timer = setTimeout(() => void load(tries - 1), 2000);
      } catch {
        if (active) setError("No se ha podido cargar tu plan. Recarga la página para intentarlo de nuevo.");
      }
    };
    void load(ACTIVATION_TRIES);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [enabled, api, justPaid]);

  return (
    // One narrow column: the page is short, and the prices read better side by side than stretched
    <div className="flex max-w-4xl flex-col gap-5 px-5 pt-6 pb-8 lg:gap-6 lg:px-8">
      <SettingsHeader title="Plan y facturación" description="Tu suscripción a cuentalibre Cloud y sus pagos." />

      {enabled === false ? (
        <p className="m-0 rounded-lg bg-muted px-4 py-3 text-sm">
          Esta instalación de cuentalibre no tiene planes de pago: la usas gratis, en tu propio servidor.
        </p>
      ) : error ? (
        <p role="alert" className="m-0 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : !billing ? (
        <p className="m-0 text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <BillingDetails billing={billing} justPaid={justPaid} />
      )}
    </div>
  );
}

function BillingDetails({ billing, justPaid }: { billing: Billing; justPaid: boolean }) {
  const subscribed = isLive(billing.subscription);
  return (
    <>
      {justPaid && (
        <p role="status" className="m-0 rounded-lg bg-success-soft px-4 py-3 text-sm">
          {subscribed ? (
            <strong className="font-semibold text-success">Pago recibido. Tu suscripción está activa.</strong>
          ) : (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-success" aria-hidden="true" />
              Pago recibido. Estamos activando tu suscripción…
            </span>
          )}
        </p>
      )}
      <PlanPanel billing={billing} />
      {subscribed ? (
        <ManageSection billing={billing} />
      ) : (
        <SubscribeSection hasHistory={Boolean(billing.subscription)} />
      )}
    </>
  );
}

/** Where the company stands: trial, paying, a failed charge or read-only. */
function PlanPanel({ billing }: { billing: Billing }) {
  const { plan, subscription } = billing;
  const subscribed = isLive(subscription);
  const period = subscription?.period ? periodOf(subscription.period) : null;
  const periodEnd = subscription?.currentPeriodEnd ? formatDate(localDate(subscription.currentPeriodEnd)) : null;
  const { title, badge, tone } = planHeadline(billing);

  const body: Record<PlanState, ReactNode> = {
    cancelled: (
      <>
        No se renovará: tienes todo cuentalibre hasta el {periodEnd}. Si cambias de idea, reactívala al gestionar tu
        suscripción.
      </>
    ),
    pastDue: (
      <>
        No hemos podido cobrar el último pago y lo volveremos a intentar en los próximos días. Revisa tu tarjeta al
        gestionar la suscripción. Mientras tanto, todo sigue funcionando.
      </>
    ),
    active: period ? (
      <>
        Plan {period.label.toLowerCase()}. Próximo cobro el {periodEnd}:{" "}
        <span className="amount font-semibold">{formatEUR(withVat(period.price))}</span> ({formatEUR(period.price)} +
        IVA).
      </>
    ) : (
      <>Próximo cobro el {periodEnd}.</>
    ),
    trial: (
      <>
        Tienes todo cuentalibre Cloud hasta el {formatDate(localDate(plan.trialEndsAt))}. Suscríbete cuando quieras: no
        perderás nada de lo que hayas hecho.
      </>
    ),
    subscriptionEnded: <>{READ_ONLY}</>,
    trialEnded: <>{READ_ONLY}</>,
  };

  const trialUsed = plan.status === "trial" && !subscribed ? TRIAL_DAYS - trialDaysLeft(plan) : null;
  return (
    <section
      aria-label="Tu plan"
      className="flex animate-rise-in flex-col gap-4 rounded-xl border border-primary/30 bg-primary-soft/40 p-5"
    >
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CreditCard className="size-6" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-lg font-semibold">{title}</h2>
            <Badge tone={tone}>{badge}</Badge>
          </div>
          <p className="m-0 text-sm text-muted-foreground">{body[planState(billing)]}</p>
        </div>
      </div>
      {trialUsed !== null && (
        <div
          role="meter"
          aria-label="Días de prueba usados"
          aria-valuemin={0}
          aria-valuemax={TRIAL_DAYS}
          aria-valuenow={trialUsed}
          className="h-1.5 overflow-hidden rounded-full bg-primary/15"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${(trialUsed / TRIAL_DAYS) * 100}%` }} />
        </div>
      )}
    </section>
  );
}

/** Choosing a period and paying for it in Stripe Checkout. */
function SubscribeSection({ hasHistory }: { hasHistory: boolean }) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = async () => {
    setPending(true);
    setError(null);
    try {
      window.location.assign(await currentBackend().billing!.checkout(period));
    } catch (failure) {
      setError(failureMessage(failure));
      setPending(false);
    }
  };

  return (
    <Section title="Suscribirte" index={1}>
      <div role="radiogroup" aria-label="Cada cuánto pagas" className="grid gap-3 sm:grid-cols-3">
        {PERIODS.map((option) => {
          const checked = option.value === period;
          const saving = savingOf(option);
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setPeriod(option.value)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                checked ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-accent",
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="font-semibold">{option.label}</span>
                {saving > 0 && <Badge tone="success">Ahorras un {saving} %</Badge>}
              </span>
              <span>
                <span className="amount text-2xl font-semibold tracking-tight">{formatEUR(perMonth(option))}</span>
                <span className="text-sm text-muted-foreground"> /mes</span>
              </span>
              <span className="text-sm text-muted-foreground">
                {option.months === 1 ? "Se cobra cada mes" : `${formatEUR(option.price)} ${option.every}`}
              </span>
            </button>
          );
        })}
      </div>
      <p className="m-0 text-sm text-muted-foreground">
        Precios sin IVA: al pagar se añade el 21 %. Cambia de periodo o cancela cuando quieras; si cancelas, sigues
        teniendo acceso hasta el final de lo que has pagado.
      </p>
      {error && (
        <p role="alert" className="m-0 rounded-lg bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void subscribe()} disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Continuar al pago
        </Button>
        {hasHistory && <PortalButton variant="ghost" label="Ver facturas anteriores" />}
      </div>
    </Section>
  );
}

function ManageSection({ billing }: { billing: Billing }) {
  return (
    <Section title="Tu suscripción" index={1}>
      <p className="m-0 text-sm text-muted-foreground">
        Cambia el periodo o la tarjeta, actualiza los datos de facturación, descarga tus facturas o cancela la
        suscripción. Se abre la página de pagos de Stripe, que te devuelve aquí al terminar.
      </p>
      <div>
        <PortalButton
          variant={billing.plan.status === "pastDue" ? "primary" : "secondary"}
          label="Gestionar suscripción"
        />
      </div>
    </Section>
  );
}

function PortalButton({ variant, label }: { variant: "primary" | "secondary" | "ghost"; label: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setPending(true);
    setError(null);
    try {
      window.location.assign(await currentBackend().billing!.portal());
    } catch (failure) {
      setError(failureMessage(failure));
      setPending(false);
    }
  };

  return (
    <span className="inline-flex flex-col gap-2">
      <Button variant={variant} onClick={() => void open()} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ExternalLink aria-hidden="true" />}
        {label}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}

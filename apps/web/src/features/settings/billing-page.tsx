import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { CreditCard, ExternalLink, FileText, Loader2, ScanText } from "lucide-react";
import type { Billing, BillingInvoice, BillingPeriod, ExtractionUsage, Plan } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { ApiError } from "@/data/api";
import { currentBackend } from "@/data/backend";
import { nextMonthName } from "@/data/extraction";
import { signInMethods } from "@/features/auth/auth-api";
import { Section } from "@/features/sales/form-fields";
import { formatDate } from "@/lib/format";
import {
  firstChargeOf,
  isLive,
  localDate,
  periodOf,
  planHeadline,
  planState,
  type PlanState,
  TRIAL_DAYS,
  trialDaysLeft,
  withVat,
} from "./billing-model";
import { setBilling as setSharedBilling } from "./billing-store";
import { PeriodPicker } from "./period-picker";
import { SettingsHeader } from "./settings-parts";
import { Page } from "@/components/page";

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
    if (searchParams.size) setSearchParams({}, { replace: true, preventScrollReset: true });
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
        if (active) setError("No se ha podido cargar tu plan. Recarga la página.");
      }
    };
    void load(ACTIVATION_TRIES);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [enabled, api, justPaid]);

  useEffect(() => {
    if (!enabled || !api) return;
    // Stripe's portal opens in another tab: what changed there shows on coming back
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      api.get().then(
        (next) => {
          setBilling(next);
          setSharedBilling(next);
        },
        () => undefined,
      );
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [enabled, api]);

  return (
    // One narrow column: the page is short, and the prices read better side by side than stretched
    <Page className="max-w-4xl">
      <SettingsHeader title="Plan y facturación" description="Tu suscripción a cuentalibre Cloud y sus pagos." />

      {enabled === false ? (
        <p className="m-0 rounded-lg bg-muted px-4 py-3 text-sm">
          Esta instalación de cuentalibre no tiene planes de pago: la usas gratis, en tu propio servidor.
        </p>
      ) : error ? (
        <p role="alert" className="m-0 rounded-xl bg-destructive-soft px-3.5 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : !billing ? (
        <p className="m-0 text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <BillingDetails billing={billing} justPaid={justPaid} />
      )}
    </Page>
  );
}

function BillingDetails({ billing, justPaid }: { billing: Billing; justPaid: boolean }) {
  const subscribed = isLive(billing.subscription);
  return (
    <>
      {justPaid && (
        <p role="status" className="m-0 rounded-xl bg-success-soft px-3.5 py-3 text-sm">
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
      <ReadingUsage />
      {subscribed ? <ManageSection billing={billing} /> : <SubscribeSection plan={billing.plan} />}
      {billing.subscription && <InvoicesSection />}
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
            <h2 className="m-0 text-lg font-semibold tracking-tight lg:text-title">{title}</h2>
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

/** Documents read with AI this month, where the server reads them and has a monthly limit. */
function ReadingUsage() {
  const [usage, setUsage] = useState<ExtractionUsage | null>(null);
  useEffect(() => {
    const read = currentBackend().extractionUsage;
    if (!read) return;
    let active = true;
    void signInMethods()
      .then(({ ai }) => (ai ? read() : null))
      .then((next) => active && setUsage(next))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  if (!usage?.limit) return null;
  const { used, limit } = usage;
  const full = used >= limit;
  return (
    <section
      aria-label="Documentos leídos con IA"
      className="flex flex-col gap-2.5 rounded-xl border border-border p-4"
    >
      <div className="flex items-center gap-3">
        <ScanText className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        <p className="m-0 flex-1 text-sm">
          <span className="font-medium">Documentos leídos con IA</span>
          <span className="block text-muted-foreground">
            {full
              ? `Has usado todos los de este mes. Podrás leer más desde el 1 de ${nextMonthName()}.`
              : `Se renuevan el 1 de ${nextMonthName()}.`}
          </span>
        </p>
        <span className="shrink-0 amount text-sm font-semibold">
          {Math.min(used, limit)} de {limit} este mes
        </span>
      </div>
      <div
        role="meter"
        aria-label="Documentos leídos con IA este mes"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full", full ? "bg-warning" : "bg-primary")}
          style={{ width: `${(Math.min(used, limit) / limit) * 100}%` }}
        />
      </div>
    </section>
  );
}

/** Choosing a period and paying for it in Stripe Checkout. */
function SubscribeSection({ plan }: { plan: Plan }) {
  const firstCharge = firstChargeOf(plan);
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
      <PeriodPicker value={period} onChange={setPeriod} />
      <p className="m-0 text-sm text-muted-foreground">
        {firstCharge &&
          `Conservas tus días gratis: te pedimos la tarjeta ahora y el primer cobro llega el ${formatDate(localDate(firstCharge))}, cuando acaba la prueba. `}
        Precios sin IVA: al pagar se añade el 21 %. Cambia de periodo o cancela cuando quieras; si cancelas, sigues
        teniendo acceso hasta el final de lo que has pagado.
      </p>
      {error && (
        <p role="alert" className="m-0 rounded-xl bg-destructive-soft px-3.5 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button onClick={() => void subscribe()} disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Continuar al pago
        </Button>
      </div>
    </Section>
  );
}

function ManageSection({ billing }: { billing: Billing }) {
  return (
    <Section title="Tu suscripción" index={1}>
      <p className="m-0 text-sm text-muted-foreground">
        Cambia el periodo o la tarjeta, actualiza los datos de facturación o cancela la suscripción. Se abre en otra
        pestaña la página de pagos de Stripe.
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
    // Opened on the click, as browsers block tabs opened later, and sent to Stripe once the link arrives
    const tab = window.open("", "_blank");
    setPending(true);
    setError(null);
    try {
      const url = await currentBackend().billing!.portal();
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else window.location.assign(url);
    } catch (failure) {
      tab?.close();
      setError(failureMessage(failure));
    }
    setPending(false);
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

/** The invoices for the plan's charges, each with its PDF; asked for every time, as Stripe's links expire. */
function InvoicesSection() {
  const [invoices, setInvoices] = useState<BillingInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    currentBackend()
      .billing!.invoices()
      .then((list) => active && setInvoices(list))
      .catch((failure: unknown) => {
        if (!active) return;
        setError(
          failure instanceof ApiError && failure.code === "forbidden"
            ? "Solo quien administra la empresa puede ver sus facturas."
            : "No se han podido cargar las facturas. Recarga la página.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Section title="Facturas" index={2}>
      {error ? (
        <p className="m-0 text-sm text-muted-foreground">{error}</p>
      ) : invoices === null ? (
        <p className="m-0 text-sm text-muted-foreground">Cargando…</p>
      ) : invoices.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">Aún no hay facturas: tendrás una con cada cobro.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium">{formatDate(localDate(invoice.paidAt))}</span>
                <span className="truncate text-xs text-muted-foreground">Factura {invoice.number}</span>
              </div>
              <span className="amount font-semibold">{formatEUR(invoice.total)}</span>
              <a
                href={currentBackend().billing!.pdfUrl(invoice.id)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Abrir la factura ${invoice.number} en PDF`}
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "no-underline")}
              >
                <FileText aria-hidden="true" />
                PDF
              </a>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

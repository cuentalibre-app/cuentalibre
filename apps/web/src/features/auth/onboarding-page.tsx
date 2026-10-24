import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, Loader2, Star, TriangleAlert } from "lucide-react";
import { isVerifactuMandatory, normalizeTaxId, verifactuMandatoryFrom } from "@cuentalibre/core";
import type {
  BillingPeriod,
  BusinessProfile,
  FiscalRegion,
  IncomeTaxMethod,
  InvoicingSystem,
  TaxSetup,
  VatRegime,
} from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { Input } from "@cuentalibre/ui/components/input";
import { SegmentedControl } from "@cuentalibre/ui/components/segmented-control";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { AddressFields } from "@/features/contacts/contact-fields";
import { Field, GroupedSelect } from "@/features/sales/form-fields";
import { ActivityPicker } from "@/features/settings/activity-picker";
import { localDate, TRIAL_DAYS } from "@/features/settings/billing-model";
import { PeriodPicker } from "@/features/settings/period-picker";
import { formatDate } from "@/lib/format";
import {
  BUSINESS_KINDS,
  INCOME_TAX_METHODS,
  REGIONS,
  VAT_REGIMES,
  businessName,
  fullName,
  unsupportedSetup,
  type ProfileErrors,
} from "@/features/settings/settings-model";
import {
  authErrorMessage,
  createOrganization,
  currentUser,
  saveSettings,
  signInMethods,
  startCheckout,
} from "./auth-api";
import verifactuLogo from "./assets/verifactu.webp";
import { EmailCode } from "./email-code";
import { AuthButton, AuthLayout, runAction } from "./auth-layout";
import {
  CREATES_BUSINESS,
  newSetup,
  onboardingSteps,
  organizationName,
  setupCommands,
  skipStep,
  stepErrors,
  type OnboardingStep,
  type Setup,
} from "./onboarding-model";
import { reloadAt } from "./session";

type SetProfile = <K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) => void;
type SetTax = <K extends keyof TaxSetup>(key: K, value: TaxSetup[K]) => void;

/** Which step the user is on, and how far along: a bar per step, filled up to the current one. */
function Progress({ steps, step }: { steps: OnboardingStep[]; step: number }) {
  const current = steps[step]!;
  return (
    <div className="mb-3 flex flex-col gap-2.5">
      <ol aria-hidden="true" className="m-0 flex list-none gap-1.5 p-0">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              i <= step ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </ol>
      <p className="m-0 text-sm font-medium text-muted-foreground">
        Paso {step + 1} de {steps.length} · {current.label}
        {current.optional && " · opcional"}
      </p>
    </div>
  );
}

function RegimeStep({ setup, setProfile, setTax }: { setup: Setup; setProfile: SetProfile; setTax: SetTax }) {
  const { profile, tax } = setup;
  const notes = unsupportedSetup(tax);
  return (
    <>
      <SegmentedControl
        label="Tipo de empresa"
        value={profile.kind}
        onChange={(kind) => setProfile("kind", kind)}
        options={BUSINESS_KINDS}
        className="self-start"
      />
      <Field
        label="Región fiscal"
        help="Cada territorio tiene su propia normativa: en Canarias, por ejemplo, se aplica el IGIC en lugar del IVA."
      >
        {(p) => (
          <GroupedSelect
            {...p}
            value={tax.region}
            onChange={(v) => setTax("region", v as FiscalRegion)}
            groups={[{ options: REGIONS }]}
          />
        )}
      </Field>
      {profile.kind === "selfEmployed" && (
        <Field
          label="Método de estimación de IRPF"
          help="Decide cómo se calcula el rendimiento de tu actividad en los modelos 130 y 100."
        >
          {(p) => (
            <GroupedSelect
              {...p}
              value={tax.incomeTaxMethod}
              onChange={(v) => setTax("incomeTaxMethod", v as IncomeTaxMethod)}
              groups={[{ options: INCOME_TAX_METHODS }]}
            />
          )}
        </Field>
      )}
      <Field label="Régimen de IVA">
        {(p) => (
          <GroupedSelect
            {...p}
            value={tax.vatRegime}
            onChange={(v) => setTax("vatRegime", v as VatRegime)}
            groups={[{ options: VAT_REGIMES }]}
          />
        )}
      </Field>
      {notes.length > 0 && (
        <div role="note" className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">cuentalibre todavía no prepara los modelos de este régimen.</span>
            {notes.map((n) => (
              <span key={n} className="text-muted-foreground">
                {n}
              </span>
            ))}
            <span className="text-muted-foreground">Puedes llevar tus facturas y gastos igualmente.</span>
          </div>
        </div>
      )}
      <details className="group rounded-lg border border-border px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-foreground marker:text-muted-foreground">
          ¿Dónde lo miro?
        </summary>
        <div className="mt-2 flex flex-col gap-2 text-muted-foreground">
          <p className="m-0">
            Lo elegiste al darte de alta en Hacienda: aparece en el modelo 036 o 037 que presentaste. Si te lo tramitó
            una gestoría, pídeselo.
          </p>
          <p className="m-0">
            Lo más habitual es la estimación directa simplificada para el IRPF y el régimen general para el IVA. Si no
            estás seguro, déjalos así: podrás cambiarlos en Configuración › Impuestos.
          </p>
        </div>
      </details>
    </>
  );
}

function IdentityStep({ profile, set, errors }: { profile: BusinessProfile; set: SetProfile; errors: ProfileErrors }) {
  const company = profile.kind === "company";
  const name = businessName(profile);
  return (
    <>
      <Field
        label={company ? "CIF" : "NIF"}
        required
        error={errors.taxId}
        help="Se comprueba la letra o el dígito de control. Es el que figura en tu alta censal (modelo 036 o 037)."
      >
        {(p) => (
          <Input
            {...p}
            value={profile.taxId}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => set("taxId", e.target.value)}
            className="font-mono uppercase"
          />
        )}
      </Field>
      {company ? (
        <Field label="Razón social" required error={errors.legalName}>
          {(p) => (
            <Input
              {...p}
              value={profile.legalName}
              autoComplete="organization"
              onChange={(e) => set("legalName", e.target.value)}
            />
          )}
        </Field>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" required error={errors.firstName} className="sm:col-span-2">
            {(p) => (
              <Input
                {...p}
                value={profile.firstName}
                autoComplete="given-name"
                onChange={(e) => set("firstName", e.target.value)}
              />
            )}
          </Field>
          <Field label="Primer apellido" required error={errors.lastName}>
            {(p) => (
              <Input
                {...p}
                value={profile.lastName}
                autoComplete="family-name"
                onChange={(e) => set("lastName", e.target.value)}
              />
            )}
          </Field>
          <Field label="Segundo apellido">
            {(p) => (
              <Input {...p} value={profile.secondLastName} onChange={(e) => set("secondLastName", e.target.value)} />
            )}
          </Field>
        </div>
      )}
      <Field
        label="Nombre a mostrar en las facturas"
        hint={`Tu nombre comercial, si tienes. Vacío, se usa ${company ? "la razón social" : "el nombre completo"}.`}
      >
        {(p) => (
          <Input
            {...p}
            value={profile.tradeName}
            placeholder={fullName(profile)}
            onChange={(e) => set("tradeName", e.target.value)}
          />
        )}
      </Field>
      <Field label="Teléfono">
        {(p) => (
          <Input
            {...p}
            type="tel"
            value={profile.phone}
            autoComplete="tel"
            onChange={(e) => set("phone", e.target.value)}
          />
        )}
      </Field>
      {name && (
        <p className="m-0 flex flex-col gap-0.5 rounded-lg bg-muted px-4 py-3">
          <span className="text-2xs tracking-wide text-muted-foreground uppercase">Así apareces en tus facturas</span>
          <span className="font-semibold">{name}</span>
          {profile.taxId.trim() && (
            <span className="text-sm text-muted-foreground">
              {company ? "CIF" : "NIF"} {normalizeTaxId(profile.taxId)}
            </span>
          )}
        </p>
      )}
    </>
  );
}

function ActivityStep({ tax, set }: { tax: TaxSetup; set: SetTax }) {
  const main = tax.activities[0];
  if (main)
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <Star className="size-3.5 fill-current" aria-hidden="true" />
            Actividad principal
          </span>
          <span>
            {main.code && <span className="font-mono text-muted-foreground">{main.code}</span>} {main.name}
          </span>
          <span className="text-sm text-muted-foreground">Si tienes más, añádelas en Configuración › Impuestos.</span>
        </div>
        <Button variant="secondary" size="sm" onClick={() => set("activities", [])}>
          Cambiar
        </Button>
      </div>
    );
  return <ActivityPicker existing={tax.activities} onPick={(a) => set("activities", [a])} listClassName="max-h-64" />;
}

const SYSTEMS: { value: InvoicingSystem; label: string; hint: string }[] = [
  {
    value: "exempt",
    label: "Todavía no",
    hint: "Emites tus facturas como hasta ahora, sin enviarlas a Hacienda.",
  },
  {
    value: "verifactu",
    label: "Sí, activar",
    hint: "Cada factura se envía a la AEAT al emitirla. Una vez emitas la primera, sigues en el sistema hasta el 31 de diciembre.",
  },
];

function VerifactuStep({ setup, set }: { setup: Setup; set: (system: InvoicingSystem) => void }) {
  const kind = setup.profile.kind;
  const mandatoryFrom = verifactuMandatoryFrom(kind);
  const mandatory = isVerifactuMandatory(kind, setup.verifactu.startDate);
  return (
    <>
      <div role="radiogroup" aria-label="Sistema de facturación" className="flex flex-col gap-3">
        {SYSTEMS.map((option) => {
          const selected = setup.verifactu.system === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition-[background-color,border-color] duration-150 hover:bg-accent",
                selected ? "border-primary ring-1 ring-primary" : "border-border",
              )}
            >
              <input
                type="radio"
                name="verifactu"
                checked={selected}
                onChange={() => set(option.value)}
                className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-x-2 font-medium">
                  {option.label}
                  {option.value === "verifactu" && (
                    // The logo is drawn for a light background
                    <img
                      src={verifactuLogo}
                      alt="VERI*FACTU"
                      width={480}
                      height={113}
                      className="dark:rounded h-6 w-auto dark:box-content dark:bg-white dark:px-1.5 dark:py-0.5"
                    />
                  )}
                </span>
                <span className="text-sm text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="m-0 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
        {mandatory
          ? `Como ${kind === "company" ? "sociedad" : "autónomo"}, VERI*FACTU ya es obligatorio para ti salvo que una resolución te exima. Podrás indicarla en Configuración › VERI*FACTU.`
          : `Como ${kind === "company" ? "sociedad" : "autónomo"}, será obligatorio a partir del ${formatDate(mandatoryFrom)}. Hasta entonces puedes activarlo cuando quieras en Configuración › VERI*FACTU.`}
      </p>
    </>
  );
}

/**
 * Once the business exists, where the instance charges for it: straight into the app on
 * the free trial, or paying now in Stripe Checkout, which keeps the trial's days.
 */
function PlanStep() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [pending, setPending] = useState<"trial" | "subscribe" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The business was created a moment ago, so its trial ends 30 days from now
  const [trialEnd] = useState(() =>
    formatDate(localDate(new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString())),
  );

  const startTrial = () => {
    setPending("trial");
    reloadAt("/");
  };

  const subscribe = async () => {
    setPending("subscribe");
    setError(null);
    try {
      window.location.assign(await startCheckout(period));
    } catch {
      setError(
        "No se ha podido conectar con el sistema de pago. Empieza la prueba y suscríbete cuando quieras desde Configuración › Plan y facturación.",
      );
      setPending(null);
    }
  };

  return (
    <div className="flex animate-rise-in flex-col gap-6">
      <div className="flex flex-col gap-3">
        <AuthButton onClick={startTrial} disabled={pending !== null}>
          {pending === "trial" ? "Un momento…" : "Empezar la prueba gratis"}
        </AuthButton>
        <p className="m-0 text-center text-sm text-muted-foreground">Gratis hasta el {trialEnd}, sin tarjeta.</p>
      </div>

      <section aria-labelledby="subscribe-now" className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 id="subscribe-now" className="m-0 text-md font-semibold">
          ¿Ya sabes que te quedas?
        </h2>
        <PeriodPicker rows value={period} onChange={setPeriod} />
        <p className="m-0 text-sm text-muted-foreground">
          Conservas tus 30 días: te pedimos la tarjeta ahora y el primer cobro llega el {trialEnd}. Precios sin IVA, al
          pagar se añade el 21 %. Cancela cuando quieras.
        </p>
        {error && (
          <p role="alert" className="m-0 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button variant="secondary" size="lg" onClick={() => void subscribe()} disabled={pending !== null}>
          {pending === "subscribe" && <Loader2 className="animate-spin" aria-hidden="true" />}
          Suscribirme ya
        </Button>
      </section>
    </div>
  );
}

/**
 * After signing up: a code to confirm the email, if it needs verifying, then the business's tax setup, tax ID and name, address,
 * activity and whether to send its invoices with VERI*FACTU, step by step. The business is created then, with everything
 * at once, and the app opens with the first-run tour; on Cloud, after a last step to start the trial or subscribe.
 */
export function OnboardingPage() {
  // The email to confirm, or null when it needs no verifying; undefined until known
  const [verifying, setVerifying] = useState<string | null>();
  const [billing, setBilling] = useState(false);
  const [setup, setSetup] = useState(newSetup);
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Saving the settings can fail after the business was created: a retry mustn't create another
  const created = useRef(false);

  const steps = onboardingSteps(Boolean(verifying), billing);
  const current = steps[step]!;
  const creates = current.key === CREATES_BUSINESS;

  useEffect(() => {
    Promise.all([currentUser(), signInMethods()])
      .then(([user, methods]) => {
        setBilling(methods.billing);
        setVerifying(methods.email && !user.emailVerified ? user.email : null);
      })
      // Unknown: the wizard goes on without it, and the app reminds the user later
      .catch(() => setVerifying(null));
  }, []);
  const errors = stepErrors(current.key, setup);
  // Once the activity is chosen, "later" would throw it away
  const skippable = current.optional && !(current.key === "activity" && setup.tax.activities.length > 0);

  const setProfile: SetProfile = (key, value) => setSetup((s) => ({ ...s, profile: { ...s.profile, [key]: value } }));
  const setTax: SetTax = (key, value) => setSetup((s) => ({ ...s, tax: { ...s.tax, [key]: value } }));

  const goTo = (next: number) => {
    setStep(next);
    setShowErrors(false);
    setError(null);
    window.scrollTo({ top: 0 });
  };

  const finish = (done: Setup) =>
    runAction(
      async () => {
        if (!created.current) {
          await createOrganization(organizationName(done));
          created.current = true;
        }
        await saveSettings(setupCommands(done));
        if (billing) {
          setPending(false);
          goTo(step + 1);
        } else reloadAt("/");
      },
      setPending,
      setError,
      authErrorMessage,
    );

  const next = () => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    if (creates) void finish(setup);
    else goTo(step + 1);
  };

  const skip = () => {
    const skipped = skipStep(current.key, setup);
    setSetup(skipped);
    if (creates) void finish(skipped);
    else goTo(step + 1);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    next();
  };

  // A moment, so the steps don't shift once it's known whether the email needs confirming
  if (verifying === undefined) return null;

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <AuthLayout
        wide
        eyebrow={<Progress steps={steps} step={step} />}
        title={current.title}
        description={current.description}
      >
        {current.key === "email" && verifying ? (
          <div key="email" className="animate-rise-in">
            <EmailCode
              large
              email={verifying}
              // Its step goes away, so the one after it is now the current one
              onVerified={() => setVerifying(null)}
              onLater={() => goTo(step + 1)}
            />
          </div>
        ) : current.key === "plan" ? (
          <PlanStep />
        ) : (
          <form key={current.key} onSubmit={submit} noValidate className="flex animate-rise-in flex-col gap-4">
            {current.key === "regime" && <RegimeStep setup={setup} setProfile={setProfile} setTax={setTax} />}
            {current.key === "identity" && (
              <IdentityStep profile={setup.profile} set={setProfile} errors={showErrors ? errors : {}} />
            )}
            {current.key === "address" && <AddressFields compact draft={setup.profile} set={setProfile} />}
            {current.key === "activity" && <ActivityStep tax={setup.tax} set={setTax} />}
            {current.key === "verifactu" && (
              <VerifactuStep
                setup={setup}
                set={(system) => setSetup((s) => ({ ...s, verifactu: { ...s.verifactu, system } }))}
              />
            )}

            {error && (
              <p role="alert" className="m-0 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <AuthButton type="submit" disabled={pending} className="mt-1">
              {pending ? "Un momento…" : creates && !billing ? "Empezar" : "Continuar"}
            </AuthButton>
            <div className="flex items-center justify-between gap-3">
              {step > 0 ? (
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => goTo(step - 1)}>
                  <ChevronLeft aria-hidden="true" />
                  Atrás
                </Button>
              ) : (
                <span />
              )}
              {skippable && (
                <Button variant="ghost" size="sm" disabled={pending} onClick={skip}>
                  Lo haré más tarde
                </Button>
              )}
            </div>
          </form>
        )}
      </AuthLayout>
    </TooltipProvider>
  );
}

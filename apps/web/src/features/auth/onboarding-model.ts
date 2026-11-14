import { normalizeTaxId } from "@cuentalibre/core";
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  type Billing,
  type BusinessProfile,
  type SyncCommand,
  type TaxSetup,
} from "@cuentalibre/contracts";
import { businessName, profileErrors, type ProfileErrors } from "@/features/settings/settings-model";

/** What the wizard gathers before the business exists: its profile and its tax setup. */
export interface Setup {
  profile: BusinessProfile;
  tax: TaxSetup;
}

export const newSetup = (): Setup => ({
  profile: DEFAULT_ORGANIZATION_SETTINGS.businessProfile,
  tax: DEFAULT_ORGANIZATION_SETTINGS.taxSetup,
});

export interface OnboardingStep {
  key: "email" | "regime" | "identity" | "address" | "activity" | "plan";
  /** Name in the progress bar. */
  label: string;
  title: string;
  description: string;
  /** Whether it can be left for later, from Configuración. */
  optional: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: "email",
    label: "Email",
    title: "Confirma tu email",
    description: "Para recuperar tu cuenta si olvidas la contraseña.",
    optional: true,
  },
  {
    key: "regime",
    label: "Régimen fiscal",
    title: "Tu régimen fiscal",
    description: "Decide qué impuestos presentas y cómo se calculan. Si no lo sabes, deja lo que viene marcado.",
    optional: false,
  },
  {
    key: "identity",
    label: "Datos fiscales",
    title: "Tus datos fiscales",
    description: "Toda factura lleva el nombre y el NIF de quien la emite.",
    optional: false,
  },
  {
    key: "address",
    label: "Dirección",
    title: "Tu dirección fiscal",
    description: "La de tu alta en Hacienda. Hace falta para emitir facturas completas.",
    optional: true,
  },
  {
    key: "activity",
    label: "Actividad",
    title: "¿A qué te dedicas?",
    description: "Tu actividad principal, con el epígrafe del IAE de tu alta (modelo 036 o 037).",
    optional: true,
  },
  {
    key: "plan",
    label: "Plan",
    title: "Tienes 30 días gratis",
    description: "Pruébalo todo gratis o suscríbete ya.",
    optional: false,
  },
];

/**
 * The wizard's steps: confirming the email first, while it isn't verified and the
 * instance can send email (Google users come verified); and, once the business
 * exists, its plan, only where the instance charges for one (cuentalibre Cloud).
 */
export const onboardingSteps = (verifyEmail: boolean, billing = false) =>
  ONBOARDING_STEPS.filter((step) => (verifyEmail || step.key !== "email") && (billing || step.key !== "plan"));

/**
 * Back on the wizard once the business exists (from Stripe Checkout, or the browser's history):
 * the plan is all that is left to choose while the trial runs and it has never subscribed.
 * Otherwise, and without a plan to charge (`null`), the app is where to go.
 */
export const resumesAtPlan = (billing: Billing | null): billing is Billing =>
  billing !== null && billing.plan.status === "trial" && billing.subscription === null;

/** The step whose end creates the business, with everything gathered until then. */
export const CREATES_BUSINESS: OnboardingStep["key"] = "activity";

/** What leaving a step for later keeps: nothing of the activity, whatever was typed elsewhere. */
export function skipStep(step: OnboardingStep["key"], setup: Setup): Setup {
  if (step === "activity") return { ...setup, tax: { ...setup.tax, activities: [] } };
  return setup;
}

/** What stops the user from leaving a step: only the tax ID and the name are required. */
export function stepErrors(step: OnboardingStep["key"], setup: Setup): ProfileErrors {
  return step === "identity" ? profileErrors(setup.profile) : {};
}

/** The business is named after the name on its invoices; the user never sees the organization apart. */
export const organizationName = (setup: Setup) => businessName(setup.profile);

/** The settings sections the wizard saves once the business exists. */
export function setupCommands({ profile, tax }: Setup): SyncCommand[] {
  return [
    { type: "saveSettings", section: "businessProfile", data: { ...profile, taxId: normalizeTaxId(profile.taxId) } },
    { type: "saveSettings", section: "taxSetup", data: tax },
  ];
}

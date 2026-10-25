import { normalizeTaxId } from "@cuentalibre/core";
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  type Billing,
  type BusinessProfile,
  type SyncCommand,
  type TaxSetup,
  type VerifactuSetup,
} from "@cuentalibre/contracts";
import { businessName, profileErrors, type ProfileErrors } from "@/features/settings/settings-model";

/** What the wizard gathers before the business exists: its profile, its tax setup and its invoicing system. */
export interface Setup {
  profile: BusinessProfile;
  tax: TaxSetup;
  verifactu: VerifactuSetup;
}

/** VERI*FACTU starts off: the business is exempt unless the user turns it on. Either applies from the day it's created. */
export const newSetup = (today = new Date().toISOString().slice(0, 10)): Setup => ({
  profile: DEFAULT_ORGANIZATION_SETTINGS.businessProfile,
  tax: DEFAULT_ORGANIZATION_SETTINGS.taxSetup,
  verifactu: { ...DEFAULT_ORGANIZATION_SETTINGS.verifactu, system: "exempt", startDate: today },
});

export interface OnboardingStep {
  key: "email" | "regime" | "identity" | "address" | "activity" | "verifactu" | "plan";
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
    description: "Así sabremos que está bien escrito y podrás recuperar tu cuenta si olvidas la contraseña.",
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
    key: "verifactu",
    label: "VERI*FACTU",
    title: "¿Envías tus facturas a Hacienda?",
    description:
      "Con VERI*FACTU, cada factura que emites se comunica a la AEAT en el momento. Puedes activarlo cuando quieras.",
    optional: true,
  },
  {
    key: "plan",
    label: "Plan",
    title: "Tienes 30 días gratis",
    description: "Usa cuentalibre entero, sin tarjeta. Si ya sabes que te quedas, puedes suscribirte ahora.",
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
export const CREATES_BUSINESS: OnboardingStep["key"] = "verifactu";

/**
 * What leaving a step for later keeps: nothing of the activity or the invoicing
 * system, which go back to none and exempt; whatever was typed elsewhere.
 */
export function skipStep(step: OnboardingStep["key"], setup: Setup): Setup {
  if (step === "activity") return { ...setup, tax: { ...setup.tax, activities: [] } };
  if (step === "verifactu") return { ...setup, verifactu: { ...setup.verifactu, system: "exempt" } };
  return setup;
}

/** What stops the user from leaving a step: only the tax ID and the name are required. */
export function stepErrors(step: OnboardingStep["key"], setup: Setup): ProfileErrors {
  return step === "identity" ? profileErrors(setup.profile) : {};
}

/** The business is named after the name on its invoices; the user never sees the organization apart. */
export const organizationName = (setup: Setup) => businessName(setup.profile);

/** The settings sections the wizard saves once the business exists. */
export function setupCommands({ profile, tax, verifactu }: Setup): SyncCommand[] {
  return [
    { type: "saveSettings", section: "businessProfile", data: { ...profile, taxId: normalizeTaxId(profile.taxId) } },
    { type: "saveSettings", section: "taxSetup", data: tax },
    { type: "saveSettings", section: "verifactu", data: verifactu },
  ];
}

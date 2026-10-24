import { normalizeTaxId } from "@cuentalibre/core";
import {
  DEFAULT_ORGANIZATION_SETTINGS,
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
  key: "email" | "regime" | "identity" | "address" | "activity";
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
];

/**
 * The wizard's steps: confirming the email first, while it isn't verified and the
 * instance can send email. Google users come verified.
 */
export const onboardingSteps = (verifyEmail: boolean) =>
  ONBOARDING_STEPS.filter((step) => verifyEmail || step.key !== "email");

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

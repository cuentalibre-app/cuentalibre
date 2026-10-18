import {
  DEFAULT_ORGANIZATION_SETTINGS,
  organizationSettingsSchema,
  type OrganizationSettings,
  type SettingsSection,
} from "@fiscalia/contracts";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Tx } from "../db/client";
import { organizationSetting, paymentMethod } from "../db/schema";
import { ApiError } from "../errors";
import { parseOr } from "./records";

/** Replaces a section of the organization's settings with `data`, validated with the section's schema. */
export async function saveSettings(tx: Tx, organizationId: string, section: SettingsSection, data: unknown) {
  const parsed = parseOr(organizationSettingsSchema.shape[section], data, "invalid_settings");
  if (section === "defaultPaymentMethod" && parsed) await checkPaymentMethod(tx, organizationId, parsed as string);
  await tx
    .insert(organizationSetting)
    .values({ organizationId, section, data: parsed })
    .onConflictDoUpdate({
      target: [organizationSetting.organizationId, organizationSetting.section],
      set: { data: parsed },
    });
}

async function checkPaymentMethod(tx: Tx, organizationId: string, id: string) {
  const [found] = await tx
    .select({ id: paymentMethod.id })
    .from(paymentMethod)
    .where(
      and(eq(paymentMethod.organizationId, organizationId), eq(paymentMethod.id, id), isNull(paymentMethod.deletedAt)),
    );
  if (!found) throw new ApiError(400, "invalid_settings", "No such payment method.");
}

/** Every section: as saved, or its defaults. */
export async function readSettings(tx: Tx, organizationId: string): Promise<OrganizationSettings> {
  const rows = await tx
    .select()
    .from(organizationSetting)
    .where(eq(organizationSetting.organizationId, organizationId));
  return { ...DEFAULT_ORGANIZATION_SETTINGS, ...Object.fromEntries(rows.map((row) => [row.section, row.data])) };
}

/** The saved sections among the given ones. */
export function settingsBySection(tx: Tx, organizationId: string, sections: string[]) {
  if (sections.length === 0) return Promise.resolve([]);
  return tx
    .select()
    .from(organizationSetting)
    .where(
      and(
        eq(organizationSetting.organizationId, organizationId),
        inArray(organizationSetting.section, sections as SettingsSection[]),
      ),
    );
}

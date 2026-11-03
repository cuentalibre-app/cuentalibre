import {
  DEFAULT_ORGANIZATION_SETTINGS,
  invoiceSeriesList,
  isBuiltInSeries,
  organizationSettingsSchema,
  type InvoiceSettings,
  type OrganizationSettings,
  type SettingsSection,
} from "@cuentalibre/contracts";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { Tx } from "../db/client";
import { organizationSetting, paymentMethod, salesDocument } from "../db/schema";
import { ApiError } from "../errors";

import { parseOr } from "./records";

/** Replaces a section of the organization's settings with `data`, validated with the section's schema. */
export async function saveSettings(tx: Tx, organizationId: string, section: SettingsSection, data: unknown) {
  const parsed = parseOr(organizationSettingsSchema.shape[section], data, "invalid_settings");
  if (section === "defaultPaymentMethod" && parsed) await checkPaymentMethod(tx, organizationId, parsed as string);
  if (section === "invoiceSettings") await checkUsedSeries(tx, organizationId, parsed as InvoiceSettings);
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

/**
 * A series that numbers invoices or drafts keeps its type and mask, or their
 * numbers would no longer follow it: it can be renamed or deactivated, but not
 * removed. Built-in series number the documents without a `seriesId`.
 */
async function checkUsedSeries(tx: Tx, organizationId: string, next: InvoiceSettings) {
  const { invoiceSettings } = await readSettings(tx, organizationId);
  const after = invoiceSeriesList(next.series);
  const changed = invoiceSeriesList(invoiceSettings.series).filter((before) => {
    const now = after.find((series) => series.id === before.id);
    return !now || now.type !== before.type || now.mask !== before.mask;
  });
  if (changed.length === 0) return;
  const custom = changed.filter((series) => !isBuiltInSeries(series.id)).map((series) => series.id);
  const builtIn = changed.filter((series) => isBuiltInSeries(series.id)).map((series) => series.type);
  const [used] = await tx
    .select({ id: salesDocument.id })
    .from(salesDocument)
    .where(
      and(
        eq(salesDocument.organizationId, organizationId),
        isNull(salesDocument.deletedAt),
        inArray(salesDocument.kind, ["invoice", "draft"]),
        or(
          custom.length > 0 ? inArray(salesDocument.seriesId, custom) : undefined,
          builtIn.length > 0 ? and(isNull(salesDocument.seriesId), inArray(salesDocument.series, builtIn)) : undefined,
        ),
      ),
    )
    .limit(1);
  if (used)
    throw new ApiError(
      409,
      "series_in_use",
      "A series that numbers invoices or drafts can't be removed or change its type or mask.",
    );
}

/** Every section: as saved, or its defaults. */
export async function readSettings(tx: Tx, organizationId: string): Promise<OrganizationSettings> {
  const rows = await tx
    .select()
    .from(organizationSetting)
    .where(eq(organizationSetting.organizationId, organizationId));
  return {
    ...DEFAULT_ORGANIZATION_SETTINGS,
    ...Object.fromEntries(rows.map((row) => [row.section, withDefaults(row.section, row.data)])),
  };
}

/**
 * A saved section over its defaults, so settings added after it was saved
 * read as their default instead of missing.
 */
export function withDefaults(section: SettingsSection, data: unknown): unknown {
  const defaults = DEFAULT_ORGANIZATION_SETTINGS[section];
  const isObject = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);
  return isObject(defaults) && isObject(data) ? { ...(defaults as object), ...(data as object) } : data;
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

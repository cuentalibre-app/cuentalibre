import { z } from "zod";
import { id } from "./common";

export const genderSchema = z.enum(["", "male", "female"]);
export type Gender = z.infer<typeof genderSchema>;

export const userProfileSchema = z.object({
  /** Contact and sign-in email; changed through support, not on the profile page. */
  email: z.email(),
  /** Object URL of the chosen picture, kept in memory. */
  avatarUrl: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
  /** ISO date (yyyy-mm-dd); empty when not given. */
  birthDate: z.string(),
  phone: z.string(),
  gender: genderSchema,
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const notificationPrefsSchema = z.object({
  appByEmail: z.boolean(),
  appByPush: z.boolean(),
  promosByEmail: z.boolean(),
  promosByPush: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

/** Empty values follow the business defaults. */
export const userLocaleSchema = z.object({
  language: z.string(),
  numberFormat: z.string(),
  timeZone: z.string(),
});
export type UserLocale = z.infer<typeof userLocaleSchema>;

export const linkedProviderSchema = z.enum(["google", "apple"]);
export type LinkedProvider = z.infer<typeof linkedProviderSchema>;

export const userAccessSchema = z.object({
  /** When the password was last changed (ISO date). */
  passwordChangedAt: z.string(),
  twoFactor: z.boolean(),
  /** Linked sign-in accounts and the email of each. */
  linked: z.partialRecord(linkedProviderSchema, z.string()),
});
export type UserAccess = z.infer<typeof userAccessSchema>;

/** A person whose working hours are recorded. */
export const workerSchema = z.object({
  id,
  name: z.string(),
  email: z.string(),
  /** The business owner; the others are employees. */
  owner: z.boolean(),
});
export type Worker = z.infer<typeof workerSchema>;

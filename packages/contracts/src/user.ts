import { z } from "zod";
import { isoDate } from "./common";
import { membershipSchema } from "./organizations";

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

/** How the first-run tour went: it shows by itself while "pending", and never again once finished or skipped. */
export const tourStatusSchema = z.enum(["pending", "finished", "skipped"]);
export type TourStatus = z.infer<typeof tourStatusSchema>;

export const userTourSchema = z.object({ status: tourStatusSchema });
export type UserTour = z.infer<typeof userTourSchema>;

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

/**
 * The signed-in user's own settings as the server stores them, one document per
 * section. The profile leaves out the email, which belongs to the account, and
 * the picture, which isn't stored yet.
 */
export const userSettingsSchema = z.object({
  userProfile: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().max(200),
    birthDate: isoDate.or(z.literal("")),
    phone: z.string().max(40),
    gender: genderSchema,
  }),
  userLocale: z.object({
    language: z.string().max(20),
    numberFormat: z.string().max(20),
    timeZone: z.string().max(60),
  }),
  userTour: userTourSchema,
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const userSettingsSectionSchema = userSettingsSchema.keyof();
export type UserSettingsSection = z.infer<typeof userSettingsSectionSchema>;

/** The signed-in user, the organizations they belong to and their own settings (`GET /v1/me`). */
export const meSchema = z.object({
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    /** Users who sign up with Google come verified. */
    emailVerified: z.boolean(),
    /** False for people who only sign in with Google. */
    hasPassword: z.boolean(),
    /** When the password was last set; null without one. */
    passwordChangedAt: z.iso.datetime().nullable(),
  }),
  activeOrganizationId: z.uuid().nullable(),
  memberships: z.array(membershipSchema),
  settings: userSettingsSchema,
});
export type Me = z.infer<typeof meSchema>;

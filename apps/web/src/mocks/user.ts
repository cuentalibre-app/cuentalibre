/** Sample signed-in user until there is a backend. Made up; matches the sample business profile. */

export type Gender = "" | "male" | "female";

export interface UserProfile {
  /** Contact and sign-in email; changed through support, not on the profile page. */
  email: string;
  /** Object URL of the chosen picture, kept in memory. */
  avatarUrl: string | null;
  firstName: string;
  lastName: string;
  /** ISO date (yyyy-mm-dd). */
  birthDate: string;
  phone: string;
  gender: Gender;
}

export interface NotificationPrefs {
  appByEmail: boolean;
  appByPush: boolean;
  promosByEmail: boolean;
  promosByPush: boolean;
}

/** Empty values follow the business defaults. */
export interface UserLocale {
  language: string;
  numberFormat: string;
  timeZone: string;
}

export type LinkedProvider = "google" | "apple";

export interface UserAccess {
  /** When the password was last changed (ISO date). */
  passwordChangedAt: string;
  twoFactor: boolean;
  /** Linked sign-in accounts and the email of each. */
  linked: Partial<Record<LinkedProvider, string>>;
}

export const initialUserProfile: UserProfile = {
  email: "hola@luciamartin.es",
  avatarUrl: null,
  firstName: "Lucía",
  lastName: "Martín Ortega",
  birthDate: "1991-03-14",
  phone: "612 345 678",
  gender: "female",
};

export const initialNotificationPrefs: NotificationPrefs = {
  appByEmail: true,
  appByPush: true,
  promosByEmail: false,
  promosByPush: false,
};

export const initialUserLocale: UserLocale = { language: "", numberFormat: "", timeZone: "" };

export const initialUserAccess: UserAccess = {
  passwordChangedAt: "2026-05-02",
  twoFactor: false,
  linked: { google: "lucia.martin.ortega@gmail.com" },
};

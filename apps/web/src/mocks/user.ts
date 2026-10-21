import type { NotificationPrefs, UserAccess, UserLocale, UserProfile } from "@cuentalibre/contracts";

/** Sample signed-in user until there is a backend. Made up; matches the sample business profile. */

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

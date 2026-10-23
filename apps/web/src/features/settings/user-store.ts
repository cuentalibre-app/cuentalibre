import type {
  NotificationPrefs,
  TourStatus,
  UserAccess,
  UserLocale,
  UserProfile,
  UserTour,
} from "@cuentalibre/contracts";
import type { SettingsSection } from "@/data/commands";
import { createStore } from "@/data/store";
import { syncMe } from "@/data/sync";
import {
  initialNotificationPrefs,
  initialUserAccess,
  initialUserLocale,
  initialUserProfile,
  initialUserTour,
} from "@/mocks/user";

/** The signed-in user's own settings. */
export interface UserSettings {
  profile: UserProfile;
  notifications: NotificationPrefs;
  locale: UserLocale;
  access: UserAccess;
  tour: UserTour;
}

const user = createStore<UserSettings>({
  profile: initialUserProfile,
  notifications: initialNotificationPrefs,
  locale: initialUserLocale,
  access: initialUserAccess,
  tour: initialUserTour,
});

// Signed in, the profile, locale and tour are the account's; the picture and notifications stay sample data for now.
syncMe(({ user: account, settings }) =>
  user.set({
    ...user.get(),
    profile: { ...settings.userProfile, email: account.email, avatarUrl: null },
    locale: settings.userLocale,
    tour: settings.userTour,
  }),
);

export function useUserSettings(): UserSettings {
  return user.use();
}

const SECTIONS = {
  profile: "userProfile",
  notifications: "notificationPrefs",
  locale: "userLocale",
  access: "userAccess",
  tour: "userTour",
} satisfies Record<keyof UserSettings, SettingsSection>;

function save<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
  return user.write({ ...user.get(), [key]: value }, [{ type: "saveSettings", section: SECTIONS[key], data: value }]);
}

export const userStore = {
  get: user.get,
  updateProfile: (profile: UserProfile) => save("profile", profile),
  updateNotifications: (notifications: NotificationPrefs) => save("notifications", notifications),
  updateLocale: (locale: UserLocale) => save("locale", locale),
  updateAccess: (changes: Partial<UserAccess>) => save("access", { ...user.get().access, ...changes }),
  setTourStatus: (status: TourStatus) => save("tour", { status }),
};

/** "Lucía Martín Ortega". */
export const userFullName = (profile: UserProfile) =>
  [profile.firstName, profile.lastName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");

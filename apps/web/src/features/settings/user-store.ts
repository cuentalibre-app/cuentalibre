import type { NotificationPrefs, UserAccess, UserLocale, UserProfile } from "@fiscalia/contracts";
import type { SettingsSection } from "@/data/commands";
import { createStore } from "@/data/store";
import { initialNotificationPrefs, initialUserAccess, initialUserLocale, initialUserProfile } from "@/mocks/user";

/** The signed-in user's own settings. */
export interface UserSettings {
  profile: UserProfile;
  notifications: NotificationPrefs;
  locale: UserLocale;
  access: UserAccess;
}

const user = createStore<UserSettings>({
  profile: initialUserProfile,
  notifications: initialNotificationPrefs,
  locale: initialUserLocale,
  access: initialUserAccess,
});

export function useUserSettings(): UserSettings {
  return user.use();
}

const SECTIONS = {
  profile: "userProfile",
  notifications: "notificationPrefs",
  locale: "userLocale",
  access: "userAccess",
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
};

/** "Lucía Martín Ortega". */
export const userFullName = (profile: UserProfile) =>
  [profile.firstName, profile.lastName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");

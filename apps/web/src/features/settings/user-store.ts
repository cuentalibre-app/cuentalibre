import {
  DEFAULT_LIST_PREFERENCES,
  type ListPreferences,
  type NotificationPrefs,
  type TourStatus,
  type UserAccess,
  type UserProfile,
  type UserTour,
} from "@cuentalibre/contracts";
import type { SettingsSection } from "@/data/commands";
import { createStore } from "@/data/store";
import { syncMe } from "@/data/sync";
import { initialNotificationPrefs, initialUserAccess, initialUserProfile, initialUserTour } from "@/mocks/user";

/** The signed-in user's own settings. */
export interface UserSettings {
  profile: UserProfile;
  notifications: NotificationPrefs;
  access: UserAccess;
  tour: UserTour;
  /** The filters the quote and delivery note lists open with. */
  lists: ListPreferences;
}

const user = createStore<UserSettings>({
  profile: initialUserProfile,
  notifications: initialNotificationPrefs,
  access: initialUserAccess,
  tour: initialUserTour,
  lists: DEFAULT_LIST_PREFERENCES,
});

/** Whether the account's email is verified; the demo's is. The API changes it, not commands. */
const emailVerification = createStore({ verified: true });

// Signed in, the profile, tour and list filters are the account's; the picture and notifications stay sample data for now.
syncMe(({ user: account, settings }) => {
  user.set({
    ...user.get(),
    profile: { ...settings.userProfile, email: account.email, avatarUrl: null },
    tour: settings.userTour,
    lists: settings.listPreferences,
  });
  emailVerification.set({ verified: account.emailVerified });
});

export function useUserSettings(): UserSettings {
  return user.use();
}

const SECTIONS = {
  profile: "userProfile",
  notifications: "notificationPrefs",
  access: "userAccess",
  tour: "userTour",
  lists: "listPreferences",
} satisfies Record<keyof UserSettings, SettingsSection>;

function save<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
  return user.write({ ...user.get(), [key]: value }, [{ type: "saveSettings", section: SECTIONS[key], data: value }]);
}

export const userStore = {
  get: user.get,
  updateProfile: (profile: UserProfile) => save("profile", profile),
  updateNotifications: (notifications: NotificationPrefs) => save("notifications", notifications),
  updateAccess: (changes: Partial<UserAccess>) => save("access", { ...user.get().access, ...changes }),
  setTourStatus: (status: TourStatus) => save("tour", { status }),
  updateListPreferences: (lists: ListPreferences) => save("lists", lists),
  /** The user verified `email` with a code, maybe switching to it. */
  emailVerified: (email: string) => {
    user.set({ ...user.get(), profile: { ...user.get().profile, email } });
    emailVerification.set({ verified: true });
  },
};

export const useEmailVerified = () => emailVerification.use().verified;

/** "Lucía Martín Ortega". */
export const userFullName = (profile: UserProfile) =>
  [profile.firstName, profile.lastName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");

import { useSyncExternalStore } from "react";
import {
  initialNotificationPrefs,
  initialUserAccess,
  initialUserLocale,
  initialUserProfile,
  type NotificationPrefs,
  type UserAccess,
  type UserLocale,
  type UserProfile,
} from "@/mocks/user";

/** The signed-in user's own settings, in memory until reload like the other stores. */
export interface UserSettings {
  profile: UserProfile;
  notifications: NotificationPrefs;
  locale: UserLocale;
  access: UserAccess;
}

let user: UserSettings = {
  profile: initialUserProfile,
  notifications: initialNotificationPrefs,
  locale: initialUserLocale,
  access: initialUserAccess,
};
const listeners = new Set<() => void>();

function commit(changes: Partial<UserSettings>) {
  user = { ...user, ...changes };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUserSettings(): UserSettings {
  return useSyncExternalStore(subscribe, () => user);
}

export const userStore = {
  get: () => user,
  updateProfile: (profile: UserProfile) => commit({ profile }),
  updateNotifications: (notifications: NotificationPrefs) => commit({ notifications }),
  updateLocale: (locale: UserLocale) => commit({ locale }),
  updateAccess: (changes: Partial<UserAccess>) => commit({ access: { ...user.access, ...changes } }),
};

/** "Lucía Martín Ortega". */
export const userFullName = (profile: UserProfile) =>
  [profile.firstName, profile.lastName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");

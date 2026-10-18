import { DEFAULT_ORGANIZATION_SETTINGS, type ContactSettings } from "@fiscalia/contracts";
import { createStore } from "@/data/store";
import { syncSettings } from "@/data/sync";

export const DEFAULT_CUSTOM_FIELD_NAMES = DEFAULT_ORGANIZATION_SETTINGS.contactSettings.customFieldNames;

const settings = createStore<ContactSettings>(DEFAULT_ORGANIZATION_SETTINGS.contactSettings);
syncSettings("contactSettings", settings.set);

export function useContactSettings(): ContactSettings {
  return settings.use();
}

export const contactSettingsStore = {
  get: settings.get,
  update(changes: Partial<ContactSettings>) {
    const next = { ...settings.get(), ...changes };
    return settings.write(next, [{ type: "saveSettings", section: "contactSettings", data: next }]);
  },
};

/** The custom field labels, falling back to the default name when one is left blank. */
export const customFieldLabels = ({ customFieldNames }: ContactSettings = settings.get()): [string, string] => [
  customFieldNames[0].trim() || DEFAULT_CUSTOM_FIELD_NAMES[0],
  customFieldNames[1].trim() || DEFAULT_CUSTOM_FIELD_NAMES[1],
];

export const useCustomFieldLabels = () => customFieldLabels(useContactSettings());

import { useSyncExternalStore } from "react";

/** Options of Configuración › Clientes y proveedores, in memory until reload like the other stores. */
export interface ContactSettings {
  /** Names of the two free fields of every client and supplier. */
  customFieldNames: [string, string];
  /** Look up the company's details from its NIF or name when creating a contact. */
  autocomplete: boolean;
}

export const DEFAULT_CUSTOM_FIELD_NAMES: ContactSettings["customFieldNames"] = ["Personalizado 1", "Personalizado 2"];

let settings: ContactSettings = { customFieldNames: DEFAULT_CUSTOM_FIELD_NAMES, autocomplete: true };
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useContactSettings(): ContactSettings {
  return useSyncExternalStore(subscribe, () => settings);
}

export const contactSettingsStore = {
  get: () => settings,
  update(changes: Partial<ContactSettings>) {
    settings = { ...settings, ...changes };
    listeners.forEach((listener) => listener());
  },
};

/** The custom field labels, falling back to the default name when one is left blank. */
export const customFieldLabels = ({ customFieldNames }: ContactSettings = settings): [string, string] => [
  customFieldNames[0].trim() || DEFAULT_CUSTOM_FIELD_NAMES[0],
  customFieldNames[1].trim() || DEFAULT_CUSTOM_FIELD_NAMES[1],
];

export const useCustomFieldLabels = () => customFieldLabels(useContactSettings());

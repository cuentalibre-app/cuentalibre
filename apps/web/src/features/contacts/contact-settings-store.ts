import { createStore } from "@/data/store";

/** Options of Configuración › Clientes y proveedores. */
export interface ContactSettings {
  /** Names of the two free fields of every client and supplier. */
  customFieldNames: [string, string];
  /** Look up the company's details from its NIF or name when creating a contact. */
  autocomplete: boolean;
}

export const DEFAULT_CUSTOM_FIELD_NAMES: ContactSettings["customFieldNames"] = ["Personalizado 1", "Personalizado 2"];

const settings = createStore<ContactSettings>({ customFieldNames: DEFAULT_CUSTOM_FIELD_NAMES, autocomplete: true });

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

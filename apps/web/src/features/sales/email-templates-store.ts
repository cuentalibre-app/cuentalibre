import {
  DEFAULT_ORGANIZATION_SETTINGS,
  type EmailTemplate,
  type EmailTemplateSettings,
  type SalesKind,
} from "@cuentalibre/contracts";
import { createStore } from "@/data/store";
import { syncSettings } from "@/data/sync";

/** The business's email templates, in Configuración › Plantillas de correo. */
const settings = createStore<EmailTemplateSettings>(DEFAULT_ORGANIZATION_SETTINGS.emailTemplates);
syncSettings("emailTemplates", settings.set);

export const useEmailTemplates = settings.use;

function save(next: EmailTemplateSettings) {
  return settings.write(next, [{ type: "saveSettings", section: "emailTemplates", data: next }]);
}

export const emailTemplatesStore = {
  get: settings.get,
  /** Adds or replaces a template; `isDefault` makes it, or stops it being, its kind's default. */
  save(template: EmailTemplate, isDefault: boolean) {
    const { templates, defaults } = settings.get();
    const exists = templates.some((t) => t.id === template.id);
    const nextDefaults: Partial<Record<SalesKind, string>> = Object.fromEntries(
      // A template moved to another kind stops being the old kind's default
      Object.entries(defaults).filter(([, id]) => id !== template.id),
    );
    if (isDefault) nextDefaults[template.kind] = template.id;
    return save({
      templates: exists ? templates.map((t) => (t.id === template.id ? template : t)) : [...templates, template],
      defaults: nextDefaults,
    });
  },
  remove(id: string) {
    const { templates, defaults } = settings.get();
    return save({
      templates: templates.filter((t) => t.id !== id),
      defaults: Object.fromEntries(Object.entries(defaults).filter(([, d]) => d !== id)),
    });
  },
};

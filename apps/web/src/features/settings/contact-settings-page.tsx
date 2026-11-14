import type { ContactSettings } from "@cuentalibre/contracts";
import { Input } from "@cuentalibre/ui/components/input";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import {
  DEFAULT_CUSTOM_FIELD_NAMES,
  contactSettingsStore,
  useContactSettings,
} from "@/features/contacts/contact-settings-store";
import { Field, Section } from "@/features/sales/form-fields";
import { SaveButton, SettingsHeader, useDraft } from "./settings-parts";
import { Page } from "@/components/page";

/** Options for clients and suppliers: the names of the two free fields. */
export function ContactSettingsPage() {
  const saved = useContactSettings();
  const { draft, set, dirty, justSaved, markSaved } = useDraft<ContactSettings>(saved);
  const setName = (index: 0 | 1, value: string) =>
    set(
      "customFieldNames",
      (index === 0 ? [value, draft.customFieldNames[1]] : [draft.customFieldNames[0], value]) as [string, string],
    );

  const save = () => {
    contactSettingsStore.update({
      ...draft,
      customFieldNames: [draft.customFieldNames[0].trim(), draft.customFieldNames[1].trim()],
    });
    markSaved();
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <SettingsHeader title="Clientes y proveedores" description="Opciones de las fichas de clientes y proveedores.">
          <SaveButton dirty={dirty} justSaved={justSaved} onSave={save} />
        </SettingsHeader>

        <Section title="Campos personalizados" index={0}>
          <div className="flex max-w-3xl flex-col gap-2 text-muted-foreground">
            <p className="m-0">
              Define dos campos propios para cada cliente o proveedor. Escribe aquí su nombre y lo verás en la ficha
              cada vez que la consultes o la modifiques.
            </p>
            <p className="m-0">
              Por ejemplo, llama «Segundo email» al personalizado 1 para guardar un dato que cuentalibre no pide por
              defecto.
            </p>
          </div>
          <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
            {([0, 1] as const).map((i) => (
              <Field key={i} label={`Nombre del campo personalizado ${i + 1}`}>
                {(p) => (
                  <Input
                    {...p}
                    value={draft.customFieldNames[i]}
                    placeholder={DEFAULT_CUSTOM_FIELD_NAMES[i]}
                    maxLength={40}
                    onChange={(e) => setName(i, e.target.value)}
                  />
                )}
              </Field>
            ))}
          </div>
        </Section>
      </Page>
    </TooltipProvider>
  );
}

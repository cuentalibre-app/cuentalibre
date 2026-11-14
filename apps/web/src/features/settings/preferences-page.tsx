import { useId } from "react";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { Section } from "@/features/sales/form-fields";
import type { ListFilterDefaults, ListPreferences } from "@cuentalibre/contracts";
import { RadioOption } from "@/features/transfer/transfer-parts";
import { SaveButton, SettingsHeader, useDraft } from "./settings-parts";
import { userStore, useUserSettings } from "./user-store";
import { Page } from "@/components/page";

const LISTS: { kind: keyof ListPreferences; title: string; plural: string }[] = [
  { kind: "deliveryNote", title: "Filtro por defecto de los listados de albaranes", plural: "albaranes" },
  { kind: "quote", title: "Filtro por defecto de los listados de presupuestos", plural: "presupuestos" },
];

/** Default filters of the quote and delivery note lists, saved with the user's own settings. */
export function PreferencesPage() {
  const saved = useUserSettings().lists;
  const { draft, set, dirty, justSaved, markSaved } = useDraft(saved);
  const save = () => {
    userStore.updateListPreferences(draft);
    markSaved();
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <SettingsHeader title="Filtros de listados" description="Con qué filtros se abren tus presupuestos y albaranes.">
          <SaveButton dirty={dirty} justSaved={justSaved} onSave={save} />
        </SettingsHeader>

        {LISTS.map((list, index) => (
          <Section key={list.kind} title={list.title} index={index}>
            <FilterChoices
              plural={list.plural}
              value={draft[list.kind]}
              onChange={(changes) => set(list.kind, { ...draft[list.kind], ...changes })}
            />
          </Section>
        ))}
      </Page>
    </TooltipProvider>
  );
}

function FilterChoices({
  plural,
  value,
  onChange,
}: {
  plural: string;
  value: ListFilterDefaults;
  onChange: (changes: Partial<ListFilterDefaults>) => void;
}) {
  const name = useId();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-3 p-0 text-sm font-medium text-muted-foreground">Por estado</legend>
        <RadioOption
          name={`${name}-status`}
          checked={value.status === "all"}
          label="No filtrar"
          hint="No se aplica ningún filtro de estado por defecto."
          onChange={() => onChange({ status: "all" })}
        />
        <RadioOption
          name={`${name}-status`}
          checked={value.status === "open"}
          label={`Mostrar inicialmente solo ${plural} pendientes`}
          hint={`Se muestran todos los ${plural} salvo los facturados y rechazados. Puedes quitar el filtro en el listado.`}
          onChange={() => onChange({ status: "open" })}
        />
      </fieldset>
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-3 p-0 text-sm font-medium text-muted-foreground">Por fecha</legend>
        <RadioOption
          name={`${name}-date`}
          checked={value.date === "all"}
          label="No filtrar"
          hint="Se muestra el periodo elegido en el listado."
          onChange={() => onChange({ date: "all" })}
        />
        <RadioOption
          name={`${name}-date`}
          checked={value.date === "month"}
          label={`Mostrar inicialmente solo ${plural} del mes en curso`}
          hint="Puedes quitar el filtro en el listado o elegir otro periodo."
          onChange={() => onChange({ date: "month" })}
        />
      </fieldset>
    </div>
  );
}

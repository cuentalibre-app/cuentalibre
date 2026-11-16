import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "react-router";
import { Trash2 } from "lucide-react";
import type { CatalogSettings } from "@cuentalibre/contracts";
import { Button } from "@cuentalibre/ui/components/button";
import { Checkbox, Input } from "@cuentalibre/ui/components/input";
import { TooltipProvider } from "@cuentalibre/ui/components/tooltip";
import { CheckField, Field, GroupedSelect } from "@/features/sales/form-fields";
import { Page } from "@/components/page";
import { ConfirmDialog, SaveButton, SettingsHeader, useDraft } from "@/features/settings/settings-parts";
import { RadioOption } from "@/features/transfer/transfer-parts";
import { formatDecimalInput, parseDecimal } from "@/lib/format";
import { RULE_OPTIONS } from "./catalog-model";
import { catalogStore, useCatalog } from "./catalog-store";

function Card({
  id,
  title,
  description,
  index,
  children,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  index: number;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="flex animate-rise-in scroll-mt-6 flex-col gap-4 surface p-5 text-card-foreground"
      style={{ "--i": index } as CSSProperties}
    >
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="m-0 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function CatalogSettingsPage() {
  const { settings, products, families } = useCatalog();
  const { hash } = useLocation();
  const { draft, setDraft, set, dirty, justSaved, markSaved } = useDraft<CatalogSettings>(settings);
  const [minUnits, setMinUnits] = useState(() => formatDecimalInput(settings.defaults.alarm?.minUnits ?? 0));
  const [withFamilies, setWithFamilies] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  const setRule = <K extends keyof CatalogSettings["rules"]>(key: K, value: CatalogSettings["rules"][K]) =>
    set("rules", { ...draft.rules, [key]: value });
  const setDefaults = (changes: Partial<CatalogSettings["defaults"]>) =>
    set("defaults", { ...draft.defaults, ...changes });

  const minDirty = (parseDecimal(minUnits) ?? 0) !== (settings.defaults.alarm?.minUnits ?? 0);

  const save = () => {
    const next: CatalogSettings = {
      ...draft,
      customFieldNames: draft.customFieldNames.map(
        (n, i) => n.trim() || `Personalizado${i + 1}`,
      ) as CatalogSettings["customFieldNames"],
      defaults: {
        ...draft.defaults,
        alarm: { minUnits: parseDecimal(minUnits) ?? 0 },
      },
    };
    catalogStore.updateSettings(next);
    setDraft(next);
    markSaved();
  };

  const saveProps = { dirty: dirty || minDirty, justSaved, onSave: save };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <Page>
        <SettingsHeader
          title="Configuración del catálogo"
          description="Campos personalizados, cómo pasan los productos a las facturas y el control de stock."
        >
          <SaveButton {...saveProps} />
        </SettingsHeader>

        <Card
          index={1}
          title="Campos personalizados"
          description="Define hasta cuatro campos propios para cada producto o servicio del catálogo."
        >
          <div className="grid gap-4 sm:grid-cols-2 @5xl:grid-cols-4">
            {draft.customFieldNames.map((name, i) => (
              <Field key={i} label={`Nombre del campo personalizado ${i + 1}`}>
                {(p) => (
                  <Input
                    {...p}
                    value={name}
                    onChange={(e) => {
                      const names = [...draft.customFieldNames] as CatalogSettings["customFieldNames"];
                      names[i] = e.target.value;
                      set("customFieldNames", names);
                    }}
                  />
                )}
              </Field>
            ))}
          </div>
        </Card>

        <Card
          index={2}
          title="Productos en facturas, presupuestos y albaranes"
          description="Qué se copia del producto al añadirlo a un concepto."
        >
          <div className="flex flex-col gap-3">
            <RadioOption
              name="concept-text"
              checked={draft.conceptText === "name"}
              label="Copiar el nombre del producto"
              onChange={() => set("conceptText", "name")}
            />
            <RadioOption
              name="concept-text"
              checked={draft.conceptText === "codeAndName"}
              label="Copiar el código y el nombre del producto"
              hint="Por ejemplo: «WEB-LAND - Landing page»."
              onChange={() => set("conceptText", "codeAndName")}
            />
          </div>
          <div className="border-t border-divider pt-4">
            <CheckField
              label="Copiar la descripción del producto en la descripción detallada del concepto"
              checked={draft.copyDescription}
              onChange={(v) => set("copyDescription", v)}
            />
          </div>
        </Card>

        <Card
          index={3}
          title="Control de stock"
          description="Cuándo se descuenta el stock y con qué valores empiezan los productos nuevos."
        >
          <div className="grid max-w-3xl gap-4 md:grid-cols-2">
            <Field label="Descontar stock en facturas">
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={draft.rules.invoices}
                  onChange={(v) => setRule("invoices", v as CatalogSettings["rules"]["invoices"])}
                  groups={[{ options: RULE_OPTIONS.invoices }]}
                />
              )}
            </Field>
            <Field label="Descontar stock en albaranes">
              {(p) => (
                <GroupedSelect
                  {...p}
                  value={draft.rules.deliveryNotes}
                  onChange={(v) => setRule("deliveryNotes", v as CatalogSettings["rules"]["deliveryNotes"])}
                  groups={[{ options: RULE_OPTIONS.deliveryNotes }]}
                />
              )}
            </Field>
          </div>

          <div className="flex flex-col gap-3 border-t border-divider pt-4">
            <div className="flex flex-col gap-0.5">
              <h3 className="m-0 text-sm font-semibold">Valores por defecto</h3>
              <p className="m-0 text-sm text-muted-foreground">
                Para productos nuevos e importaciones sin columnas de stock.
              </p>
            </div>
            <CheckField
              label="Activar control de stock"
              checked={draft.defaults.enabled}
              onChange={(v) => setDefaults({ enabled: v })}
            />
            {draft.defaults.enabled && (
              <div className="flex animate-fade-in flex-col gap-3 pl-7">
                <CheckField
                  label="Permitir vender sin stock"
                  checked={draft.defaults.allowWithoutStock}
                  onChange={(v) => setDefaults({ allowWithoutStock: v })}
                />
                <CheckField
                  label="Activar alarma de stock"
                  checked={draft.defaults.alarmOn}
                  onChange={(v) => setDefaults({ alarmOn: v })}
                />
                {draft.defaults.alarmOn && (
                  <div className="flex animate-fade-in flex-col gap-3 pl-7">
                    <Field label="Avisar cuando queden menos de" className="max-w-xs">
                      {(p) => (
                        <div className="flex items-center gap-2">
                          <Input
                            {...p}
                            inputMode="decimal"
                            value={minUnits}
                            onChange={(e) => setMinUnits(e.target.value)}
                            className="text-right amount"
                          />
                          <span className="text-sm text-muted-foreground">unidades</span>
                        </div>
                      )}
                    </Field>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <SaveButton {...saveProps} bottom />

        <Card
          id="borrar-catalogo"
          index={4}
          title="Borrar catálogo"
          description="Borra todo el catálogo, por ejemplo para reimportarlo desde Excel. Las facturas no cambian."
        >
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
            <Checkbox checked={withFamilies} onChange={(e) => setWithFamilies(e.target.checked)} />
            Borrar también todas las familias y subfamilias
          </label>
          <Button
            variant="destructive"
            className="self-start"
            disabled={products.length === 0 && (!withFamilies || families.length === 0)}
            onClick={() => setConfirming(true)}
          >
            <Trash2 strokeWidth={1.8} aria-hidden="true" />
            Borrar elementos
          </Button>
        </Card>
      </Page>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="¿Borrar el catálogo?"
        confirmLabel="Borrar elementos"
        danger
        onConfirm={() => catalogStore.clear(withFamilies)}
      >
        <p className="m-0">
          Se borrarán {products.length === 1 ? "1 producto" : `${products.length} productos`}
          {withFamilies &&
            families.length > 0 &&
            ` y ${families.length === 1 ? "1 familia" : `${families.length} familias`}`}
          . No se puede deshacer.
        </p>
      </ConfirmDialog>
    </TooltipProvider>
  );
}

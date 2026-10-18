import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "react-router";
import { Trash2 } from "lucide-react";
import type { CatalogSettings } from "@fiscalia/contracts";
import { Button } from "@fiscalia/ui/components/button";
import { Checkbox, Input } from "@fiscalia/ui/components/input";
import { TooltipProvider } from "@fiscalia/ui/components/tooltip";
import { CheckField, Field, GroupedSelect } from "@/features/sales/form-fields";
import { ConfirmDialog, SaveButton, SettingsHeader, useDraft } from "@/features/settings/settings-parts";
import { RadioOption } from "@/features/transfer/transfer-parts";
import { formatDecimalInput, parseDecimal } from "@/lib/format";
import { RULE_OPTIONS } from "./catalog-model";
import { catalogStore, useCatalog } from "./catalog-store";

const RULE_HELP = {
  invoices:
    "Nunca: las facturas emitidas no tocan el stock. Al crear/editar una factura: se descuenta al crear una factura o al editarla.",
  deliveryNotes:
    "Nunca: los albaranes no tocan el stock. Al crear/editar: se descuenta al crear o editar el albarán. Al facturar: se descuenta al crear la factura del albarán.",
  quotes:
    "Nunca: los presupuestos no tocan el stock. Al albaranar: se descuenta al convertirlo en albarán. Al facturar: se descuenta al convertirlo en factura.",
  drafts: "Nunca: los borradores no tocan el stock. Al facturar: se descuenta al emitir el borrador como factura.",
};

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
      className="flex animate-rise-in scroll-mt-6 flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground"
      style={{ "--i": index } as CSSProperties}
    >
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold">{title}</h2>
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
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  const setRule = <K extends keyof CatalogSettings["rules"]>(key: K, value: CatalogSettings["rules"][K]) =>
    set("rules", { ...draft.rules, [key]: value });
  const setDefaults = (changes: Partial<CatalogSettings["defaults"]>) =>
    set("defaults", { ...draft.defaults, ...changes });
  const setAlarm = (changes: Partial<NonNullable<CatalogSettings["defaults"]["alarm"]>>) =>
    setDefaults({
      alarm: { minUnits: 0, dashboard: false, notification: false, email: false, ...draft.defaults.alarm, ...changes },
    });

  const minDirty = (parseDecimal(minUnits) ?? 0) !== (settings.defaults.alarm?.minUnits ?? 0);

  const save = () => {
    const email = draft.alarmEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("El email no es correcto.");
      return;
    }
    const next: CatalogSettings = {
      ...draft,
      alarmEmail: email,
      customFieldNames: draft.customFieldNames.map(
        (n, i) => n.trim() || `Personalizado${i + 1}`,
      ) as CatalogSettings["customFieldNames"],
      defaults: {
        ...draft.defaults,
        alarm: {
          dashboard: false,
          notification: false,
          email: false,
          ...draft.defaults.alarm,
          minUnits: parseDecimal(minUnits) ?? 0,
        },
      },
    };
    catalogStore.updateSettings(next);
    setDraft(next);
    markSaved();
  };

  const saveButton = <SaveButton dirty={dirty || minDirty} justSaved={justSaved} onSave={save} />;

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-4 lg:px-8">
        <SettingsHeader
          title="Configuración del catálogo"
          description="Campos personalizados, cómo pasan los productos a las facturas y el control de stock."
        >
          {saveButton}
        </SettingsHeader>

        <Card
          index={1}
          title="Campos personalizados"
          description="Define hasta cuatro campos propios para cada producto o servicio del catálogo."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          description="Al elegir un producto del catálogo en un concepto se rellena todo automáticamente. Elige qué texto lleva el concepto y si se copia la descripción del producto."
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
          description="En qué documentos se descuenta el stock de los productos que lo tienen activado, y con qué valores empiezan los productos nuevos."
        >
          <Field
            label="Email donde recibir los avisos de stock"
            error={emailError ?? undefined}
            help="Adonde se envían los avisos de los productos con la alarma de stock y el aviso por correo activados."
            className="max-w-md"
          >
            {(p) => (
              <Input
                {...p}
                type="email"
                value={draft.alarmEmail}
                onChange={(e) => {
                  set("alarmEmail", e.target.value);
                  setEmailError(null);
                }}
              />
            )}
          </Field>

          <div className="grid gap-x-6 gap-y-5 border-t border-divider pt-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="flex flex-col gap-3">
              <h3 className="m-0 text-sm font-semibold">Facturas emitidas</h3>
              <Field label="Descontar stock en facturas" help={RULE_HELP.invoices}>
                {(p) => (
                  <GroupedSelect
                    {...p}
                    value={draft.rules.invoices}
                    onChange={(v) => setRule("invoices", v as CatalogSettings["rules"]["invoices"])}
                    groups={[{ options: RULE_OPTIONS.invoices }]}
                  />
                )}
              </Field>
              <CheckField
                label="Recuperar el stock al eliminar una factura"
                help="Al eliminar una factura emitida, vuelven al stock las unidades de sus productos."
                checked={draft.restoreOnDeleteInvoice}
                onChange={(v) => set("restoreOnDeleteInvoice", v)}
              />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="m-0 text-sm font-semibold">Albaranes</h3>
              <Field label="Descontar stock en albaranes" help={RULE_HELP.deliveryNotes}>
                {(p) => (
                  <GroupedSelect
                    {...p}
                    value={draft.rules.deliveryNotes}
                    onChange={(v) => setRule("deliveryNotes", v as CatalogSettings["rules"]["deliveryNotes"])}
                    groups={[{ options: RULE_OPTIONS.deliveryNotes }]}
                  />
                )}
              </Field>
              <CheckField
                label="Recuperar el stock al eliminar un albarán"
                help="Al eliminar un albarán, vuelven al stock las unidades de sus productos."
                checked={draft.restoreOnDeleteDeliveryNote}
                onChange={(v) => set("restoreOnDeleteDeliveryNote", v)}
              />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="m-0 text-sm font-semibold">Presupuestos</h3>
              <Field label="Descontar stock en presupuestos" help={RULE_HELP.quotes}>
                {(p) => (
                  <GroupedSelect
                    {...p}
                    value={draft.rules.quotes}
                    onChange={(v) => setRule("quotes", v as CatalogSettings["rules"]["quotes"])}
                    groups={[{ options: RULE_OPTIONS.quotes }]}
                  />
                )}
              </Field>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="m-0 text-sm font-semibold">Facturas borrador</h3>
              <Field label="Descontar stock en borradores" help={RULE_HELP.drafts}>
                {(p) => (
                  <GroupedSelect
                    {...p}
                    value={draft.rules.drafts}
                    onChange={(v) => setRule("drafts", v as CatalogSettings["rules"]["drafts"])}
                    groups={[{ options: RULE_OPTIONS.drafts }]}
                  />
                )}
              </Field>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-divider pt-4">
            <div className="flex flex-col gap-0.5">
              <h3 className="m-0 text-sm font-semibold">Valores por defecto</h3>
              <p className="m-0 text-sm text-muted-foreground">
                Con los que empieza un producto nuevo (puedes cambiarlos antes de crearlo) y los que se usan al importar
                cuando el Excel deja vacías las columnas de stock.
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
                    <CheckField
                      label="Avisar en el inicio"
                      checked={draft.defaults.alarm?.dashboard ?? false}
                      onChange={(v) => setAlarm({ dashboard: v })}
                    />
                    <CheckField
                      label="Enviar notificaciones"
                      checked={draft.defaults.alarm?.notification ?? false}
                      onChange={(v) => setAlarm({ notification: v })}
                    />
                    <CheckField
                      label="Enviar correo electrónico"
                      checked={draft.defaults.alarm?.email ?? false}
                      onChange={(v) => setAlarm({ email: v })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <div className="flex justify-end gap-3 lg:hidden">{saveButton}</div>

        <Card
          id="borrar-catalogo"
          index={4}
          title="Borrar catálogo"
          description="Borra todos los productos y servicios del catálogo de una vez. Es útil si lo llevas en un Excel y quieres volver a importarlo desde cero. Las facturas que ya los usan no cambian."
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
      </div>

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
